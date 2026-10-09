# Task and Gateway Justification

Model: [`Assignment1_BPMN_Diagram.bpmn`](Assignment1_BPMN_Diagram.bpmn). Labels in `code style` are the exact names in the diagram.

## 1. Task types

| Task type | Where it is used | Why this type |
|---|---|---|
| **User task** | `Prepare & Submit Proposal`, `Submit Late-Submission Request`, `Revise & Resubmit Proposal` (student); `Screen Proposal`, `Decide Late-Submission Request`, `Resolve Escalated Proposal Errors`, `Review Similarity Match & Record Outcome`, `Allocate Guide Manually`, `Record Allocation & Notify Parties Manually` (coordinator); `Evaluate Proposal`, `Decide Escalated Proposal (HoD)` (committee); `Accept or Decline Guide Request` (guide) | A person does the work through a form in the Project Management System and the process waits for them. A user task (rather than a manual task) is right because the system assigns the work, tracks it and can attach deadlines to it, which is what the timer boundary events rely on. |
| **Service task** | `Validate Proposal Data`, `Run Similarity / Duplicate-Topic Check`, `Exclude Guide & Count Attempt`, `Allocate Guide & Reserve Slot`, `Release Guide Slot`, `Record Withdrawal & Close Project`, `Write Allocation Record` | Fully automated work with no human judgement: field checks, a call to a similarity service, database updates. These are also the steps that can fail technically, so they carry the error boundary events. |
| **Business rule task** | `Check Team Rules`, `Match Guide by Domain & Workload` | Both apply department policy that is best kept as a decision table: team-size limit and no duplicate membership; domain match against current workload and maximum load. A business rule task says "the outcome comes from rules that can change without redrawing the process". The matching rule returning "none" is what triggers F8. |
| **Send task** | `Notify Team of Rule Violation`, `Send Reasons & Invite Topic Resubmission`, `Send Allocation Request to Guide`, `Notify Student Team`, `Notify Faculty Guide` | The only purpose of the step is to send a message to a participant. Using a send task instead of a generic service task makes the communication points visible. |
| **Receive task** | Not used | The brief allows the guide's acceptance to be a receive task or a user task. The guide is a lane inside the same pool and works in the same system, so the acceptance is modelled as a user task; a receive task would hide who does the work. Incoming messages that are genuinely unsolicited (withdrawal, guide unavailability) are modelled as message catch events instead. |
| **Collapsed sub-process** | `Record Allocation & Notify Parties` | Groups the database write and the two notifications with their three retry loops. It keeps eleven retry-handling elements out of the main diagram, and gives one place to attach the "all retries exhausted" error boundary. It is entirely automated, so it sits in the system lane. |

Automated tasks are only in the *Project Management System* lane and user tasks only in the four human lanes.

## 2. Gateways

### Exclusive gateways (XOR)

Used wherever exactly one path is taken based on data that already exists when the gateway is reached.

| Gateway | Branches | Reason |
|---|---|---|
| `Data complete & valid?` | Yes / No – return error list (attempts < 2) / No – 2 attempts used: escalate | The third branch makes the attempt limit explicit instead of hiding it in a note. |
| `Errors resolved?` | Yes / No | Outcome of the coordinator's escalation. |
| `Team rules satisfied?` | Yes / No | Result of the business rule task. |
| `Similarity above threshold?` | No / Yes | Result of the similarity service. |
| `Coordinator decision?` | Cleared / Modify topic (first time) / Reject (or topic already modified once) | Three mutually exclusive outcomes of the similarity review. |
| `Late submission approved?` | Approved (one extension only) / Refused | Coordinator decision on the late request. |
| `Committee decision?` | Approved / Revision requested (cycles < 2) / Rejected (or 2 revision cycles used) | The core approval gateway. The revision branch is only available while `revisionCount < 2`; after two cycles a "revise" decision falls through to rejection, so the committee must approve or reject. |
| `New-topic submission still allowed?` | Yes – one new topic / No | Enforces the single new-topic submission after rejection. |
| `Eligible guide found?` | Yes / No – "none" | Result of the matching rule. |
| `Guide response?` | Accepted / Declined | Decision recorded by the guide. |
| `Attempts < 3?` | Yes – try next guide / No – 3 attempts used | Bounds the allocation loop. |
| `Guide assigned?` | Yes – manual / co-guide / external / No – waiting list | Outcome of manual allocation. |
| `DB retries < 3?`, `Retries < 3?` (×2, in the sub-process) | Yes / No | Bound the technical retry loops. |

Every splitting exclusive gateway is phrased as a question, every outgoing flow is labelled and carries a condition expression. The unlabelled exclusive gateways are **merges** only: no gateway in the model both joins and splits, and no task has two incoming flows, so every merge is explicit.

An inclusive gateway is not used because there is no point in the process where one *or more* of several paths may be chosen.

### Parallel gateways (AND)

Used once, inside the sub-process: after `Write Allocation Record` the flow splits to `Notify Student Team` and `Notify Faculty Guide` and joins before `Allocation recorded & parties notified`. The two notifications are independent, both are always required, and neither should wait for the other, which is exactly AND semantics. The split has a matching join with the same two branches. If either branch exhausts its retries, its error end event cancels the whole sub-process, so the join can never be left waiting for a token.

Parallel gateways are deliberately **not** used for the validation checks (data → team rules → coordinator screening → similarity). Those are sequential: each one can end or redirect the proposal, and there is no value in running a similarity check on a proposal from an invalid team.

