# ADR 0015: One selected shared monitor owner

Status: Accepted for issue #31 implementation.

## Context

The shared agent-state release owns lifecycle interpretation. Pixoo already owns
one backend, media library, player and device writer. Downstream consumers need
the same session operations before and after standalone migration.

## Decision

Embed the pinned release behind `SessionSource` with private monitor-only SQLite
storage. Hold an exclusive OS-managed SQLite lease for the owner's lifetime;
commit sessions, metadata and diagnostic journal changes in one transaction.
Keep controller storage separate. Source configuration chooses either the
embedded owner or one authenticated numeric-loopback remote endpoint.

Every monitor read and operation uses that selected source. Reuse HTTP admission,
credential validation, command receipts and SSE delivery. Monitor credentials
have a separate store. Browser, native-controller and monitor streams share the 16-client cap
so streams cannot occupy the complete request-admission budget.

Quiesce produces a versioned export and restart fence. Explicit process shutdown
precedes destination import and endpoint switching. Remote loss exposes stale
state and cannot start a reducer. Rollback requires verified replacement shutdown
and current exported state; no cross-platform shared database or automatic fallback.

## Consequences

The host adds persistence/transport, not another reducer or device writer.
Operators own cross-host exclusion during migration. The process lease enforces
same-store exclusivity, while the restart fence protects ordinary cutover. Shared
source checks and simulator tests do not qualify installed hooks or devices.
The existing simulator default and explicit device mode remain unchanged, as
confirmed by the user during this delivery.
