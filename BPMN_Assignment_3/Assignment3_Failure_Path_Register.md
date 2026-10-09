# Failure Path Register — Assignment 3

Model: [`Assignment3_BPMN_Diagram.bpmn`](Assignment3_BPMN_Diagram.bpmn) · Diagram: [`Assignment3_BPMN_Diagram.png`](Assignment3_BPMN_Diagram.png)

Every row maps to elements that exist in the diagram. Labels in the last column are the exact `name` values in the BPMN file; a branch is written as *gateway → "branch label"*. Limits are enforced by the condition on the gateway branch (`conditionExpression` in the XML).

## Register

| ID | Failure point | Trigger / cause | Detection | BPMN construct | Recovery / resolution | Retry / deadline limit | Final outcome | Diagram labels |
|---|---|---|---|---|---|---|---|---|
| **L1** | Document check | Incomplete or illegible documents | Business rule task; exclusive gateway | Exclusive gateway (3 branches) + user task + interrupting timer boundary + loop | Applicant receives the list of missing items and resubmits; the check runs again | **7 days** to respond; max **2** rounds (`docRounds < 2`) | Continues, **or** end "Application lapsed – documents not provided", **or** end "Rejected – documents incomplete" | `Check Document Completeness` → `Documents complete?` → "No – list missing items (rounds < 2)" → `Provide Missing Documents` (boundary `7 days: no response`); "No – 2 rounds used" → `Rejected – documents incomplete` |
| **L2** | KYC verification | Identity details do not match official records | Screening result gateway | Exclusive gateways + user task + terminate end event | Loan officer verifies the identity manually. Resolved: the branch rejoins the parallel verification. Unresolved: the application is rejected with a reason code | One manual verification | Continues, **or** end "Rejected – identity not verified" | `Run KYC & AML Screening` → `Screening result?` → "Flagged" → `Flag type?` → "Identity mismatch" → `Verify Identity Manually` → `Identity resolved?` → "No" → `Rejected – identity not verified` |
| **L3** | Fraud / AML screening | Forged documents, AML or sanctions-list hit | Screening result gateway | Exclusive gateways + collapsed sub-process + user task + terminate end event | Fraud & Compliance investigates. Confirmed: internal report is filed and the whole application is terminated. Not confirmed: the branch rejoins | One investigation | Continues, **or** end "Rejected – fraud / AML confirmed" | `Flag type?` → "Fraud / AML" → `Fraud / AML Investigation` (inside: `Review Alert & Application Documents` → `Check Sanctions Lists & Source Documents` → `Record Investigation Finding`) → `Fraud / AML confirmed?` → "Yes" → `File Internal Report` → `Rejected – fraud / AML confirmed` |
| **L4** | Credit bureau call | API timeout or bureau down | Error boundary event on the service task inside the sub-process | Sub-process with error boundary event, retry loop with timer, error end event; error boundary on the sub-process; user task fallback | The call is retried after a wait. When retries are used up the sub-process ends with an error and the loan officer performs a manual credit check | Max **3** retries (`bureauRetries < 3`), 10 minutes apart | Report obtained automatically or manually; process continues | Sub-process `Retrieve Credit Bureau Report`: `Request Credit Report from Bureau` (boundary `API timeout / bureau down`) → `Retries < 3?` → `Wait 10 min` / `Bureau unavailable`. Main: boundary `Bureau unavailable after 3 retries` → `Perform Manual Credit Check` |
| **L5** | Credit score / risk | Score below cutoff | Business rule task; exclusive gateways | Exclusive gateways + send task + user task + timer boundary | If a counter-offer is possible (guarantor, collateral, smaller amount) it is sent; otherwise the application is rejected with reasons | One counter-offer (`counterOffers < 1`); **7 days** to reply | Re-scored, **or** end "Rejected – credit criteria not met", "Closed – counter-offer declined" or "Application lapsed – no reply to counter-offer" | `Score Eligibility & Risk` → `Risk decision?` → "Below cutoff or DTI too high" → `Counter-offer possible (first time)?` → "Yes" → `Send Counter-Offer` → `Accept or Decline Counter-Offer` (boundary `7 days: no response`) → `Counter-offer accepted?`; "No" → `Rejected – credit criteria not met` |
| **L6** | Income / DTI | Insufficient income or debt-to-income ratio too high | Same business rule task and gateways as L5 | Same path as L5; the counter-offer is a reduced amount or longer tenure | An accepted counter-offer loops back to re-scoring once; a second shortfall is rejected | Re-scoring **once** (`counterOffers < 1`) | Re-scored, **or** rejected | `Counter-offer accepted?` → "Yes – re-score" → `Score Eligibility & Risk`; second time `Counter-offer possible (first time)?` → "No" |
| **L7** | High-value / borderline case | Amount above the underwriter's authority, or borderline score | Underwriter's decision; exclusive gateways. Extra checks selected by an inclusive gateway | Inclusive gateway (split and join) + exclusive gateways + user task + non-interrupting timer boundary | Before review, the inclusive gateway adds the checks policy requires (collateral valuation for secured loans, enhanced due diligence above a threshold). Cases above authority or borderline are escalated to the senior credit committee, with an SLA reminder | **3-day** SLA reminder | Approved, **or** end "Rejected by credit committee – reasons sent" | `Extra checks required?` → "Secured loan" / "Amount above EDD threshold" / "No extra checks" → `Review Case & Decide` → `Underwriter decision?` → "Reject or refer" → `Above authority or borderline?` → "Yes" → `Decide Escalated Case (Senior Credit Committee)` (boundary `3-day SLA exceeded` → `SLA reminder sent to committee`) → `Committee decision?` |
| **L8** | Collateral valuation | Valuation lower than expected, or title issues | Valuation task result, judged in the underwriter's decision | User tasks + exclusive gateway + bounded loop | Shortfall: collateral is revalued, the loan amount reduced to the loan-to-value limit, and the case re-underwritten. Unclear title: rejected | Re-underwriting **once** (`revaluations < 1`) | Re-underwritten, **or** end "Rejected by underwriter – reasons sent" | `Value Collateral & Verify Title` → `Underwriter decision?` → "Valuation shortfall (first time)" → `Revalue Collateral & Reduce Loan Amount` → `Review Case & Decide`; "Reject or refer" → `Above authority or borderline?` → "No – reject" → `Rejected by underwriter – reasons sent` |
| **L9** | Offer acceptance | Applicant does not respond within the offer validity | Interrupting timer boundary on the receive task | Receive task + timer boundary event + message end event | The offer expires and the applicant is told | **15 days** | End "Offer expired" | `Receive Offer Acceptance` boundary `15 days: offer validity over` → `Offer expired` |
| **L10** | Withdrawal | Applicant cancels the application | Interrupting message boundary events | Message boundary events + compensation (throw event, boundary event, handler) | Compensation reverses the processing fee and releases holds; the application closes as withdrawn | Caught during underwriting review and while the offer is open | End "Withdrawn – fees reversed" | Boundary `Withdrawal received` on `Review Case & Decide` and on `Receive Offer Acceptance` → `Reverse fees & release holds` → `Withdrawn – fees reversed`. Compensation: boundary `Undo fee` on `Collect Processing Fee & Place Hold` → `Reverse Processing Fee & Release Holds` |
| **L11** | E-signature | Agreement not signed, or signature mismatch | Timer boundary on the signing task; exclusive gateway on validity | Timer boundary + exclusive gateways + send task + bounded loop | The agreement is resent with a reminder. After two failed attempts the offer is cancelled and the applicant notified | **5 days** per attempt; max **2** attempts (`signAttempts < 2`) | Signed, **or** end "Offer cancelled – agreement not signed" | `E-Sign Loan Agreement` (boundary `5 days: not signed`) → `Signature valid?` → "No – mismatch" → `Signing attempts < 2?` → "Yes – resend & remind" → `Resend Agreement & Reminder`; "No" → `Offer cancelled – agreement not signed` |
| **L12** | Disbursement | Invalid bank account or payment gateway error | Error boundary event on the disbursement service task | Error boundary + user task + bounded loop + compensation | Operations verify the bank account and the payment is retried. If it still fails, compensation reverses the loan account creation, funds are held and the applicant contacted | Max **2** retries (`disbursementRetries < 2`) | Disbursed, **or** end "Closed – disbursement failed, funds held" | `Disburse Funds to Verified Account` boundary `Invalid account / payment gateway error` → `Verify Bank Account Details` → `Disbursement retries < 2?` → "Yes – retry"; "No" → `Reverse loan account` → `Hold Funds & Contact Applicant` → `Closed – disbursement failed, funds held`. Compensation: boundary `Undo account` on `Create Loan Account` → `Reverse Loan Account Creation` |

