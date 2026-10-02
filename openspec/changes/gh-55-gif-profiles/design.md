## Context

See proposal.md. Catalog routes currently inherit the active playback profile. Existing playback admission already checks complete renditions before replacing context or submitting uploads.

## Goals / Non-Goals

Separate library usability from device qualification while keeping stored identities and one writer. No automatic color conversion, timing resampling or inferred hardware maximum. The hosted transport below supersedes the earlier raw-only scope.

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


## Hosted application playback (wrap-up decision)

The owner authorized hosted GIF integration after the completed five-second and
thirty-second experiments. Preserve both prior profile identifiers unchanged.
Add `pixoo64-hosted-2026-10-01`: 500 frames, uniform 50–800 ms in whole GIF
centiseconds. This is a software admission envelope, not exhaustive measurement:
the observed hosted cases are 20×100 ms, 100×50 ms and 500×60 ms. There is no
animation-duration cap. Full imports and previews retain their existing budget.

Encode multi-frame effective RGB renditions losslessly with at most 256 distinct
colors across the entire animation, one global palette, no local palettes, no
transparency, disposal 1 and every repeated frame retained. Reject excess colors
before replacing context. Use the same check in browser/catalog/MCP compatibility
and player admission; never quantize or alter stored bytes or identities.
Single-frame images retain the existing RGB upload path and full color fidelity.

The adapter retains its sole FIFO, generation, cancellation and deadline owner.
A hosted multi-frame operation prepares one file and sends Device/PlayTFGif once
(FileType 2, FileName the capability URL). No fallback or retry follows uncertain
submission. The operation waits for a complete HTTP response transfer, then
returns estimated readiness after a 1000 ms loading allowance. Player duration
and total-plays start at that estimate, not command acknowledgment. This allowance
is provisional until normal-application recordings measure its adequacy. Transfer
failure/deadline after command submission means possible effects and pauses the
player. A completed transfer is not optical proof. Stop retires future work and
URLs; a downloaded GIF can keep looping. No unsupported device stop is invented.

A dedicated application-owned HTTP listener exposes only the current prepared
GIF under a random 256-bit capability path. It has no catalog, control route,
filesystem lookup, arbitrary URL fetch, or directory listing. Limit file size to
10 MiB, active file count to one, transfer lifetime to 15 seconds, requests to ten,
and cumulative bytes to five file lengths. Serve GET/HEAD and bounded byte ranges;
only a full GET completion establishes transfer completion. Expiry, cancellation,
replacement and shutdown revoke access and close active transfers. The application
control listener and its existing authentication remain unchanged on loopback.

Private startup-only hosted-listener configuration supplies bind IPv4, port and
an explicit device-reachable HTTP origin. Reject public/hostname origins and
missing configuration for the hosted profile. Default simulator startup creates
no file listener. Directly reachable Linux hosts need no helper. This WSL NAT
acceptance uses a temporary owned Windows file-only relay to that listener,
without changing firewall, router, service installation or global configuration.
Persistent routing needs a separately reviewed owner deployment plan and explicit
installation authorization; it is not silently installed during source delivery.

Acceptance: encoder decode/pixel/order/delay comparisons, palette structure,
repeated frames and lossless rejection; scoped/expired/ranged HTTP access; queue,
cancellation, missing fetch and no-retry checks; import/preview/restart without
writes; normal-player five/ thirty-second loops, GIF→still and GIF→GIF policies,
replacement/Stop/restart, automatic camera review and owned-process cleanup.
The blue transition criterion remains open until observed or explicitly disposed.