### Event-based gateway

Used once: `Await confirmation window`. After the allocation is recorded the process has nothing to do but wait for whichever happens first: `Team withdrawal received` (message), `Guide unavailable` (message) or `7-day confirmation window closed` (timer). The choice is made by an external occurrence, not by data, so an exclusive gateway would be wrong here, and there is no task to hang boundary events on. All three targets are catch events and none of the outgoing flows has a condition.

It is not used for the guide's answer. That wait happens *on a task* (`Accept or Decline Guide Request`), so a timer boundary and a message boundary on the task express the same race more directly and keep the guide's work visible in the guide lane.

## 3. Events

### Timer boundary events

| Event | Attached to | Interrupting? | Reason |
|---|---|---|---|
| `Submission deadline reached` | `Prepare & Submit Proposal` | Yes | The deadline ends the opportunity to submit. Defined as a date (`submissionDeadline`), not a duration, so re-entering the task after a correction does not restart the clock; a late extension or a new-topic invitation sets a new date. |
| `3 days: no request` | `Submit Late-Submission Request` | Yes | Without a request the proposal lapses. |
| `7 days: no revision` | `Revise & Resubmit Proposal` | Yes | The 7-day revision period from the brief. |
| `5 days: no decision` | `Evaluate Proposal` | **No** | A reminder must not cancel the review, so the event is non-interrupting; its token ends at `Reminder sent to committee`. |
| `10 days: still no decision` | `Evaluate Proposal` | Yes | Escalation takes the decision away from the committee and gives it to the HoD. |
| `No response in 5 days` | `Accept or Decline Guide Request` | Yes | Silence is treated like a decline. |

Inside the sub-process, `Wait 5 min` is an intermediate timer *catch* event (not a boundary event): it is a deliberate pause between retries.

### Error boundary events

Used only for technical faults, never for business outcomes:

- `Similarity service unavailable` on `Run Similarity / Duplicate-Topic Check` → manual review.
- `Database write error` on `Write Allocation Record` and `Notification failure` on each of the two send tasks → retry loop.
- `Retries exhausted` on the sub-process `Record Allocation & Notify Parties` → manual fallback. It catches the error thrown by the sub-process's error end events (same error reference).

Business results such as "data invalid", "similarity too high" or "guide declined" are ordinary gateway branches, because they are expected outcomes rather than exceptions.

### Message events

- `Team withdrawal received` appears twice: as an interrupting **boundary event** on `Accept or Decline Guide Request` (withdrawal while a request is pending) and as a **catch event** after the event-based gateway (withdrawal after allocation). Both reference the same message.
- `Guide unavailable` is a catch event after the event-based gateway.
- `Team flagged & notified of missed deadline` is an intermediate message **throw** event: a notification in the middle of a flow that needs no task of its own.
- The negative end events are **message end events**: the notice to the team is the last thing the process does, so the end event sends it.

### Compensation

`Allocate Guide & Reserve Slot` has a compensation boundary event `Undo allocation` associated with the compensation handler `Release Guide Slot`. The two intermediate compensation throw events named `Release guide slot` reference that activity. Compensation is the right construct because the slot reservation completed successfully earlier and now has to be reversed for a business reason; that is different from an error, where the activity itself failed. Reserving the slot is a separate task placed *before* the recording sub-process so that the slot can be compensated whether the allocation was then recorded automatically or by the manual fallback.

## 4. Loops and limits

All loops are ordinary sequence-flow loops through explicit merge gateways, each guarded by a counter condition on a gateway branch (see the "Bounded loops" table in the [Failure Path Register](Assignment1_Failure_Path_Register.md)). Loop markers and multi-instance markers are not used: the repeated work is never "the same task again until done", it is a path through several tasks and lanes, and the exit branch needs to be visible. The one loop without a counter is reallocation after `Guide unavailable`; it cannot spin because every iteration needs a new external message and the 7-day timer ends the wait.

## 5. Escalation

| From | To | Mechanism |
|---|---|---|
| Two failed validation attempts (F1) | Coordinator – `Resolve Escalated Proposal Errors` | Counter-guarded gateway branch |
| Committee silent for 10 days (F7) | HoD – `Decide Escalated Proposal (HoD)` | Interrupting timer boundary event |
| No eligible guide (F8) / three failed attempts (F9) | Coordinator – `Allocate Guide Manually` | Gateway branches merging before the task |
| Automated recording fails after retries (F10) | Coordinator – `Record Allocation & Notify Parties Manually` | Error end event caught by an error boundary event |

A BPMN *escalation event* is not used. An escalation throw event only has defined behaviour when something catches it (a boundary event on an enclosing sub-process or an event sub-process). The committee review is a single user task at process level, so the timer boundary event leading straight to the HoD's task is the direct, semantically complete way to model the escalation.

## 6. End events

There is one success end event and a separate, named end event for each way the process can close (rejected, invalid, lapsed, waiting list, withdrawn), so the final state of any instance is readable from the end event it reached. `Invalid team` is an **error end event**: the submission is terminated as invalid and the team must start again with a valid team. No terminate end event is needed; apart from the non-interrupting reminder branch, which ends on its own end event, there is never a second token left running when an end event is reached.

## 7. Pool and lanes

The brief lists five participants as lanes of one department process, so the model uses one pool with five lanes and no message flows. Communication between lanes is therefore shown with send tasks and message events rather than message flows between pools.
