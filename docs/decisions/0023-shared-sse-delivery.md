# ADR 0023: Private shared SSE client delivery

## Status

Accepted for [issue #81](https://github.com/jimmie-potts/divoom-app-upgrade/issues/81).

## Context

Browser/monitor Events and native ControllerEvents duplicated queues,
authorization, heartbeat/drain timers and cleanup. They have distinct protocols
and some distinct blocked-write behavior. The extraction must preserve both.

## Decision

Use one private SseDelivery component for already encoded messages. It owns
client queues, optional authorization, timers, blocked writes and removal.
The existing feed classes retain snapshots, signatures, event history, cursor
namespaces/parsing, replay/resync decisions and envelopes. Authentication wiring
stays at existing call sites; admission-only browser feeds do not acquire a
continuous credential callback.

Reserve native clients before asynchronous catalog and authentication work.
Activate delivery only after the feed writes SSE headers. Publication and timers
ignore reservations that are not ready. The HTTP security layer still owns the
16-stream mixed-feed/HEAD and 32-request limits; feed-local pools remain bounded.

Preserve two explicit blocked-write policies. Authenticated browser delivery
checks blocked state after authorization and skips writes for empty rechecks;
a drain during the next authorization can permit delivery. Native delivery
rejects enqueue while blocked and terminates immediately when a false write
leaves queued messages. Its one-second recheck may therefore close a blocked
connection before the five-second drain ceiling. Unauthenticated browser writes
remain synchronous.

All authenticated queues retain their 32-entry bound, including the item waiting
for authorization. Rechecks run each second and heartbeats every 15 seconds,
relative to feed creation. Each blocked write keeps its five-second deadline.
Removal clears queued data, drain timers/listeners and feed-local reservations.
Shutdown stops heartbeat timers and ends clients. Late authorization completion
cannot write for a removed client; authorization rejection terminates delivery.

## Consequences and recovery

A change to shared delivery mechanics has one implementation and focused tests,
while the two protocol owners remain independent. A generalized public protocol
or cross-project transport package would exceed this maintenance scope.

Publishing never awaits a slow client's authentication. Disconnect does not stop
playback, ingestion or commands. Reconnection uses each feed's existing retained
cursor replay/resync; it never replays commands or refreshes physical evidence.
No persistent format, credential policy, package pin, state owner or device writer
changes. Source rollback requires no data migration, installation or device work.
