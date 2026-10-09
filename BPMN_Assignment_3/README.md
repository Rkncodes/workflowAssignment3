# Assignment 3 — Loan Origination & Approval System

BPMN 2.0 model of a bank's personal and secured loan process, showing the normal approval flow and every point where an application can stall, be rejected, lapse or be withdrawn.

| File | Contents |
|---|---|
| [`Assignment3_BPMN_Diagram.bpmn`](Assignment3_BPMN_Diagram.bpmn) | Editable BPMN 2.0 model (main process, external pool, two sub-process diagrams) |
| [`Assignment3_BPMN_Diagram.png`](Assignment3_BPMN_Diagram.png) | Diagram export: main process, with both sub-processes below it |
| [`Assignment3_Failure_Path_Register.md`](Assignment3_Failure_Path_Register.md) | Complete Failure Path Register, loop limits, end events, assumptions |
| [`Assignment3_Justification.md`](Assignment3_Justification.md) | Detailed justification of pools, task types, gateways and events |

## Diagram

![Loan Origination & Approval – BPMN diagram](Assignment3_BPMN_Diagram.png)

The diagram is wide, so GitHub scales it down here. **[Open the full-size diagram](Assignment3_BPMN_Diagram.png)** and zoom in to read the labels. The upper part is the main process with the external Credit Bureau pool beneath it. Below are the two sub-processes that appear as collapsed boxes in the main process: **Fraud / AML Investigation** and **Retrieve Credit Bureau Report**.

## Overview

An applicant submits a loan application with documents. After a completeness check and the processing fee, three verifications run in parallel: KYC and AML screening, a credit bureau report, and income and employment verification. The application is then scored: it is auto-approved, sent for manual underwriting, or declined with a possible counter-offer. An approved application receives an offer; once the applicant accepts and e-signs, the loan account is created and the funds are disbursed.

- **Starts when** an applicant submits a loan application with supporting documents.
- **Ends when** the loan is disbursed, or the application is rejected, withdrawn or has lapsed.

### Participants

| Participant | Modelled as | Responsibility |
|---|---|---|
| Applicant | Lane | Submits, supplies missing documents, answers offers, signs |
| Loan Officer | Lane | Income verification, manual identity and credit checks, collateral valuation |
| Underwriter / Credit Committee | Lane | Case review and decision; committee decides escalated cases |
| Fraud & Compliance Team | Lane | Fraud / AML investigation, enhanced due diligence, internal report |
| Operations / Disbursement | Lane | Bank-account verification, holding funds |
| Core Banking System | Lane | Rules, screening, offers, account creation, disbursement, notifications |
| Credit Bureau | **External pool** (black box) | Returns the credit report; connected by two message flows |

### Happy path

`Submit Application & Documents` → `Check Document Completeness` → `Collect Processing Fee & Place Hold` → in parallel: `Run KYC & AML Screening`, `Retrieve Credit Bureau Report`, `Verify Income & Employment` → `Score Eligibility & Risk` → manual review → `Review Case & Decide` → approve → `Generate Loan Offer` → `Send Loan Offer to Applicant` → `Receive Offer Acceptance` → `E-Sign Loan Agreement` → `Create Loan Account` → `Disburse Funds to Verified Account` → `Notify Applicant of Disbursement` → **Loan disbursed**. A low-risk application skips underwriting through the "Auto-approve" branch.

## Failure-path summary

Full detail, with exact diagram labels, is in the [register](Assignment3_Failure_Path_Register.md).

