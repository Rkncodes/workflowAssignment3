# Assignment 2 — Logistics & Shipment Exception Management

BPMN 2.0 model of a courier shipment from booking to its final state, with emphasis on how exceptions are detected and resolved.

| File | Contents |
|---|---|
| [`Assignment2_BPMN_Diagram.bpmn`](Assignment2_BPMN_Diagram.bpmn) | Editable BPMN 2.0 model (main process and two sub-process diagrams) |
| [`Assignment2_BPMN_Diagram.png`](Assignment2_BPMN_Diagram.png) | Diagram export: main process, with both sub-processes below it |
| [`Assignment2_Failure_Path_Register.md`](Assignment2_Failure_Path_Register.md) | Complete Failure Path Register, loop limits, end events, assumptions |
| [`Assignment2_Justification.md`](Assignment2_Justification.md) | Detailed justification of task types, gateways and events |

## Diagram

![Logistics & Shipment Exception Management – BPMN diagram](Assignment2_BPMN_Diagram.png)

The diagram is wide, so GitHub scales it down here. **[Open the full-size diagram](Assignment2_BPMN_Diagram.png)** and zoom in to read the labels. The upper part is the main process. Below it are the two sub-processes that appear as collapsed boxes in the main process: **Return Parcel to Sender** and **Handle Damage Claim**.

## Overview

A shipper books a shipment. The booking is validated and charged, a pickup is scheduled, and the parcel is collected. It is sorted at the origin hub while tracking is updated, travels by line-haul to the destination hub, clears customs if international, goes out for delivery and is handed over against proof of delivery. The shipment is then closed and invoiced.

- **Starts when** a shipper books a shipment.
- **Ends when** the shipment is delivered and closed, returned to sender, or closed as lost, cancelled or damaged.

### Participants

One pool with seven lanes:

| Lane | Responsibility |
|---|---|
| Shipper / Customer | Creates and corrects the booking |
| Control Tower / Dispatcher | Validation, charging, scheduling, tracking, customs, delay and cancellation handling, closing |
| Pickup Agent | Collects and scans the parcel |
| Hub / Warehouse | Sorting, line-haul dispatch, destination scan, damage inspection, depot hold, returns |
| Delivery Agent | Delivery attempt and proof of delivery |
| Recipient | Supplies a corrected address when asked |
| Claims Department | Tracing, loss compensation, damage claims |

### Happy path

`Create Shipment Booking` → `Validate Booking & Calculate Charges` → `Confirm Booking & Collect Charges` → `Schedule Pickup & Assign Driver` → `Collect & Scan Parcel` → in parallel: `Receive & Sort at Origin Hub` and `Register Scan & Update Tracking` + `Notify Shipper: Parcel Picked Up` → `Dispatch Line-Haul to Destination Hub` → `Await line-haul event` → `Arrival scan at destination hub` → `Scan & Inspect at Destination Hub` → `Notify Recipient: Out for Delivery` → `Attempt Delivery & Capture Proof of Delivery` → `Close Shipment & Generate Invoice` → **Shipment delivered & closed**.

## Failure-path summary

Full detail, with exact diagram labels, is in the [register](Assignment2_Failure_Path_Register.md).

