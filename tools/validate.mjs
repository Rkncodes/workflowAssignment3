// Structural validation of the BPMN file: moddle parse (schema-typed, reference resolution) + graph checks.
import fs from 'node:fs';
import { BpmnModdle } from 'bpmn-moddle';

const file = process.argv[2];
const xml = fs.readFileSync(file, 'utf8');
const moddle = new BpmnModdle();
const { rootElement: defs, warnings, references, elementsById } = await moddle.fromXML(xml);

let fail = 0;
const res = (ok, msg, detail = []) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) { fail++; detail.forEach(d => console.log('        - ' + d)); } };

res(warnings.length === 0, `bpmn-moddle parse: ${warnings.length} warnings (unknown elements/attributes, unresolved references)`, warnings.map(w => w.message));
const unresolved = references.filter(r => !elementsById[r.id]);
res(unresolved.length === 0, `all ${references.length} ID references resolve`, unresolved.map(r => `${r.element.id}.${r.property} -> ${r.id}`));
const ids = [...xml.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
res(dup.length === 0, `${ids.length} element IDs are unique`, dup);

const proc = defs.rootElements.find(e => e.$type === 'bpmn:Process');
const collab = defs.rootElements.find(e => e.$type === 'bpmn:Collaboration');
res(collab.participants.length === 1 && collab.participants[0].processRef === proc, 'one pool whose processRef is the process');
const lanes = proc.laneSets[0].lanes;
res(lanes.length === 5, `5 lanes: ${lanes.map(l => l.name).join(' | ')}`);

const is = (e, t) => e.$instanceOf(`bpmn:${t}`);
function checkScope(scope, label) {
  const els = scope.flowElements;
  const nodes = els.filter(e => is(e, 'FlowNode'));
  const flows = els.filter(e => is(e, 'SequenceFlow'));
  const bad = [];
  for (const f of flows) {
    if (!nodes.includes(f.sourceRef) || !nodes.includes(f.targetRef)) bad.push(`${f.id}: source/target outside scope`);
    if (!f.sourceRef.outgoing?.includes(f)) bad.push(`${f.id}: missing <outgoing> on ${f.sourceRef.id}`);
    if (!f.targetRef.incoming?.includes(f)) bad.push(`${f.id}: missing <incoming> on ${f.targetRef.id}`);
  }
  res(bad.length === 0, `[${label}] ${flows.length} sequence flows have valid source/target in scope and matching incoming/outgoing`, bad);

  const out = n => flows.filter(f => f.sourceRef === n), inc = n => flows.filter(f => f.targetRef === n);
  const starts = nodes.filter(n => is(n, 'StartEvent')), ends = nodes.filter(n => is(n, 'EndEvent'));
  res(starts.length === 1, `[${label}] exactly one start event`);
  const comp = n => n.isForCompensation || n.eventDefinitions?.[0]?.$type === 'bpmn:CompensateEventDefinition' && is(n, 'BoundaryEvent');
  const dead = nodes.filter(n => !is(n, 'EndEvent') && !comp(n) && out(n).length === 0).map(n => n.id);
  res(dead.length === 0, `[${label}] every non-end node has an outgoing flow (no dead ends)`, dead);
  const noIn = nodes.filter(n => !is(n, 'StartEvent') && !is(n, 'BoundaryEvent') && !comp(n) && inc(n).length === 0).map(n => n.id);
  res(noIn.length === 0, `[${label}] every node except start/boundary/compensation handler has an incoming flow`, noIn);
  const endOut = ends.filter(n => out(n).length).map(n => n.id);
  res(endOut.length === 0, `[${label}] ${ends.length} end events have no outgoing flow`, endOut);

  // boundary events
  const bes = nodes.filter(n => is(n, 'BoundaryEvent'));
  const beBad = bes.filter(b => !b.attachedToRef || !is(b.attachedToRef, 'Activity') || !nodes.includes(b.attachedToRef) || !b.eventDefinitions?.length || inc(b).length).map(b => b.id);
  res(beBad.length === 0, `[${label}] ${bes.length} boundary events are attached to an activity in the same scope, typed, with no incoming flow`, beBad);
  for (const b of bes.filter(b => b.eventDefinitions[0].$type === 'bpmn:CompensateEventDefinition')) {
    const assoc = (scope.artifacts || []).filter(a => a.$type === 'bpmn:Association' && a.sourceRef === b);
    res(assoc.length === 1 && assoc[0].targetRef.isForCompensation === true && out(b).length === 0, `[${label}] compensation boundary ${b.id} is associated with a compensation handler (${assoc[0]?.targetRef.id})`);
  }
  for (const n of nodes.filter(n => n.eventDefinitions?.[0]?.$type === 'bpmn:CompensateEventDefinition' && is(n, 'ThrowEvent'))) {
    const a = n.eventDefinitions[0].activityRef;
    res(!!a && bes.some(b => b.attachedToRef === a && b.eventDefinitions[0].$type === 'bpmn:CompensateEventDefinition'), `[${label}] compensation throw ${n.id} references an activity with a compensation boundary (${a?.id})`);
  }

  // gateways
  const gws = nodes.filter(n => is(n, 'Gateway'));
  const gBad = [];
  for (const g of gws) {
    const i = inc(g).length, o = out(g).length;
    if (i > 1 && o > 1) gBad.push(`${g.id}: mixed join+split`);
    if (i < 2 && o < 2) gBad.push(`${g.id}: superfluous`);
    if (g.$type === 'bpmn:ExclusiveGateway' && o > 1) {
      for (const f of out(g)) { if (!f.conditionExpression?.body) gBad.push(`${f.id}: no condition`); if (!f.name) gBad.push(`${f.id}: no label`); }
      if (!g.name) gBad.push(`${g.id}: split has no question label`);
    }
    if (g.$type === 'bpmn:EventBasedGateway') for (const f of out(g)) {
      if (!is(f.targetRef, 'IntermediateCatchEvent') && f.targetRef.$type !== 'bpmn:ReceiveTask') gBad.push(`${f.id}: event-based gateway target is not a catch event`);
      if (f.conditionExpression) gBad.push(`${f.id}: condition on event-based branch`);
      if (inc(f.targetRef).length !== 1) gBad.push(`${f.targetRef.id}: extra incoming`);
    }
  }
  res(gBad.length === 0, `[${label}] ${gws.length} gateways: none mixes join+split; every exclusive split has a question, labelled + conditioned branches; event-based targets are catch events`, gBad);
  const pg = gws.filter(g => g.$type === 'bpmn:ParallelGateway');
  if (pg.length) {
    const sp = pg.filter(g => out(g).length > 1), jn = pg.filter(g => inc(g).length > 1);
    res(sp.length === jn.length && sp.every(g => jn.some(j => inc(j).length === out(g).length)), `[${label}] parallel gateways matched: ${sp.length} split(s) / ${jn.length} join(s) with equal branch counts`);
  }
  const implicit = nodes.filter(n => !is(n, 'Gateway') && (out(n).length > 1 || inc(n).length > 1)).map(n => n.id);
  res(implicit.length === 0, `[${label}] no implicit splits/merges on tasks or events (all branching is via gateways)`, implicit);

  // reachability: forward from start (boundary events reachable via host; compensation handler via association)
  const seen = new Set();
  const stack = [...starts];
  while (stack.length) {
    const n = stack.pop(); if (seen.has(n)) continue; seen.add(n);
    out(n).forEach(f => stack.push(f.targetRef));
    bes.filter(b => b.attachedToRef === n).forEach(b => stack.push(b));
    (scope.artifacts || []).filter(a => a.$type === 'bpmn:Association' && a.sourceRef === n).forEach(a => stack.push(a.targetRef));
  }
  const unreach = nodes.filter(n => !seen.has(n)).map(n => n.id);
  res(unreach.length === 0, `[${label}] all ${nodes.length} flow nodes reachable from the start event`, unreach);
  // every node can reach an end event
  const canEnd = new Set(ends);
  let changed = true;
  while (changed) { changed = false; for (const n of nodes) if (!canEnd.has(n) && (out(n).some(f => canEnd.has(f.targetRef)))) { canEnd.add(n); changed = true; } }
  const stuck = nodes.filter(n => !canEnd.has(n) && !comp(n)).map(n => n.id);
  res(stuck.length === 0, `[${label}] every node can reach an end event (no livelock-only regions)`, stuck);

  // every cycle must pass through a bounded element: a counter-conditioned gateway branch, or an externally triggered/limited step
  const cyc = [];
  const adj = new Map(nodes.map(n => [n, out(n)]));
  const color = new Map();
  const path = [];
  const dfs = n => {
    color.set(n, 1);
    for (const f of adj.get(n)) {
      path.push(f);
      if (color.get(f.targetRef) === 1) { const i = path.findIndex(p => p.sourceRef === f.targetRef); cyc.push(path.slice(i)); }
      else if (!color.get(f.targetRef)) dfs(f.targetRef);
      path.pop();
    }
    bes.filter(b => b.attachedToRef === n && !color.get(b)).forEach(b => dfs(b));
    color.set(n, 2);
  };
  starts.forEach(dfs);
  const LIMIT = /<\s*\d|extensionsGranted|topicModifications|newTopicSubmissions/;
  const unb = cyc.filter(c => !c.some(f => LIMIT.test(f.conditionExpression?.body || '')) && !c.some(f => f.sourceRef.id === 'Ev_GuideUnavailable'))
    .map(c => c.map(f => f.sourceRef.id).join(' > '));
  res(unb.length === 0, `[${label}] ${cyc.length} loop back-edges found; each loop is guarded by a counter condition (or, for reallocation, by an external message)`, unb);
  return { nodes, flows, ends };
}
const main = checkScope(proc, 'main');
const sp = proc.flowElements.find(e => e.$type === 'bpmn:SubProcess');
const inner = checkScope(sp, 'sub-process');

// lanes
const laneOf = new Map(); const multi = [];
for (const l of lanes) for (const n of l.flowNodeRef) { if (laneOf.has(n)) multi.push(n.id); laneOf.set(n, l); }
const noLane = main.nodes.filter(n => !laneOf.has(n)).map(n => n.id);
res(noLane.length === 0 && multi.length === 0, `every main-level flow node (${main.nodes.length}) is in exactly one lane`, [...noLane, ...multi]);
const empty = lanes.filter(l => !l.flowNodeRef.some(n => is(n, 'Task'))).map(l => l.name);
res(empty.length === 0, 'every lane contains at least one task', empty);
const USER = /Student|Coordinator|Committee|Guide/;
const wrong = main.nodes.filter(n => (['bpmn:ServiceTask', 'bpmn:BusinessRuleTask', 'bpmn:SendTask'].includes(n.$type) && laneOf.get(n).id !== 'Lane_System') || (n.$type === 'bpmn:UserTask' && !USER.test(laneOf.get(n).id))).map(n => n.id);
res(wrong.length === 0, 'automated tasks sit in the system lane and user tasks in human lanes', wrong);

// error events
const errEnds = inner.ends.filter(e => e.eventDefinitions?.[0]?.$type === 'bpmn:ErrorEventDefinition');
const spB = main.nodes.filter(n => is(n, 'BoundaryEvent') && n.attachedToRef === sp && n.eventDefinitions[0].$type === 'bpmn:ErrorEventDefinition');
res(errEnds.length > 0 && errEnds.every(e => spB.some(b => b.eventDefinitions[0].errorRef === e.eventDefinitions[0].errorRef)), `sub-process error end events (${errEnds.length}) are caught by an error boundary event with the same errorRef`);

// DI completeness
const diEls = new Set(defs.diagrams.flatMap(d => d.plane.planeElement.map(p => p.bpmnElement)));
const needDi = [...main.nodes, ...main.flows, ...inner.nodes, ...inner.flows, ...lanes, ...collab.participants, ...(proc.artifacts || [])];
const noDi = needDi.filter(e => !diEls.has(e)).map(e => e.id);
res(noDi.length === 0, `all ${needDi.length} elements have a diagram shape/edge`, noDi);
const edges = defs.diagrams.flatMap(d => d.plane.planeElement).filter(p => p.$type === 'bpmndi:BPMNEdge');
const diag = edges.filter(e => e.waypoint.some((w, i) => i && w.x !== e.waypoint[i - 1].x && w.y !== e.waypoint[i - 1].y) && e.bpmnElement.$type === 'bpmn:SequenceFlow').map(e => e.id);
res(diag.length === 0, 'all sequence-flow edges are orthogonal', diag);

// summary
const count = {}; [...main.nodes, ...inner.nodes].forEach(n => count[n.$type.slice(5)] = (count[n.$type.slice(5)] || 0) + 1);
console.log('\nElement counts:', JSON.stringify(count));
console.log('End events:', [...main.ends, ...inner.ends].map(e => `"${e.name}"`).join(', '));
console.log(fail ? `\n${fail} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
