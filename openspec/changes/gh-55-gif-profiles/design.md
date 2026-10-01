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

October 1 camera recordings supersede the initial qualitative interpretation of
mixed-delay support. The 20-frame loops measured about 10.05 seconds at uniform
500 ms, 16.05 seconds for mixed delays ending at 800 ms, and 2.05 seconds for
mixed delays ending at 100 ms. The last requested delay acted uniformly in these
cases. The owner selected native uniform timing and repeated frames for pauses.

Use the new explicit `pixoo64-gif-2026-10-01` profile: at most 20 frames and one
fixed delay of 100–800 ms per animation. This interval is an admission envelope,
not exhaustive hardware measurement. Retire the unreleased September 30
candidate rather than changing the meaning of its dated identifier. Preserve
the historical smoke profile and original rendition identities. Repeated frames
remain separate frames and count toward the 20-frame limit; do not deduplicate
or automatically convert mixed-delay imports. Their full previews retain the
original effective delays, but physical playback rejects them before any write.

Resolve the saved profile once at startup for adapter admission, player
admission and compatibility. Save remains restart-only. Retain the normal
five-second operation deadline and zero estimated ready delay. GIF-to-still BLUE
flashing remains unresolved; the timing-only recordings do not test handoff.
Normal-player transition acceptance remains open under #55, with #52 retaining
its flashing investigation and no shared cause assumed.
