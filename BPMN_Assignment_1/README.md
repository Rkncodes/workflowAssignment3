# Assignment 1 — Student Project Approval & Allocation System

BPMN 2.0 model of a department's final-year project approval and guide-allocation process, with its happy path, failure paths and supporting documents.

| File | Contents |
|---|---|
| [`Assignment1_BPMN_Diagram.bpmn`](Assignment1_BPMN_Diagram.bpmn) | Editable BPMN 2.0 model (main process and one sub-process diagram) |
| [`Assignment1_BPMN_Diagram.png`](Assignment1_BPMN_Diagram.png) | Diagram export: main process, with the sub-process shown below it |
| [`Assignment1_Failure_Path_Register.md`](Assignment1_Failure_Path_Register.md) | Complete Failure Path Register, loop limits, end events, assumptions |
| [`Assignment1_Justification.md`](Assignment1_Justification.md) | Detailed justification of task types, gateways and events |

## Diagram

![Student Project Approval & Allocation System – BPMN diagram](Assignment1_BPMN_Diagram.png)

The diagram is wide, so GitHub scales it down here. **[Open the full-size diagram](Assignment1_BPMN_Diagram.png)** and zoom in to read the labels. The upper part is the main process. The lower part is the inside of the sub-process **Record Allocation & Notify Parties**, which appears as a single collapsed box in the main process.

## Overview

A student team submits a project proposal. The system validates the data and the team rules, the coordinator screens it, a similarity check looks for duplicate topics, and the review committee approves, asks for revision, or rejects. After approval a guide is matched by domain and workload and asked to accept; the allocation is then recorded and communicated.

- **Starts when** a student team decides to submit a project proposal.
- **Ends when** a guide is allocated and confirmed, or the proposal is closed as rejected, invalid, lapsed or withdrawn.

### Participants

One pool with five lanes:

| Lane | Responsibility |
|---|---|
| Student / Team | Submit, request late submission, revise |
| Project Coordinator | Screen, review similarity matches, decide late requests, handle escalations, allocate manually |
| Review Committee (incl. HoD) | Evaluate the proposal; the HoD decides when the committee is overdue |
| Faculty Guide | Accept or decline the allocation request |
| Project Management System | Validation, rules, similarity check, matching, notifications, recording |

### Happy path

| # | Step (diagram label) | Lane | Element |
|---|---|---|---|
| 1 | Team decides to submit a proposal | Student / Team | Start event |
| 2 | Prepare & Submit Proposal | Student / Team | User task |
| 3 | Validate Proposal Data → *Data complete & valid?* = Yes | System | Service task, exclusive gateway |
| 4 | Check Team Rules → *Team rules satisfied?* = Yes | System | Business rule task, exclusive gateway |
| 5 | Screen Proposal | Coordinator | User task |
| 6 | Run Similarity / Duplicate-Topic Check → *Similarity above threshold?* = No | System | Service task, exclusive gateway |
| 7 | Evaluate Proposal → *Committee decision?* = Approved | Committee | User task, exclusive gateway |
| 8 | Match Guide by Domain & Workload → *Eligible guide found?* = Yes | System | Business rule task, exclusive gateway |
| 9 | Send Allocation Request to Guide | System | Send task |
| 10 | Accept or Decline Guide Request → *Guide response?* = Accepted | Faculty Guide | User task, exclusive gateway |
| 11 | Allocate Guide & Reserve Slot | System | Service task |
| 12 | Record Allocation & Notify Parties (write record, then notify team and guide in parallel) | System | Sub-process |
| 13 | Await confirmation window → 7-day confirmation window closed | System | Event-based gateway, timer event |
| 14 | Project allocated & confirmed | System | End event |

## Failure-path summary

Thirteen failure paths are modelled: F1–F11 from the brief and two additional ones. The [full register](Assignment1_Failure_Path_Register.md) gives the detection mechanism and the exact diagram labels for each.

