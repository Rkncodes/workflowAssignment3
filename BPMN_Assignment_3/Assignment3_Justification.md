# Task and Gateway Justification — Assignment 3

Model: [`Assignment3_BPMN_Diagram.bpmn`](Assignment3_BPMN_Diagram.bpmn). Labels in `code style` are the exact names in the diagram.

## 1. Pools and lanes

The bank is one pool with six lanes: Applicant, Loan Officer, Underwriter / Credit Committee, Fraud & Compliance Team, Operations / Disbursement and Core Banking System. These are roles inside one orchestrated process, so the work passes between them by sequence flow.

The **Credit Bureau is a separate pool**. It is an outside organisation: the bank does not control or see its internal process, only the messages exchanged. It is therefore drawn as a collapsed (black-box) pool with two **message flows**, `Credit report request` and `Credit report`, attached to `Retrieve Credit Bureau Report`. Sequence flow never crosses the pool boundary and no message flow is used between lanes of the bank.

## 2. Task types

| Task type | Where | Why |
|---|---|---|
| **User task** | Applicant: `Submit Application & Documents`, `Provide Missing Documents`, `Accept or Decline Counter-Offer`, `E-Sign Loan Agreement`. Loan officer: `Verify Income & Employment`, `Verify Identity Manually`, `Perform Manual Credit Check`, `Value Collateral & Verify Title`, `Revalue Collateral & Reduce Loan Amount`. Underwriter / committee: `Review Case & Decide`, `Decide Escalated Case (Senior Credit Committee)`. Fraud & compliance: `File Internal Report`, `Perform Enhanced Due Diligence`. Operations: `Verify Bank Account Details`, `Hold Funds & Contact Applicant` | Work that needs a person's judgement or action, done through a form in the bank's system so that deadlines and withdrawal can be attached to it. |
| **Business rule task** | `Check Document Completeness`, `Score Eligibility & Risk` | Checklist and credit policy are rule sets. The scoring rule returns approve / review / decline, which drives the risk gateway. |
| **Service task** | `Collect Processing Fee & Place Hold`, `Run KYC & AML Screening`, `Generate Loan Offer`, `Create Loan Account`, `Disburse Funds to Verified Account`, the compensation handlers, and `Request Credit Report from Bureau` in the sub-process | Automated calls. The two that depend on outside systems (bureau, payment gateway) carry error boundary events. |
| **Send task** | `Send Counter-Offer`, `Send Loan Offer to Applicant`, `Resend Agreement & Reminder`, `Notify Applicant of Disbursement` | The step only sends a message. |
| **Receive task** | `Receive Offer Acceptance` | The process waits for the applicant's reply to the offer just sent. Being a task, it can carry both the 15-day timer boundary (L9) and the withdrawal boundary (L10). |
| **Collapsed sub-process** | `Fraud / AML Investigation`, `Retrieve Credit Bureau Report` | The investigation is a self-contained piece of compliance work. The bureau sub-process hides the retry loop and gives one place for the "bureau unavailable" boundary event and the message flows. |

All service, business rule, send and receive tasks are in the Core Banking System lane.

## 3. Gateways

### Parallel gateway

After the fee is collected, three verifications run together and must all finish before scoring: `Run KYC & AML Screening`, `Retrieve Credit Bureau Report` and `Verify Income & Employment`. They are independent, all are always needed, and running them in sequence would only add waiting time. One parallel split with three branches is closed by one parallel join with three branches. The fallbacks inside the branches (manual identity check, fraud investigation, manual credit check) rejoin their own branch before the join.

### Exclusive gateways

Used for every decision made from data: `Documents complete?`, `Screening result?`, `Flag type?`, `Identity resolved?`, `Fraud / AML confirmed?`, `Risk decision?` (auto-approve / manual review / below cutoff), `Counter-offer possible (first time)?`, `Counter-offer accepted?`, `Underwriter decision?`, `Above authority or borderline?`, `Committee decision?`, `Signature valid?`, `Signing attempts < 2?`, `Disbursement retries < 2?`, and `Retries < 3?` in the bureau sub-process. Decisions with more than three outcomes are split over two gateways in sequence. Unlabelled exclusive gateways are merges only.

### Inclusive gateway

`Extra checks required?` is the one place where *one or more* paths may be needed at the same time: a secured loan needs `Value Collateral & Verify Title`, a loan above the threshold needs `Perform Enhanced Due Diligence`, a loan that is both needs both, and a loan that is neither takes the default flow "No extra checks". An exclusive gateway cannot express "both", and a parallel gateway would force both. The split is paired with an inclusive join, which waits only for the branches that were actually activated.

### Event-based gateway

Not used. Every wait in this process happens on a task (`Receive Offer Acceptance`, `Review Case & Decide`, `E-Sign Loan Agreement`), so the competing events are modelled as boundary events on that task.

## 4. Events

- **Timer boundary events (interrupting):** `7 days: no response` on missing documents and on the counter-offer, `15 days: offer validity over` on the receive task, `5 days: not signed` on the e-signature.
- **Timer boundary event (non-interrupting):** `3-day SLA exceeded` on the committee task. The committee must still decide, so the reminder runs alongside and ends at `SLA reminder sent to committee`.
- **Timer catch event:** `Wait 10 min` between bureau retries.
- **Error boundary events:** `API timeout / bureau down` on the bureau call, `Bureau unavailable after 3 retries` on the sub-process, and `Invalid account / payment gateway error` on disbursement. All three are technical faults of outside systems. Credit rejection, identity mismatch and signature mismatch are business outcomes and are gateway branches.
- **Message boundary events:** `Withdrawal received` on `Review Case & Decide` and on `Receive Offer Acceptance` (L10).
- **Terminate end events:** `Rejected – identity not verified` and `Rejected – fraud / AML confirmed`. Both are reached from inside the parallel verification section while the bureau and income branches may still be running. A normal end event would leave those tokens alive; a terminate end event stops the whole application, which is what a confirmed fraud or failed identity check requires.
- **Compensation:** two compensable activities. `Collect Processing Fee & Place Hold` (boundary `Undo fee` → `Reverse Processing Fee & Release Holds`) is compensated on withdrawal. `Create Loan Account` (boundary `Undo account` → `Reverse Loan Account Creation`) is compensated when disbursement finally fails. Both actions completed correctly and are reversed later for a business reason, which is the purpose of compensation.

## 5. Loops and limits

Every loop passes through an explicit merge gateway and is closed by a counter condition: document rounds (2), bureau retries (3), counter-offer re-scoring (1), revaluation and re-underwriting (1), signing attempts (2), disbursement retries (2). See the [register](Assignment3_Failure_Path_Register.md#bounded-loops).

## 6. Escalation

| From | To | Mechanism |
|---|---|---|
| KYC mismatch | Loan officer – `Verify Identity Manually` | Gateway branch |
| Fraud / AML flag | Fraud & Compliance – `Fraud / AML Investigation` | Gateway branch into the sub-process |
| Bureau unavailable | Loan officer – `Perform Manual Credit Check` | Error end event caught by a boundary event |
| Above authority / borderline | Senior committee – `Decide Escalated Case (Senior Credit Committee)` | Gateway branch, with SLA timer |
| Disbursement error | Operations – `Verify Bank Account Details` | Error boundary event |

A BPMN escalation event is not used: at process level nothing would catch it, so each escalation is a direct path to the task of the role that takes over.

## 7. End events

There is a separate end event for each distinct outcome (disbursed; six kinds of rejection; withdrawn; declined counter-offer; three kinds of lapse; disbursement failure), so the final state of an application is readable from where it ended. Terminate is reserved for the two cases that must stop parallel work.
