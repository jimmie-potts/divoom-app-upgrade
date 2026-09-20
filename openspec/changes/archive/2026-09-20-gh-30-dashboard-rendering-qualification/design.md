## Context

The device adapters already serialize requests and preserve possible-prior-effects failures. The backend owns a per-target SQLite lock; the standalone smoke script does not yet participate. See proposal.md for motivation and issue #30 for the full physical finish line. Design is required because timing, cancellation and cross-process ownership govern this experiment.

## Goals / Non-Goals

Goals: exercise synthetic complete pictures, make bursts reproducible, bound traffic, and prepare observable physical comparisons.

Non-goals: production renderer #32, monitor integration #33, shared agent state, automatic recovery, unqualified device text commands or a hardware acceptance claim.

## Decisions

- Keep a pure fixture renderer and scheduled runner in the device package. The runner samples the newest due event only when eligible; it awaits each upload and the cadence before considering the next. It does not enqueue obsolete pictures behind the adapter.
- Use one complete RGB frame with the observed 500 ms placeholder. Cadence is an experiment parameter, not GIF frame speed or a measured device limit.
- Use the backend's existing lock in both CLI entrypoints. Do not move runtime ownership or duplicate the lock. Close the HTTP adapter before release, including errors and signals. The lock only covers cooperating processes in the same native user environment; external writers require explicit operator exclusion.
- Physical comparison performs a bounded settings probe before upload and refuses unknown brightness/screen state. Preserve settings by never changing them. Unknown original artwork cannot be restored. A stopped or cancelled tool may leave its last picture visible.
- Render small synthetic labels with a local bitmap alphabet. Export a standalone HTML canvas preview from the same RGB arrays; browser pixel readback checks fidelity. No web routes or normal application startup change.
- Text/item qualification is an evidence gate, not an arbitrary raw-command interface. Document supported-source descriptions and limitations; absent reproducible device fonts, keep this candidate unavailable for the exact-preview requirement.
- This OpenSpec change covers source/tooling acceptance. Physical measurements and the final method/cadence choice remain in #30, as its source-first delivery target permits. Archival does not assert physical completion.

## Risks / Trade-offs

- Same-host locking cannot detect a phone/cloud/other-host writer; require operator confirmation and stop on unexpected output.
- Deadlines cannot recall delivered HTTP writes; report possible prior effects and await transport closure before unlocking.
- Full frames can cause loading interruptions; retain visible measurements as pending and do not imply that exact RGB preview proves display behavior.
- A fixed synthetic alphabet is suitable for qualification only; production typography belongs to #32.

## Migration Plan

No persistent product data changes. The tools run only on explicit invocation. Rollback removes the new command; never erase target lock databases or live state.

## Open Questions

Visible latency, loading interruptions, readability and the final accepted cadence require an authorized physical session after source validation.
