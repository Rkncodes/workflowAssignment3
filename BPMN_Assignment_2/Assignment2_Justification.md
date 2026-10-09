# Task and Gateway Justification — Assignment 2

Model: [`Assignment2_BPMN_Diagram.bpmn`](Assignment2_BPMN_Diagram.bpmn). Labels in `code style` are the exact names in the diagram.

## 1. Task types

| Task type | Where | Why |
|---|---|---|
| **User task** | `Create Shipment Booking` (shipper); `Collect & Scan Parcel` (pickup agent); `Scan & Inspect at Destination Hub`, `Inspect & Document Damage`, `Update Scan Record Manually` (hub); `Attempt Delivery & Capture Proof of Delivery` (delivery agent); `Provide Corrected Address` (recipient); `Submit Customs Declaration`, `Reroute or Assign Vehicle & Update ETA`, `Stop Movement & Return Parcel to Shipper` (control tower); `Trace Missing Parcel` (claims) | A person does the work and records the result in a system (booking portal, handheld scanner, control-tower console). The recorded result is what the following gateway reads. |
| **Manual task** | `Receive & Sort at Origin Hub`, `Dispatch Line-Haul to Destination Hub`, `Hold Parcel at Depot for Collection`; in the return sub-process `Line-Haul Parcel Back to Origin Hub`, `Hand Over Parcel to Shipper` | Purely physical handling with no system form of its own. Marking these as manual separates moving the parcel from recording information about it. |
| **Business rule task** | `Validate Booking & Calculate Charges` | Serviceability, weight limits, service level and tariff are rules that change without the process changing. |
| **Service task** | `Confirm Booking & Collect Charges`, `Schedule Pickup & Assign Driver`, `Register Scan & Update Tracking`, `Reconcile Tracking Records`, `Close Shipment & Generate Invoice`, `Declare Lost & Pay Compensation`, `Refund Charges less Cancellation Fee`; in sub-processes `Issue Refund`, `Adjust Charges (return fee / COD reversal)` | Automated system work. `Register Scan & Update Tracking` is the one that can fail technically, so it carries the error boundary event. |
| **Send task** | `Notify Shipper: Parcel Picked Up`, `Notify Customer of Delay`, `Request Customs Documents from Shipper`, `Notify Recipient: Out for Delivery`; in sub-processes `Notify Shipper of Claim Outcome`, `Notify Shipper of Return` | The step exists only to send a message. |
| **Receive task** | `Receive Customs Documents` | The process waits for one specific reply to the request it has just sent; the timer boundary on it gives the 5-day limit. This is the send/receive pair the customs hold calls for. |
| **Collapsed sub-process** | `Return Parcel to Sender`, `Handle Damage Claim` | The return is reached from five different failures (customs, depot timeout, refusal / COD failure, uncorrectable address, no reply about the address), so it is modelled once and reused. The claim groups assessment and its three resolutions. |

The brief has no system lane. Automated tasks are placed in the lane of the unit that operates the system: control tower (booking, tracking, billing), hub (reconciliation) and claims (compensation).

## 2. Gateways

### Exclusive gateways

Each is a choice of one path from data recorded by the preceding task: `Booking valid?`, `Parcel collected?`, `Pickup attempts < 2?`, `Parcel intact?`, `International shipment?`, `Customs cleared?`, `Delivery outcome?`, `Reason?`, `Delivery attempts < 3?`, `Outside original delivery zone?`, `Shipment insured?`, and `Resolution?` inside the claim sub-process.

The delivery result is split over two gateways so that no gateway has more than three labelled branches: `Delivery outcome?` (delivered / damage found / not delivered) and then `Reason?` (recipient unavailable / wrong address / refused or COD failed). Unlabelled exclusive gateways are merges only; no gateway both joins and splits.

### Parallel gateway

After a successful pickup two things happen independently and both must finish before line-haul: the hub receives and sorts the parcel, and the system registers the scan, updates tracking and notifies the shipper. A parallel split and a matching parallel join enclose exactly these two branches. The scan-failure fallback (E9) rejoins its own branch before the join, so the join always receives both tokens.

### Event-based gateway

`Await line-haul event` is the centre of the transit phase. Once the parcel is dispatched the process cannot decide anything from data; it waits for whichever happens first: `Arrival scan at destination hub`, `Delay reported`, `Cancellation requested`, or `No scan event for 48 h`. That is a race between external events, which is the definition of an event-based gateway. Delay handling and a successful trace both lead back to the same gateway, so the process keeps waiting until the parcel arrives, is cancelled, or is declared lost.

An inclusive gateway is not used: there is no step where several optional paths may be taken together.

## 3. Events

- **Timer boundary events (interrupting):** `5 days: documents not provided` on the receive task, `7 days: not collected` on the depot hold, `2 days: no reply` on the address request, `5 days: not found` on tracing. Each ends a wait that has gone on too long and moves the parcel to its fallback.
- **Timer catch event:** `No scan event for 48 h` after the event-based gateway. It is a catch event rather than a boundary event because the wait is not attached to a task.
- **Error boundary event:** `Scan / tracking system failure` on the service task only. Pickup failure, refusal and damage are expected business outcomes and are gateway branches, not errors, because a person reports them through the normal task result.
- **Message events:** catch events for `Delay reported` and `Cancellation requested`; throw events `Address query sent to recipient` and `Address-change surcharge advised`; message end events where the last action is a notice to the shipper.
- **Compensation:** `Confirm Booking & Collect Charges` has the compensation boundary `Undo charges` linked to `Refund Charges less Cancellation Fee`. Both cancellation paths (E1 and E10) trigger it with a compensation throw event `Refund less cancellation fee`. Compensation fits because the charge was completed correctly earlier and is now being reversed for a business reason.

## 4. Loops and limits

All loops are explicit flows through merge gateways. Four are bounded by a counter on the exit gateway (booking 3, pickup 2, delivery 3, address correction 1). Two are driven by external events: the delay loop needs a new delay message for every pass, and the tracing loop needs the 48-hour timer and is itself capped at 5 days. See the [register](Assignment2_Failure_Path_Register.md#bounded-loops).

## 5. Escalation

Escalation is to a more capable role rather than by an escalation event: a scan failure goes to the hub supervisor, a delay to the control tower, a missing parcel to the claims department, and repeated delivery failure to the depot and then the return sub-process.

## 6. End events

One end event per distinct final state (delivered, returned, lost, three kinds of cancelled, two kinds of damage closure), so the outcome of a shipment can be read from where it ended. No terminate end event is needed: the only parallel section is closed by its join before any end event can be reached.

## 7. Pool and lanes

One pool with the seven participants as lanes, so communication appears as send tasks and message events rather than message flows. The recipient is a lane because the only thing the recipient does in the process is answer the address query.