| ID | Failure | BPMN solution | Limit | Outcome |
|---|---|---|---|---|
| L1 | Incomplete documents | Gateway, applicant task with timer boundary, loop | 7 days; 2 rounds | Continues, lapsed, or rejected |
| L2 | KYC mismatch | Manual verification by loan officer; terminate end if unresolved | — | Continues, or rejected |
| L3 | Fraud / AML flag | Investigation sub-process; internal report; terminate end | — | Continues, or rejected |
| L4 | Credit bureau down | Error boundary, retry loop with timer in a sub-process, manual credit check fallback | 3 retries | Report obtained automatically or manually |
| L5 | Score below cutoff | Counter-offer or rejection with reasons | 1 counter-offer; 7 days | Re-scored, rejected, declined, or lapsed |
| L6 | Income / DTI insufficient | Counter-offer (reduced amount / longer tenure), loop to re-scoring | Once | Re-scored, or rejected |
| L7 | High-value / borderline | Inclusive gateway for extra checks; escalation to committee with SLA timer | 3-day reminder | Approved, or rejected |
| L8 | Collateral valuation / title | Revalue, reduce amount, re-underwrite; reject if title unclear | Once | Re-underwritten, or rejected |
| L9 | Offer not accepted in time | Timer boundary on the receive task | 15 days | Offer expired |
| L10 | Withdrawal | Message boundary events; compensation reverses fees and holds | During review and open offer | Withdrawn |
| L11 | E-signature not completed / mismatch | Timer boundary, gateway, resend loop | 5 days; 2 attempts | Signed, or offer cancelled |
| L12 | Disbursement failure | Error boundary, account verification, retry loop; compensation reverses account | 2 retries | Disbursed, or funds held |

## Task and gateway justification

Summary; details in the [justification document](Assignment3_Justification.md).

- **Pool versus lane.** The six bank roles are lanes of one pool. The Credit Bureau is an outside organisation, so it is a separate black-box pool reached only by message flows.
- **Task types.** User tasks for human judgement; business rule tasks for the document checklist and credit scoring; service tasks for automated calls; send tasks for notifications; a receive task for the offer acceptance.
- **Parallel gateway** (three branches, matched join) for the three independent verifications.
- **Exclusive gateways** for all data-based decisions; decisions with more than three outcomes are split over two gateways.
- **Inclusive gateway** (matched split and join, with a default flow) for the extra underwriting checks, because a case may need collateral valuation, enhanced due diligence, both, or neither.
- **Timer boundary events** for the document, counter-offer, offer-validity and signing deadlines; a non-interrupting one for the committee SLA reminder.
- **Error boundary events** only for technical failures of the bureau and the payment gateway.
- **Terminate end events** for failed identity and confirmed fraud, because they are reached while the other parallel verifications may still be running.
- **Compensation** reverses the processing fee on withdrawal and the loan account when disbursement finally fails.

## Validation

Checks run on the committed BPMN file:

| Check | Tool | Result |
|---|---|---|
| Opens and imports all three diagrams | Camunda Modeler 5.52.0 | Imported; status bar shows 0 errors, 0 warnings |
| BPMN lint | `bpmnlint` 11.14.0, recommended rules | 0 errors, **2 warnings**: the rule `no-inclusive-gateway` flags the inclusive split and join as a discouraged element type. They are kept deliberately (see L7) |
| XML well-formedness, element typing, ID references | Python XML parser; `bpmn-moddle` 10.3.1 | 0 warnings; all 763 references resolve |
| Sequence-flow source/target, dead ends, reachability from start and to an end, gateway joins and splits, parallel and inclusive split/join match, boundary-event attachment, compensation links, sub-process error caught by a matching boundary, loop bounds, lane membership, message flows only between the process and the external pool, diagram completeness | Custom script (not in this repository) | All checks passed: 90 main-level nodes, 92 flows, 30 gateways; 6 loops, all counter-bounded |
| Diagram labels quoted in the register and justification exist in the model | Script comparison | All match |

Not performed: validation against the OMG BPMN 2.0 XSD, and execution or simulation on a process engine.

**About the PNG.** The three diagrams were exported as SVG by Camunda Modeler 5.52.0 with this file open (triggered by script rather than through the *File → Export as image* menu), placed one above the other under one-line headings, and converted to a single PNG. Nothing in the diagrams was redrawn.

## Known limitations

- Descriptive, not executable; counters in the conditions are not incremented by dedicated tasks.
- Withdrawal (L10) is caught at the two longest waits, underwriting review and the open offer. The brief's outline asks for withdrawal at any stage; other stages are not covered.
- L5 and L6 share one counter-offer path; the diagram does not distinguish a score shortfall from an income shortfall.
- A valuation shortfall and an unclear title (L8) are judged in the underwriter's decision rather than at a gateway directly after the valuation task.
- The message flows attach to the collapsed bureau sub-process, not to the service task inside it.
- A terminate end does not run compensation, so the processing fee is not reversed on a fraud or identity rejection.
- The committee's decision has a reminder but no hard deadline.
- The diagram is wide and several flows cross lanes vertically; a few labels sit close to flow lines.
