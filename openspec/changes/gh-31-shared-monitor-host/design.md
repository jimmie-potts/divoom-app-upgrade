## Context

See proposal.md. Agent-state 1.0.0 is published at hub commit f550bcd6b7d3b7da0f34c90c622b343afe2b25fb. Its Storage interface requires exclusive leasing and atomic revision-checked commits. Pixoo already has bounded HTTP admission, machine credentials, command receipts and SSE replay.

## Goals / Non-Goals

Goals: keep state interpretation in the released package; supply private durable storage and a single selected source for every consumer operation. Preserve failure uncertainty and independent consumer delivery.

Non-goals: install hooks, migrate personal data, implement monitor rendering/UI, start a standalone daemon, or contact devices.

## Decisions

- Keep monitor state under a distinct private agent-monitor directory. SQLite transactions implement durable commits; an exclusive lock held for the owner's lifetime prevents a second process. Refuse mounted Windows storage from Linux. Controller/library storage remains unchanged.
- Enable monitoring explicitly. Embedded configuration fixes owner identity and registered consumer policies. Remote configuration fixes one numeric loopback endpoint and credential; it never opens local shared state. No discovery, redirects or automatic fallback.
- Reuse existing machine credential validation with a separate credential store. Reads require read/control; mutations require control. Preserve Host/Origin/native request-header checks. Use the existing Commands ledger for explicit operations; producer envelopes retain the shared engine's identity/deduplication semantics.
- Generalize the existing Events route registration for monitor SSE. Bound clients/history/backpressure with the existing policy; each consumer is isolated. Remote reads refresh from the selected owner and retain visibly stale snapshots on failure; mutations never retry with new identities.
- Quiesce drains admitted work before export and persists a restart fence. Import requires an empty destination and retains identity, revision, labels and notices. Release old ownership before activating a new host. Rollback requires stopping the new owner and using its latest export if it accepted writes.
- Keep provider normalization/emission in the released package. Authentication and private configuration are host glue; the package's unauthenticated example hook is not a production admission path.
- Consume Hub #30's frozen Linux source budgets and bounded queue limits. Its later Linux-only decision supersedes historical Windows forwarding measurements; existing repository CI remains unchanged.

## Risks / Trade-offs

- Storage failure or interruption: atomic transactions preserve the preceding state; admission faults closed and never reports a durable success prematurely.
- Cross-platform database access: private local storage and explicit export/import only; never coordinate owners through a mounted live database.
- Remote loss: expose stale/unavailable status without reducer fallback. Remote destination is an operator-configured trusted endpoint, never request input.
- Large snapshots: cap response/import bytes at the shared 16 MiB validation limit; use bounded delivery history.
- Migration cannot prove another machine is stopped: operator handoff is explicit and documented; local leases and restart fences enforce local exclusivity.

## Migration Plan

Keep monitoring disabled until private configuration and scoped credentials exist. Quiesce/export, stop the old owner, import into empty private storage, and explicitly switch the facade/producer endpoint. Preserve a quiesced old copy for rollback. Do not automatically reopen it. Source delivery exercises this with disposable local hosts only.
