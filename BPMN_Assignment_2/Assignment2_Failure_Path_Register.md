# Failure Path Register — Assignment 2

Model: [`Assignment2_BPMN_Diagram.bpmn`](Assignment2_BPMN_Diagram.bpmn) · Diagram: [`Assignment2_BPMN_Diagram.png`](Assignment2_BPMN_Diagram.png)

Every row maps to elements that exist in the diagram. Labels in the last column are the exact `name` values in the BPMN file; a branch is written as *gateway → "branch label"*. Limits are enforced by the condition on the gateway branch (`conditionExpression` in the XML).

## Register

| ID | Failure point | Trigger / cause | Detection | BPMN construct | Recovery / resolution | Retry / deadline limit | Final outcome | Diagram labels |
|---|---|---|---|---|---|---|---|---|
| **E1** | Pickup | Shipper absent or parcel not ready | Pickup agent records the result; exclusive gateway | Exclusive gateways + bounded loop + compensation throw event | Pickup is rescheduled. After two failed attempts the booking is cancelled; compensation refunds the charges less the cancellation fee | Max **2** pickup attempts (`pickupAttempts < 2`) | Back to scheduling, **or** end "Cancelled – pickup failed" | `Collect & Scan Parcel` → `Parcel collected?` → "No – shipper absent / parcel not ready" → `Pickup attempts < 2?` → "Yes – reschedule" → `Schedule Pickup & Assign Driver`; "No" → `Refund less cancellation fee` → `Cancelled – pickup failed` |
| **E2a** | Address validation at booking | Incomplete or unserviceable address, weight or service level | Business rule task; exclusive gateway | Business rule task + exclusive gateway (3 branches) + loop | Booking is returned to the shipper for correction | Max **3** booking attempts (`bookingAttempts < 3`) | Back to booking, **or** end "Cancelled – invalid booking" | `Validate Booking & Calculate Charges` → `Booking valid?` → "No – return to shipper (attempts < 3)" → `Create Shipment Booking`; "No – 3 attempts used" → `Cancelled – invalid booking` |
| **E2b** | Address at the doorstep | Address wrong or incomplete on delivery | Delivery agent records the reason; exclusive gateway | Message throw event + user task + timer boundary + exclusive gateway + message throw event | Recipient is asked for the corrected address. If the new address is outside the original zone a surcharge is advised; delivery is attempted again | **2 days** to reply; **1** correction (`addressCorrections < 1`) | Redelivery, **or** return to sender (no reply, or address still wrong) | `Reason?` → "Wrong address (first correction)" → `Address query sent to recipient` → `Provide Corrected Address` (boundary `2 days: no reply`) → `Outside original delivery zone?` → "Yes" → `Address-change surcharge advised` / "No" → redelivery |
| **E3** | Hub scan or delivery | Parcel found damaged | Hub inspection gateway, or delivery outcome gateway | Exclusive gateways + user task + collapsed sub-process | Damage is inspected and documented. Insured: claims sub-process settles by refund, replacement or reshipment and notifies the shipper. Not insured: damage is recorded and the shipper informed | — | End "Closed – damage claim settled" **or** "Closed – damage recorded, shipper informed" | `Parcel intact?` → "No – damage found" / `Delivery outcome?` → "Damage found at doorstep" → `Inspect & Document Damage` → `Shipment insured?` → "Yes" → `Handle Damage Claim` (inside: `Assess Claim & Evidence` → `Resolution?` → `Issue Refund` / `Arrange Replacement` / `Arrange Reshipment` → `Notify Shipper of Claim Outcome`); "No" → `Closed – damage recorded, shipper informed` |
| **E4** | Line-haul | No scan event for 48 hours | Timer event after the event-based gateway | Event-based gateway + timer catch event + user task + interrupting timer boundary + service task | Claims department traces the parcel. Found: the process returns to waiting for the line-haul. Not found in 5 days: parcel is declared lost and compensation paid | **48 h** without scan starts tracing; **5 days** to find | Transit resumes, **or** end "Lost – shipper compensated" | `Await line-haul event` → `No scan event for 48 h` → `Trace Missing Parcel` (boundary `5 days: not found`) → `Declare Lost & Pay Compensation` → `Lost – shipper compensated` |
| **E5** | Line-haul | Weather, strike, breakdown or hub overload | Delay message after the event-based gateway | Event-based gateway + message catch event + send task + user task + loop | Customer is notified, the control tower reroutes or assigns another vehicle and updates the ETA; the process waits again | Event-driven: one pass per delay report | Back to waiting for arrival | `Await line-haul event` → `Delay reported` → `Notify Customer of Delay` → `Reroute or Assign Vehicle & Update ETA` |
| **E6** | Customs (international) | Missing or incorrect documents | Exclusive gateway after the customs declaration | Send task + receive task + interrupting timer boundary | Documents are requested from the shipper. Received: shipment continues. Not received: return to sender | **5 days** to provide documents | Continues, **or** end "Returned to sender" | `International shipment?` → "Yes" → `Submit Customs Declaration` → `Customs cleared?` → "No – held" → `Request Customs Documents from Shipper` → `Receive Customs Documents` (boundary `5 days: documents not provided`) → `Return Parcel to Sender` |
| **E7** | Delivery | Nobody at the address | Delivery agent records the reason; exclusive gateway | Exclusive gateway + counter loop + manual task + interrupting timer boundary | Delivery is attempted again. After three attempts the parcel is held at the depot; if collected it is closed as delivered, otherwise returned | Max **3** delivery attempts (`deliveryAttempts < 3`); **7 days** at depot | Delivered, **or** end "Returned to sender" | `Reason?` → "Recipient unavailable" → `Delivery attempts < 3?` → "Yes" → redelivery; "No – 3 attempts used" → `Hold Parcel at Depot for Collection` (boundary `7 days: not collected`) → `Return Parcel to Sender` |
| **E8** | Delivery | Recipient refuses, or cash-on-delivery payment fails | Delivery agent records the reason; exclusive gateway | Exclusive gateway + collapsed sub-process | Parcel is returned to the sender; charges are adjusted inside the return sub-process | — | End "Returned to sender" | `Reason?` → "Refused, COD failed or address uncorrectable" → `Return Parcel to Sender` (inside: `Line-Haul Parcel Back to Origin Hub` → `Adjust Charges (return fee / COD reversal)` → `Notify Shipper of Return` → `Hand Over Parcel to Shipper`) |
| **E9** | Scan and tracking update | Scanner offline or data mismatch between systems | Error boundary event on the service task | Error boundary event + user task + service task | Hub supervisor updates the scan record manually, then a reconciliation task runs; the flow rejoins before the shipper notification | No retry; one manual update | Process continues | `Register Scan & Update Tracking` boundary `Scan / tracking system failure` → `Update Scan Record Manually` → `Reconcile Tracking Records` |
| **E10** | In transit | Shipper cancels after dispatch | Cancellation message after the event-based gateway | Event-based gateway + message catch event + user task + compensation | Movement is stopped and the parcel returned to the shipper; compensation refunds the charges less the cancellation fee | Accepted while the parcel is in line-haul | End "Cancelled after dispatch – parcel returned" | `Await line-haul event` → `Cancellation requested` → `Stop Movement & Return Parcel to Shipper` → `Refund less cancellation fee` → `Cancelled after dispatch – parcel returned`. Compensation: boundary `Undo charges` on `Confirm Booking & Collect Charges` → `Refund Charges less Cancellation Fee` |

