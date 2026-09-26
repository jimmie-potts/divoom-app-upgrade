# ADR 0022: Typed command observations

## Status

Accepted for [issue #80](https://github.com/jimmie-potts/divoom-app-upgrade/issues/80).

## Context

ControllerState previously interpreted the ledger's replay payload tuples and
cast completion results. That made replay serialization an implicit observer
interface. Browser, MCP and native commands still need the same ledger and sole
player/device writer described by [ADR 0013](0013-hub-controller-api.md).

## Decision

Pass typed operation metadata separately from the unchanged replay fingerprint.
An operation map correlates each input and result with pending, successful and
failed observation variants. ControllerState handles application variants
exhaustively. Integration and local-only player commands remain explicit without
inventing native controller v1 representations. The shared monitor owner uses a
separate ledger instance and its own operation type.

Keep reservation and pending notification synchronous, defer the action as
before, and mark/prune completion before notifying observers. Replays return the
original promise and emit no second lifecycle. Synchronous observer exceptions
remain isolated; the ledger does not promise async observer isolation or freeze
results. Public service boundaries continue cloning retained receipts.

## Consequences

Producer/result changes now expose affected observers during typechecking.
A narrow assertion constructs the generic event union inside the ledger; consumers
need no replay-tuple or result casts. No event bus or additional owner is added.

Pending accounting remains endpoint-dependent in ControllerState. Async request
context still follows uploads, retries and traversal. Late transport completion
keeps its initiating request and generation without reviving retired playback.
Timeouts, cancellation, native guards, 32 pending slots, 256 completed receipts,
public responses and failure projection remain unchanged.

No persistent format changes. Restart still starts a fresh command epoch and
restores playback paused. Recovery uses existing snapshot reconciliation and
explicit intent. This source change performs no installation or device operation.
