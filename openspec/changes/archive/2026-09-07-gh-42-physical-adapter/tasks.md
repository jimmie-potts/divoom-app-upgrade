## 1. Startup configuration and ownership

- [x] 1.1 Add failing configuration/selection tests, then implement the bounded shared device-settings reader and explicit simulator/device startup snapshot. Verify absent/invalid files, unsupported mode/profile, default simulator with saved settings, immutable active settings and zero device requests before explicit operations.
- [x] 1.2 Add a private local ownership lock keyed by the device target and independent of runtime data directory. Verify two processes targeting one device from different directories cannot both own it, different targets can proceed, and failed startup releases only its own resources without contacting hardware.
- [x] 1.3 Compose the existing HTTP adapter through a test-injectable transport and keep one player/queue. Verify probe, upload, brightness and screen routes all reach that adapter, upload frames cannot interleave with controls, timeout/cancellation retire work, and shutdown waits for in-flight transport before releasing the device lock without sending restore/reset commands.

## 2. Profile and recovery behavior

- [x] 2.1 Select the active profile for catalog import/render and rendition preparation. Observe focused failures before implementation; verify one/two-frame 500 ms animations pass, incompatible timing/count fails before transport, compatible older renditions retain identity, PNG/JPEG stills use a 500 ms device placeholder, and GIF timing remains unchanged.
- [x] 2.2 Handle possible prior effects before player recovery/skip and persist optional uncertainty metadata. Observe focused failures before implementation; verify upload/control uncertainty pauses without automatic replay, explicit resume restarts the item, old-generation results cannot replace newer intent, old checkpoints still load, and restart restores the uncertain context paused.
- [x] 2.3 Run existing player/store regression scenarios and fake-HTTP application scenarios for total plays, pause/resume/stop, next/previous/shuffle, immutable snapshots, screen-off pause/screen-on non-resume, definite no-effect retry exhaustion and reference-safe recovery; record focused red/green evidence for changed behavior.

## 3. Status and operations

- [x] 3.1 Update shared health/diagnostic schemas and API/device status for selected mode, active versus saved settings and restart-required state. Verify status reads never probe, connectivity begins unknown in device mode, simulator cannot claim connection, diagnostics omit private details, and existing command identity/replay and local security tests pass.
- [x] 3.2 Update browser mode/settings/error labels and uncertainty guidance. Verify simulator browser regressions and fake-HTTP device-mode views distinguish transport observations from visual evidence, show active limits and pending restart, and preserve lost-response reconciliation without automatic replay.
- [x] 3.3 Update README, runtime/API/player/media/UI guides, AGENTS implementation-state wording, OpenSpec context and ADR index with the accepted ADR 0012. Add the bounded #12/#26 runbook using placeholders. Inspect documentation for conflicting simulator-only claims and verify no private target, configuration, media or receipt is included.

## 4. Source validation and specification completion

- [x] 4.1 Run Node 24 npm run check, npm run test:browser, npm run check:workflow and npm run test:workflow with isolated test data and fake transports. Record actual results; no source test may contact a device or depend on personal configuration.
- [x] 4.2 Obtain current OpenSpec status and sync/archive instructions, synchronize all six affected capabilities, update any now-inaccurate purpose text and archive gh-42-physical-adapter on the delivery branch after observable task evidence is complete. Verify strict specification validation and both workflow checks. Keep revision-specific reviews and CI results in the PR; physical acceptance remains with #12/#26.

## Source validation evidence

Focused tests first reproduced missing runtime selection/ownership, upload skip
and control recovery after possible effects, absent rendition-profile checks and
hardcoded simulator UI labels. All corresponding tests pass after implementation.
Node 24 npm run check passed: lint, typecheck, build, 223 application tests and
10 workflow tests. All 50 desktop/mobile browser checks passed with isolated
storage and fake transport responses. The browser cache and temporary directory
were relocated after /tmp filled; no application change was needed for its
screenshot failure. All nine specs validate strictly; the six changed specs match
these deltas and preserve previous scenarios. Physical and local Codex acceptance
remain with #12/#26 and require separate setup/operation authorization.

Independent review reproduced stale simulator labels after a backend restart and
shutdown waiting for HTTP handlers before cancelling device work. Regression
tests failed before the fixes. Runtime identity now gates refreshed labels and
controls while preserving drafts and replay identity; pre-close cancellation
retires queued writes before handler drain and retains ownership until transport
settles. The full checks above include both fixes.

Further review reproduced an overlapping playback event silently dropping a Stop
click and a shutdown HTTP 503 permanently closing Chromium EventSource. Separate
action reads preserve the explicit command; bounded stream recreation restores
readiness after the backend returns. Focused tests reproduced both failures and
passed after the fixes.