## Bounded loops

| Loop | Condition | Limit | At the limit |
|---|---|---|---|
| Booking correction (E2a) | `bookingAttempts < 3` | 3 attempts | `Cancelled – invalid booking` |
| Pickup reschedule (E1) | `pickupAttempts < 2` | 2 attempts | `Cancelled – pickup failed` |
| Redelivery (E7) | `deliveryAttempts < 3` | 3 attempts | `Hold Parcel at Depot for Collection` |
| Address correction (E2b) | `addressCorrections < 1` | 1 correction | `Return Parcel to Sender` |
| Delay handling (E5) | none – needs a new `Delay reported` message each time | Event-driven | Ends when the arrival scan is received |
| Tracing (E4) | none – needs the 48-hour timer each time | Event-driven; 5 days per trace | `Lost – shipper compensated` |

## End events

| Outcome | End event label | Type |
|---|---|---|
| Delivered | `Shipment delivered & closed` | None end |
| Returned | `Returned to sender` | None end |
| Lost | `Lost – shipper compensated` | Message end |
| Cancelled | `Cancelled – invalid booking` | Message end |
| Cancelled | `Cancelled – pickup failed` | Message end |
| Cancelled | `Cancelled after dispatch – parcel returned` | Message end |
| Damaged | `Closed – damage claim settled` | None end |
| Damaged | `Closed – damage recorded, shipper informed` | Message end |
| (sub-process) | `Parcel returned`, `Claim settled` | None end – normal sub-process completion |

## Assumptions

The brief gives: 2 pickup attempts, the 48-hour no-scan rule, 5 days of tracing, the 5-day customs timer, 3 delivery attempts and 7 days at the depot. Assumed in this model: 3 booking attempts, 2 days for the recipient to supply a corrected address, and one address correction.