| ID | Failure | BPMN solution | Limit | Outcome |
|---|---|---|---|---|
| E1 | Pickup fails (shipper absent, parcel not ready) | Exclusive gateways, reschedule loop, compensation refund | 2 attempts | Rescheduled, or cancelled with fee |
| E2a | Invalid address / booking data at booking | Business rule task, gateway, return to shipper | 3 attempts | Corrected, or cancelled |
| E2b | Wrong address at the doorstep | Message to recipient, user task with timer, surcharge gateway | 2 days; 1 correction | Redelivery, or return to sender |
| E3 | Damaged parcel (hub or doorstep) | Inspection task, insured? gateway, claims sub-process | — | Claim settled, or damage recorded |
| E4 | Lost parcel | 48-hour timer after event-based gateway, tracing with 5-day timer | 48 h; 5 days | Transit resumes, or lost and compensated |
| E5 | Delay in transit | Delay message after event-based gateway; notify, reroute, update ETA | Event-driven | Back to waiting for arrival |
| E6 | Customs hold | Send task, receive task, 5-day timer boundary | 5 days | Continues, or return to sender |
| E7 | Recipient unavailable | Counter loop, depot hold with timer boundary | 3 attempts; 7 days | Delivered, or return to sender |
| E8 | Refusal / COD failure | Gateway to the return sub-process, charges adjusted | — | Returned to sender |
| E9 | Scan / tracking failure | Error boundary event, manual update, reconciliation task | — | Process continues |
| E10 | Cancellation after dispatch | Cancellation message after event-based gateway, recall, compensation | While in line-haul | Cancelled, parcel returned |

## Task and gateway justification

Summary; details in the [justification document](Assignment2_Justification.md).

- **Task types.** User tasks where a person records a result in a system; manual tasks for pure physical handling (sorting, line-haul, depot hold); one business rule task for booking validation and tariff; service tasks for automated charging, scheduling, tracking and invoicing; send tasks for notifications; a receive task for the customs documents.
- **Exclusive gateways** for every data-based decision. The delivery result uses two gateways in sequence so each has at most three clearly labelled branches.
- **Parallel gateway** (matched split and join) after pickup: physical sorting and the tracking update with shipper notification run together.
- **Event-based gateway** for the line-haul: the process waits for arrival, a delay report, a cancellation or 48 hours without a scan, whichever comes first.
- **Timer boundary events** end waits that run too long (customs documents, depot hold, address reply, tracing).
- **Error boundary event** only for the technical scan failure; business failures are gateway branches.
- **Compensation** refunds the collected charges less the fee on both cancellation paths.
- **Sub-processes** for the return to sender (reused by five failures) and the damage claim.

## Validation

Checks run on the committed BPMN file:

| Check | Tool | Result |
|---|---|---|
| Opens and imports all three diagrams | Camunda Modeler 5.52.0 | Imported; status bar shows 0 errors, 0 warnings |
| BPMN lint | `bpmnlint` 11.14.0, recommended rules | 0 errors, 0 warnings |
| XML well-formedness, element typing, ID references | Python XML parser; `bpmn-moddle` 10.3.1 | 0 warnings; all 710 references resolve |
| Sequence-flow source/target, dead ends, reachability from start and to an end, gateway joins and splits, parallel split/join match, event-based gateway targets, boundary-event attachment, compensation links, loop bounds, lane membership, diagram completeness | Custom script (not in this repository) | All checks passed: 78 main-level nodes, 86 flows, 26 gateways; 5 loops, 3 counter-bounded and 2 event-driven |
| Diagram labels quoted in the register and justification exist in the model | Script comparison | All match |

Not performed: validation against the OMG BPMN 2.0 XSD, and execution or simulation on a process engine.

**About the PNG.** The three diagrams were exported as SVG by Camunda Modeler 5.52.0 with this file open (triggered by script rather than through the *File → Export as image* menu), placed one above the other under one-line headings, and converted to a single PNG. Nothing in the diagrams was redrawn.

## Known limitations

- Descriptive, not executable; counters in the conditions are not incremented by dedicated tasks.
- A single line-haul leg is modelled. The brief's outline suggests a multi-instance sub-process per leg; that is not modelled.
- The 48-hour no-scan timer, delay and cancellation are handled during line-haul only. Cancellation before pickup or during last-mile delivery is not modelled.
- The scan-failure fallback (E9) is modelled on the pickup scan, not on every scan in the process.
- Damage found at the origin hub is not modelled separately; damage is detected at the destination hub and at the doorstep.
- There is no system lane in the brief, so automated tasks sit in the lane of the unit that runs the system.
- The diagram is wide and several flows cross lanes vertically; a few labels sit close to flow lines.