## Bounded loops

| Loop | Condition | Limit | At the limit |
|---|---|---|---|
| Missing documents (L1) | `docRounds < 2` | 2 rounds | `Rejected – documents incomplete` |
| Bureau retries (L4) | `bureauRetries < 3` | 3 retries | `Bureau unavailable` → `Perform Manual Credit Check` |
| Counter-offer and re-score (L5, L6) | `counterOffers < 1` | 1 counter-offer | `Rejected – credit criteria not met` |
| Revaluation and re-underwrite (L8) | `revaluations < 1` | 1 revaluation | Decision falls to "Reject or refer" |
| E-signature (L11) | `signAttempts < 2` | 2 attempts | `Offer cancelled – agreement not signed` |
| Disbursement (L12) | `disbursementRetries < 2` | 2 retries | `Closed – disbursement failed, funds held` |

## End events

| Outcome | End event label | Type |
|---|---|---|
| Disbursed | `Loan disbursed` | None end |
| Rejected | `Rejected – documents incomplete` | Message end |
| Rejected | `Rejected – identity not verified` | Terminate end |
| Rejected | `Rejected – fraud / AML confirmed` | Terminate end |
| Rejected | `Rejected – credit criteria not met` | Message end |
| Rejected | `Rejected by underwriter – reasons sent` | Message end |
| Rejected | `Rejected by credit committee – reasons sent` | Message end |
| Withdrawn | `Withdrawn – fees reversed` | Message end |
| Withdrawn | `Closed – counter-offer declined` | None end |
| Lapsed | `Application lapsed – documents not provided` | Message end |
| Lapsed | `Application lapsed – no reply to counter-offer` | Message end |
| Lapsed | `Offer expired` | Message end |
| Lapsed | `Offer cancelled – agreement not signed` | Message end |
| Failed | `Closed – disbursement failed, funds held` | None end |
| (side branch) | `SLA reminder sent to committee` | Message end – ends only the non-interrupting reminder token |
| (sub-process) | `Alert investigated`, `Credit report received` | None end |
| (sub-process) | `Bureau unavailable` | Error end – caught by boundary `Bureau unavailable after 3 retries` |

## Assumptions

The brief gives: the 7-day document timer, 3 bureau retries, re-scoring once, the 15-day offer validity (as an example) and 2 signing attempts. Assumed in this model: 2 document rounds, a 10-minute wait between bureau retries, 7 days to answer a counter-offer, a 3-day committee SLA, 5 days per signing attempt and 2 disbursement retries.