| ID | Failure | BPMN solution | Limit | Outcome |
|---|---|---|---|---|
| F1 | Incomplete or invalid proposal data | Exclusive gateway after the validation service task; error list returned; escalation to coordinator | 2 attempts | Continues, or closed as invalid data |
| F2 | Team-rule violation (size, member in another team) | Business rule task, exclusive gateway, send task, error end event | — | "Invalid team" |
| F3 | Duplicate / plagiarised topic | Coordinator review task; gateway: cleared / modify topic / reject | 1 modification | Continues, resubmission, or rejected |
| F4 | Missed submission deadline | Timer boundary event; team notified; late request decided by coordinator | 3 days to request; 1 extension | Back to submission, or lapsed |
| F5 | Committee requests revision | Revision loop with timer boundary event | 7 days; 2 cycles | Back to review, lapsed, or rejection path |
| F6 | Committee rejects | Reasons sent; loop back to submission | 1 new topic | Resubmission, or rejected |
| F7 | Committee review delayed | Non-interrupting timer (reminder) and interrupting timer (HoD decides) | 5 days / 10 days | A decision is always produced |
| F8 | No suitable guide | Rule returns "none"; coordinator allocates manually, co-guide / external, or waiting list | — | Allocation continues, or waiting list |
| F9 | Guide declines or is silent | Gateway and timer boundary; guide excluded; matching re-run | 5 days; 3 attempts | Next guide, then manual allocation |
| F10 | Notification or database failure | Error boundary events with retry loops in the sub-process; coordinator fallback | 3 retries | Recorded automatically or manually |
| F11 | Withdrawal or guide unavailable after allocation | Event-based gateway; compensation releases the guide slot | 7-day window | Withdrawn, or back to guide matching |
| F12 | Similarity service unavailable *(added)* | Error boundary event → coordinator review | — | Same outcomes as F3 |
| F13 | Withdrawal while guide request is pending *(added)* | Message boundary event on the guide's task | — | Withdrawn, request cancelled |

**End events:** one success end (*Project allocated & confirmed*) and separate ends for rejected (2), invalid (2), lapsed (3), waiting list (1) and withdrawn (2).

## Task and gateway justification

Summary only; the element-by-element reasoning is in the [justification document](Assignment1_Justification.md).

- **Task types.** Work a person does through a form is a user task in that person's lane. Automated work (validation, similarity call, database updates) is a service task in the system lane. The two policy decisions that are decision tables — team rules and guide matching — are business rule tasks. Pure notifications are send tasks.
- **Exclusive gateways.** Every decision picks exactly one path from data that already exists, so all decision gateways are exclusive, with a question label and a labelled, conditioned branch for each outcome. Merges are separate gateways; none both joins and splits.
- **Timer boundary events.** A deadline belongs to the task that is waiting, so each is a boundary event on that task. The committee task has two: a non-interrupting one for the reminder and an interrupting one for escalation to the HoD.
- **Error boundary events.** Used only for technical faults (similarity service, database write, notifications). Expected business outcomes such as "invalid" or "declined" are gateway branches.
- **Bounded loops.** Each loop is an explicit flow with a counter condition on the gateway that exits it.
- **Escalation.** Failed validation attempts, an unmatched guide, three failed allocation attempts and exhausted retries go to coordinator tasks; an overdue committee decision goes to the HoD.
- **Compensation.** "Allocate Guide & Reserve Slot" has a compensation boundary event linked to "Release Guide Slot", triggered when the team withdraws or the guide becomes unavailable.
- **Parallel gateway.** Used once, in the sub-process: notifying the team and the guide are independent and both required.
- **Event-based gateway.** Used once, after allocation, to wait for whichever comes first: withdrawal, guide unavailability, or the confirmation timer.

## Validation status

The checks below were run on this BPMN file before submission. The file's content has not changed since; it was only renamed.

| Check | Tool | Result |
|---|---|---|
| Opens and imports both diagrams | Camunda Modeler 5.52.0 | Problems panel: "No problems found" |
| BPMN lint | `bpmnlint` 11.14.0, recommended rules | 0 errors, 0 warnings |
| Element typing and ID references | `bpmn-moddle` 10.3.1 | 0 warnings; all references resolve |
| Flow connectivity, reachability, dead ends, gateway joins and splits, boundary-event attachment, compensation links, loop bounds, lane placement | Custom script (not included in this repository) | All checks passed |
| Diagram labels quoted in the register and justification exist in the model | Script comparison | All match |

Not performed: validation against the OMG BPMN 2.0 XSD, and execution or simulation on a process engine.

**About the PNG.** Both diagrams were exported as SVG by Camunda Modeler 5.52.0 with this BPMN file open (the export was triggered by script rather than through the *File → Export as image* menu). The two exports were then placed one above the other, each under a one-line heading, and converted to a single PNG. Nothing in the diagrams was redrawn or edited.

## Opening the model

1. Install [Camunda Modeler](https://camunda.com/download/modeler/) and open `Assignment1_BPMN_Diagram.bpmn` with *File → Open File…*.
2. Click the small arrow on **Record Allocation & Notify Parties** to open the sub-process; use the breadcrumb at the top-left to return.
3. *File → Export as image…* exports the diagram currently shown.

## Known limitations

- The model is descriptive, not executable; counters in the branch conditions are not incremented by dedicated tasks.
- Technical retries (F10) are drawn only for the allocation record and its two notifications, not for the other notifications in the process.
- Withdrawal is handled while a guide request is pending (F13) and during the confirmation window (F11), not at every other step.
- The HoD's escalated decision has no further timer.
- With a single pool there are no message flows; communication is shown with send tasks and message events.
- Durations not given in the brief are assumptions, listed in the [register](Assignment1_Failure_Path_Register.md#assumptions).
