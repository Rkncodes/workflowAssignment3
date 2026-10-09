# Process Overview

**Assignment 1 — Student Project Approval & Allocation System**

Model: [`bpmn/Student_Project_Approval.bpmn`](../bpmn/Student_Project_Approval.bpmn) · Full diagram: [`exports/Student_Project_Approval_Full.png`](../exports/Student_Project_Approval_Full.png)

## Scenario

A department runs a final-year project programme. Every student team submits a project proposal. The proposal is validated and screened, reviewed by a committee and, once approved, a faculty guide is allocated.

- **Starts when** a student team decides to submit a project proposal.
- **Ends when** a guide is allocated and confirmed, or the proposal is closed as rejected, invalid, lapsed or withdrawn.

## Structure

One pool, *Student Project Approval & Allocation System*, with five lanes:

| Lane | Role in the process |
|---|---|
| Student / Team | Submits the proposal, files a late-submission request, revises the proposal |
| Project Coordinator | Screens proposals, reviews similarity matches, decides late requests, resolves escalated validation errors, allocates guides manually, performs the manual fallback |
| Review Committee (incl. HoD) | Evaluates the proposal; the HoD decides when the committee is overdue |
| Faculty Guide | Accepts or declines the allocation request |
| Project Management System | Validation, team rules, similarity check, guide matching, notifications, recording, slot reservation and release |

The model has two diagrams: the main process, and the drill-down of the collapsed sub-process `Record Allocation & Notify Parties`.

## Happy path

| # | Step (diagram label) | Lane | Element |
|---|---|---|---|
| 1 | `Team decides to submit a proposal` | Student / Team | Start event |
| 2 | `Prepare & Submit Proposal` | Student / Team | User task |
| 3 | `Validate Proposal Data` → `Data complete & valid?` = Yes | System | Service task, exclusive gateway |
| 4 | `Check Team Rules` → `Team rules satisfied?` = Yes | System | Business rule task, exclusive gateway |
| 5 | `Screen Proposal` | Coordinator | User task |
| 6 | `Run Similarity / Duplicate-Topic Check` → `Similarity above threshold?` = No | System | Service task, exclusive gateway |
| 7 | `Evaluate Proposal` → `Committee decision?` = Approved | Committee | User task, exclusive gateway |
| 8 | `Match Guide by Domain & Workload` → `Eligible guide found?` = Yes | System | Business rule task, exclusive gateway |
| 9 | `Send Allocation Request to Guide` | System | Send task |
| 10 | `Accept or Decline Guide Request` → `Guide response?` = Accepted | Faculty Guide | User task, exclusive gateway |
| 11 | `Allocate Guide & Reserve Slot` | System | Service task |
| 12 | `Record Allocation & Notify Parties` (write record, then notify team and guide in parallel) | System | Collapsed sub-process |
| 13 | `Await confirmation window` → `7-day confirmation window closed` | System | Event-based gateway, timer catch event |
| 14 | `Project allocated & confirmed` | System | End event |

![Happy path](../exports/Student_Project_Approval_Happy_Path.png)

## Phases

1. **Submission and validation** — submission under a deadline, automated data validation with a two-attempt limit, team-rule check. ([section image](../exports/Student_Project_Approval_Section_1_Submission_Validation.png))
2. **Screening and committee review** — coordinator screening, similarity check with coordinator review of matches, committee decision with revision loop, reminder and HoD escalation, rejection with one new-topic submission. ([section image](../exports/Student_Project_Approval_Section_2_Screening_Review.png))
3. **Guide allocation** — rule-based matching, guide request, decline/timeout handling with three attempts, manual allocation by the coordinator. ([section image](../exports/Student_Project_Approval_Section_3_Guide_Allocation.png))
4. **Recording and confirmation** — slot reservation, recording and notification with retries and manual fallback, confirmation window with withdrawal and guide-unavailability handling. ([section image](../exports/Student_Project_Approval_Section_4_Recording_PostAllocation.png), [sub-process image](../exports/Student_Project_Approval_Subprocess_Record_Allocation.png))

## Process data used in conditions

| Variable | Set by | Used at |
|---|---|---|
| `submissionDeadline` | Programme calendar; reset by a late extension and by `Send Reasons & Invite Topic Resubmission` | Timer `Submission deadline reached` |
| `submissionAttempts` | `Prepare & Submit Proposal` | `Data complete & valid?` |
| `extensionsGranted` | `Decide Late-Submission Request` | `Late submission approved?` |
| `topicModifications` | `Review Similarity Match & Record Outcome` | `Coordinator decision?` |
| `revisionCount` | `Revise & Resubmit Proposal` | `Committee decision?` |
| `newTopicSubmissions` | `Send Reasons & Invite Topic Resubmission` (rejection path) | `New-topic submission still allowed?` |
| `allocationAttempts` | `Exclude Guide & Count Attempt` | `Attempts < 3?` |
| `dbRetries`, `teamNotifyRetries`, `guideNotifyRetries` | Retry loops in the sub-process | `DB retries < 3?`, `Retries < 3?` |

The model is a descriptive (non-executable) BPMN 2.0 model: the conditions are written as expressions to make the limits unambiguous, but no engine-specific implementation is attached to the tasks.

## Outcomes

See the end-event table in the [Failure Path Register](Failure_Path_Register.md#end-events). Failure handling is documented there, and the modelling choices in the [Task and Gateway Justification](Task_Gateway_Justification.md).
