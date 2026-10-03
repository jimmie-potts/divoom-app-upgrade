## Context

See proposal.md for the outcome. Pixoo has a Linux user service, private environment configuration, a serialized device writer, and an offline library backup command. #114 added process-frozen build metadata. Existing backup covers cataloged media, playlists, sessions, checkpoint and device.json; it does not cover all monitoring state or credentials. The shared contracts 1.2.0 artifact owns receipt semantics, not a shared installer implementation.

This design is required because service ownership, private persistence, migration and recovery cross multiple modules.

## Goals / Non-Goals

Goals: one owning command, reusable read-only plan, verified release preparation, a durable operation barrier, compatible recovery and bounded live evidence.

Non-goals: new target discovery, settings migration, Node replacement, a deployment framework, physical probe commands or automatically restoring older data.

## Decisions

1. **Keep the owning command local.** Implement under the existing TypeScript/server tooling with a thin CLI. Reuse library backup and the versioned receipt validator. Follow Hub's plan/inventory/operation separation as a design pattern; do not import Hub's private installer or create a shared installer package.
2. **Build before outage.** Build the exact clean merged revision in a disposable detached checkout, then stage its complete runtime dependency closure beside the installation. Verify every file, mode and safe internal link against a trusted build inventory. A plain git archive is not a build source for revision stamping. Existing same-SHA releases are reused only when verified identical.
3. **Bind authority to facts.** Explicit private configuration names the established installation, unit, environment, data root, Node executable and health endpoint. The plan hashes baseline, configuration and service contract, names all included commits and startup effects, and retains unknowns. The same bound inputs are re-read under the install lock. Standing authority satisfies routine approval; changed external effects remain outside it.
4. **Qualify recovery before stop.** Use a bounded fingerprint of the durable implementation plus isolated candidate-write/previous-reopen tests covering library records, playback, monitoring and settings. Known schema numbers alone are insufficient. Unknown legacy code refuses before outage until its compatibility and process/artifact recovery are qualified. The operation never repairs incompatibility by restoring a stale database.
5. **Separate lock and interrupted-operation barrier.** A process lock prevents simultaneous operations; a durable active-operation record persists past process death and uncertain final receipt writes. Persist/fsync intent before stop. Refuse unresolved operations. Reconciliation reads actual link, process and receipt state before any later mutation.
6. **First adoption preserves history.** Retain a byte/mode/link inventory and dependency closure of the existing copy. Convert only the owned Pixoo current anchor and the unit's verified execution path while the service is stopped. Keep environment values, other unit settings, historical copies and external Node unchanged. Record each boundary and retain original unit bytes for qualified recovery.
7. **Verify without new device commands.** Read existing health/controller connectivity and bind it to the service PID, executable, command line and start time. Hash served artifacts for legacy recovery. Device startup can restore the existing display selection; the installation plan reports that effect. Fake-service tests do not authorize or establish physical acceptance.
8. **Use one operation receipt.** The vendored full semantic validator checks every persisted transition and terminal result. Backups include every named durable file after verified writer exit. A finalization failure leaves the operation barrier and never prunes; recovery preserves latest mutable state. Retention touches only verified owned, unreferenced release directories.

## Risks / Trade-offs

- A previously installed format may be outside the qualified closure → refuse before outage and retain the exact compatibility gap.
- Existing services may have unexpected overrides or detached writers → bind effective service/process evidence and refuse unknown ownership.
- Service restart may restore Monitor/Media content → record the actual configured startup effect before live action and retain physical acceptance separately.
- Disk failure may make an effect's result uncertain → preserve intent, private evidence and originals; no blind retry or success from process exit.

## Migration Plan

Merge independently reviewed source after required checks. Run the read-only plan against the established target before preparing live action. Verify the complete candidate package, current code/dependency identity, backward state compatibility, original unit and recovery evidence. Under qualified authority, prepare releases, acquire the install lock, recheck the plan, persist intent, stop/verify writers, back up, adopt/switch, restart, verify identity/health/latest state and durably finalize. First installed acceptance consumes #114 health identity. Preserve pending physical confirmation instead of claiming it from transport. A failed or interrupted first adoption retains original paths and blocks automatic replay.
