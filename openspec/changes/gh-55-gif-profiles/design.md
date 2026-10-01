## Context

See proposal.md. Catalog routes currently inherit the active playback profile. Existing playback admission already checks complete renditions before replacing context or submitting uploads.

## Goals / Non-Goals

Separate library usability from device qualification while keeping stored identities and one writer. No new transport, automatic conversion, timing resampling or inferred hardware support.

## Decisions

Keep simulator-v1 as the application rendering budget in both modes; renaming it would unnecessarily change immutable identities. Return separately computed compatibility through a small rendition endpoint, using the same timing validator as playback. Preserve exact PNG previews and label browser timing illustrative.

The qualification runner uses five fixed synthetic animations, existing transport/target lock, 5-second probe, 15-second upload deadlines, 180-second total bound, no retries and no control/reset commands. Default invocation produces offline previews only. Physical mode requires explicit flags, private target, owner/model/firmware metadata and a clean exact source revision. The final control remains displayed until the coordinator hands ownership back. Cancellation stops future submissions, drains transport, and reports possible effects without an automatic restoration write.

## Risks / Trade-offs

- HTTP completion cannot establish visible timing → retain observation-pending receipts and require recorded display evidence.
- Larger sequential uploads may exceed normal player deadlines → measure before changing the production profile or timeout.
- Browser timers/network loads affect cadence → preserve effective pixels/delays without claiming precise wall-clock preview timing.

## Migration Plan

No persistent migration. Existing files, profiles, playlist references and original bytes remain unchanged. Rollback retains all media; old device playback still rejects incompatible media. Physical profile expansion remains a separate evidence-dependent completion task within #55.


## Observed profile selection

The September 30 physical run and subsequent owner observations support a new
explicit `pixoo64-gif-2026-09-30` profile: 20 frames, 100–800 ms, nonuniform timing.
This interval is a bounded admission inference from observed 20-frame endpoint
cases and reversed two-frame asymmetric timing, not exhaustive measurement.
Preserve the smoke profile and original rendition identities. Resolve the saved
profile once at startup for adapter admission, player admission and compatibility.
Save remains restart-only. Retain the normal five-second operation deadline and
zero estimated ready delay: measured uploads fit, while 1–3-second visible loading
between stages does not measure an additional post-ack delay. Test the normal
player before final acceptance.
