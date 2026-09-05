# Pixoo-64 Playlist Controller — Agent Implementation Handoff

Prepared: September 5, 2026. Status: implementation plan; no application or device integration has been built or tested in this conversation.

## 1. Objective and user context

Build a local-first application that replaces the frustrating Divoom app for managing image and GIF playlists on the user's Divoom Pixoo-64.

The user specifically wants named playlists containing both images and GIFs, a display duration for each image, and a selectable number of plays for each GIF. A GIF may alternatively be displayed for a specified duration. Prioritize straightforward media management and predictable playback over additional smart-display features.

The user is a software engineer familiar with TypeScript and backend services. Recommended initial development environment: Windows with Ubuntu through WSL. The target device is described as a Pixoo-64; original versus Pixoo-64 II and firmware version are not yet confirmed.

The implementation agent should deliver working code, tests, documentation, and an honest hardware-validation report. This handoff proposes defaults; it does not imply that hardware behavior or optional features have already been approved or verified.

## 2. Working assumptions and evidence boundaries

The Pixoo-64 has a local HTTP command interface. Community implementations demonstrate custom image and animation playback. The Python `pixoo` project also documents firmware quirks and carries a noncommercial/share-alike license; evaluate licensing before adopting or copying any code. Prefer an independently written, narrowly scoped TypeScript device adapter. [Pixoo project](https://github.com/SomethingWithComputers/pixoo)

Community implementation notes describe sequential frame uploads, potential loading interruptions, and frame-count-related instability. These are observations from particular implementations and firmware versions, not universal hardware specifications. Do not turn the previously mentioned approximately 40-frame limit, five-second loading delay, or approximately 300-push failure into immutable requirements. [Implementation notes](https://github.com/Grayda/pixoo_api/blob/main/NOTES.md)

An existing desktop project advertises mixed-media playlists and configurable intervals. Use it as feasibility and UX reference, not as an assumed tested dependency. [Pixoo64 Advanced Tools](https://github.com/tidyhf/Pixoo64-Advanced-Tools)

Additional boundaries:

- Local control does not guarantee complete device operation without Divoom's cloud. Initial provisioning and device boot behavior remain separate concerns.
- Assume no dependable playback-start or loop-completion telemetry until demonstrated on this exact device. A successful HTTP response is not proof that pixels are visible.
- Finite GIF play counts will initially be estimated from the uploaded animation's effective timing. Do not advertise frame-perfect playback.
- This design runs playlist orchestration on the local server. It does not install the playlist engine on the Pixoo. The server must remain awake; closing the browser must not stop playback.
- The official app's precise per-item settings were not verified hands-on. Do not base implementation decisions on an assertion that those features definitively do not exist.
- Divoom-hosted API documentation exists, but its rendered command content was not accessible during this handoff. Recheck it and record sources during the spike rather than claiming a stable, vendor-supported contract. [Divoom documentation portal](https://docin.divoom-gz.com/web/#/5/23)

## 3. Scope and defaults

### MVP

1. Configure one Pixoo by explicit local IP; show connection status and saved model/firmware observations.
2. Upload PNG, JPEG, and GIF files from desktop or phone.
3. Preview and transform media to 64×64 without changing originals.
4. Create, rename, duplicate, delete, and reorder named playlists.
5. Mix images and animations; configure timing independently on every playlist item.
6. Support play, pause playlist, resume, stop, next, previous, repeat playlist, and shuffle.
7. Display active playlist/item, estimated remaining time, upload status, and actionable errors.
8. Persist media, playlists, settings, and recoverable playback context.
9. Work in a clearly labeled simulator mode when hardware is unavailable.
10. Support screen on/off and brightness, serialized with other device operations.
11. Run locally with documented setup; provide tested LAN browser access for phone control.

Proposed defaults: 30 seconds for images, 3 total plays for GIFs, repeat playlist enabled, shuffle disabled, fit-to-canvas with black padding, nearest-neighbor scaling for pixel art. These are product defaults, not device specifications.

### Deferred until the MVP is stable

Time-of-day scheduling, installable PWA/offline UI, internet remote access, native mobile/desktop packaging, multiple displays, video import, cloud-gallery login/import, public sharing, AI image generation, notifications, and device-resident playlists. See section 12 for follow-on work.

## 4. Architecture

Use one repository and one local backend process, not distributed services. The browser communicates with our server; only that server communicates with the Pixoo. Serve the production frontend and API from the same origin.

| Area | Proposed implementation | Responsibility |
| --- | --- | --- |
| UI | React, TypeScript, Vite | Media browser, playlist editor, player, settings |
| Server | Node.js active LTS, TypeScript, Fastify | API, authentication, persistence, device ownership |
| Persistence | SQLite and a configurable local data directory | Metadata, migrations, originals, rendered media |
| Media | `sharp` plus a validated GIF decoding/compositing library | Decode, composite, resize, encode, preview |
| Playback | Framework-independent TypeScript module | State machine, timing, cancellation, ordering |
| Device | Real HTTP adapter plus fake adapter | Translate approved operations into device commands |
| Live state | Server-Sent Events | Push player state; reconnect via authoritative snapshot |
| Tests | Vitest and Playwright | Unit/integration tests and browser flows |

Select and pin compatible dependency versions during implementation. Verify GIF disposal and timing behavior with fixtures before choosing a decoder. Keep application logic independent of the HTTP framework and decoder.

Suggested layout:

| Path | Contents |
| --- | --- |
| `apps/web/` | Responsive UI and browser tests |
| `apps/server/` | API, startup, persistence, authentication |
| `packages/core/` | Playback engine, shared schemas, domain types |
| `packages/device/` | Device adapter, command queue, fake adapter |
| `packages/media/` | Rendering pipeline and fixture tests |
| `docs/` | Setup, decisions, protocol notes, hardware report |
| `scripts/` | Read-only device probe and opt-in playback smoke test |

Store runtime data outside source directories, using `PIXOO_DATA_DIR`. Exclude private assets, databases, credentials, device details, and generated caches from Git. Do not assume a cloud agent can access the user's home network.

## 5. Domain model and API

Use shared runtime validation, for example Zod. Suggested entities:

- **Asset:** ID, original filename, media type, content hash, dimensions, source frame count, source duration, stored-file reference, created time.
- **Rendition:** immutable ID, asset ID, transform settings, renderer/profile version, effective frame count/durations, loop duration, cache reference, validation warnings.
- **Playlist:** ID, name, revision, repeat/shuffle options, timestamps.
- **Playlist item:** unique ID, playlist ID, position, rendition ID, playback policy. Permit the same asset multiple times with different timing.
- **Device configuration:** explicit IP, model/firmware notes, tested capability profile, connection preferences.
- **Playback checkpoint:** session ID, immutable playlist snapshot/revision, item order/cursor, state, recoverable timing metadata, last error. Do not persist process-monotonic timestamps for reuse after restart.

Recommended playback policy:

```ts
type PlaybackPolicy =
  | { mode: "duration"; durationMs: number }
  | { mode: "plays"; totalPlays: number };

type PlaylistItem = {
  id: string;
  renditionId: string;
  playback: PlaybackPolicy;
};
```

Validate positive finite integer values. Only animations may use `plays`. “3 plays” means three total executions, not the first execution plus three repeats. Ignore the source GIF's embedded repeat setting in favor of the playlist policy.

Example playlist representation:

```json
{
  "name": "Evening Pixel Art",
  "repeat": true,
  "shuffle": false,
  "items": [
    {
      "id": "item-1",
      "renditionId": "landscape-fit-v1",
      "playback": { "mode": "duration", "durationMs": 30000 }
    },
    {
      "id": "item-2",
      "renditionId": "character-walk-v1",
      "playback": { "mode": "plays", "totalPlays": 4 }
    }
  ]
}
```

Minimum HTTP surface; names may be adjusted consistently:

| Route | Behavior |
| --- | --- |
| `GET /api/health` | Server readiness; device connectivity reported separately |
| `GET /api/device` | Saved configuration, capabilities, observed connectivity |
| `PUT /api/device` | Validate and save an explicit device configuration |
| `POST /api/device/probe` | Read-only connectivity check |
| `PATCH /api/device/display` | Brightness and screen on/off |
| `POST /api/assets` | Bounded multipart upload |
| `GET /api/assets` | Paginated/searchable asset metadata |
| `POST /api/assets/:id/renditions` | Validate/render a transform; return processing status |
| `DELETE /api/assets/:id` | Reject referenced assets with a useful explanation |
| `/api/playlists` and `/api/playlists/:id` | CRUD; revision-checked updates for items/order/options |
| `POST /api/player/commands` | Validated command and request ID; avoid duplicate command execution |
| `GET /api/player` | Authoritative snapshot with session/revision and estimates |
| `GET /api/events` | State events with sequence IDs; resync after reconnect |

Return consistent typed errors. Do not expose a generic raw-device-command endpoint or arbitrary filesystem paths.

## 6. Playback semantics — implement explicitly

States: `idle`, `loading`, `playing`, `paused`, `reconnecting`, and `error`. Model user playback intent separately from connectivity so reconnection cannot accidentally resume a stopped session.

### Timing

- Prepare the next rendition in server memory/disk ahead of time. Do not assume the device can preload an inactive animation without displaying it.
- Start the dwell timer after successful upload plus the capability profile's measured start-delay estimate, if required. Represent this as an estimate in the UI and logs.
- For `duration`, advance after the configured dwell time; a GIF may be interrupted mid-cycle.
- For `plays`, compute dwell time as `totalPlays × effectiveLoopDurationMs`. For variable-delay animations, use the sum of effective uploaded frame delays, not a guessed frame rate.
- Use a monotonic clock and injectable timer abstraction while the process is running. Avoid cumulative drift from repeated short sleeps.
- Loading time is separate from dwell time. Network delays and imperfect start telemetry mean finite plays are best-effort on real hardware.
- If firmware only supports uniform frame timing, explicitly resample/quantize and show the resulting timing change. Never silently discard variable delays or truncate an animation.

### Controls and persistence

- **Pause playlist:** stop automatic advancement. The currently uploaded GIF may continue looping on the Pixoo. Label this honestly; frame-level animation pause is not an MVP guarantee.
- **Resume:** reupload/restart the current item from its beginning and restart its full dwell/play policy. This avoids pretending to know the device's frame position.
- **Stop:** cancel future transitions and leave the last content displayed. Screen off is a separate control. Do not claim the device animation has stopped.
- **Next/previous:** invalidate old timers and pending work before switching. Previous uses actual playback history, including shuffled order.
- **Repeat off:** after the final item's dwell, enter idle and leave the last content displayed.
- **Shuffle:** each item occurs once per cycle; avoid an immediate repeat across cycles when more than one item exists.
- **Edits during playback:** save changes for the next playback session. Offer an explicit “Restart with changes” action; play against an immutable snapshot to avoid cursor races.
- **Restart:** restore context in paused state by default. Optional auto-resume, if implemented later, must be opt-in and restart the current item rather than claiming exact frame recovery.
- **Display off:** cancel active transitions and pause orchestration; turning the screen on does not resume without an explicit resume action.

### Device ownership and failures

Use one serialized operation queue per device. Never interleave frames from different animations or let brightness/reset commands interrupt an upload sequence unsafely. Ensure only one playback worker controls the configured device in this installation.

Every playback action carries a session/generation ID. Invalidate stale completions and deadlines on stop, skip, playlist change, or reconnect. Cancel requests when possible; acknowledge that an in-flight device request may already have applied. Recover through a verified adapter sequence, not unbounded resets.

On connection loss, suspend advancement and retain the intended item. Retry connectivity with bounded exponential backoff. On successful recovery, restart that item only if playback intent remains active. Never burst through missed items. Distinguish invalid media, upload failures, and offline device errors. A rejected/invalid item may be skipped with a visible error; failure of every item ends the session instead of spinning forever.

Explain that using the official Divoom app at the same time may take over the display. Do not implement a background fight to reclaim it.

## 7. Media pipeline and device adapter

### Media

1. Validate file signatures, byte size, dimensions, decoded pixel budget, and frame count before expensive processing. Initial application limits: 10 MiB per upload and 50 million decoded source pixels across frames; make configurable and label them as application safeguards.
2. Preserve originals. Decode GIF frame rectangles with transparency and disposal compositing; apply image orientation before resize.
3. Offer fit-with-padding and center-crop-to-fill. Provide nearest-neighbor and smooth resampling, with an explicit background color for transparency.
4. Produce complete 64×64 RGB frames. Maintain source and effective timing metadata separately.
5. Validate against the tested device capability profile. Begin conservatively with short animations; do not intentionally probe crash limits.
6. If a file exceeds the profile, reject with an explanation or offer a previewed optimization that the user confirms. Never silently truncate or omit content.
7. Cache by source hash, transforms, conversion version, and device profile. Generate previews from the actual effective frames sent to the device.
8. Perform decoding in bounded background work so uploads cannot block the player/API. Safely clean up failed partial files; retain referenced assets and active-session renditions.

### Adapter

Candidate endpoint: `POST http://<configured-device-ip>/post`. Community references identify `Draw/SendHttpGif` for frames and `Channel/GetIndex` for reading the active channel. Verify payload fields, response shapes, frame ordering, animation IDs, resets, speed semantics, and screen commands against actual hardware. [Protocol reference](https://github.com/cyanheads/pixoo-toolkit/blob/main/CLAUDE.md)

Provide a narrow interface such as `probe()`, `uploadAnimation()`, `setBrightness()`, and `setScreen()`, with timeouts, cancellation, typed results, and structured timings. Validate both HTTP status and device-level error fields. Return an estimated ready time, not a fabricated hardware playback event.

A fake adapter should record frames/commands, expose artificial latency/errors, and support deterministic tests. Default to simulator mode unless the real adapter is explicitly configured. Never send artwork to a guessed IP.

## 8. Local deployment and safety

- No Divoom credentials, cloud account, telemetry, or remote media URLs are needed for the MVP.
- Bind to loopback by default. LAN mode is explicit and requires authenticated sessions and origin/host checks before enabling mutations. Prevent CSRF/DNS-rebinding exposure; validate Web/API origins rather than enabling wildcard CORS.
- Protect phone/LAN sessions with trusted HTTPS in the documented production setup. Keep setup credentials out of URLs, logs, and source control. A normal responsive web UI is sufficient initially; verify secure-context requirements before claiming PWA installation/offline support.
- Pin outgoing device requests to the explicitly configured private IP and expected port/path. Reject redirects and arbitrary URL destinations to avoid server-side request abuse.
- Never expose the Pixoo directly to the internet or create router/firewall changes automatically. Do not change firmware, reset the device, modify its SD card, extract app credentials, or scrape the gallery.
- The phone, local server, and display need network reachability. Document guest-Wi-Fi isolation and Windows/WSL inbound networking separately from device failures. Try native Node on Windows if WSL routing is the obstacle; do not disable security controls.
- The server must stay awake. A browser-only timer or cloud-hosted frontend cannot replace a LAN-connected playback service.
- Use migrations, graceful shutdown, bounded caches/logs, and SQLite-consistent backup/restore. Keep data in a persistent directory/volume. Backup both the database and referenced asset files together.
- Provide native local startup first. Add Docker deployment once the core works; verify ARM64 dependencies before claiming Raspberry Pi support.

## 9. Milestones and acceptance criteria

Implement in order. Keep tasks small and report test evidence after each milestone.

| ID | Work | Acceptance criteria |
| --- | --- | --- |
| M0 | Repository inspection and setup | Read applicable `AGENTS.md`; preserve existing work. Record stack decisions, package versions/licenses, scripts, and data-directory configuration. No unrelated changes or external publishing. |
| M1 | Hardware spike and fake adapter | Read-only probe, one static test image, short known GIF, then ten mixed transitions. Record model, firmware, connection method, timing, visual artifacts, and tested frame/delay behavior. Fake adapter and fixtures run without hardware. |
| M2 | Media library and persistence | PNG/JPEG/GIF upload, immutable transforms, effective previews, SQLite migrations, references, and safe deletion. Transparent/disposal/variable-delay fixtures pass. Data survives restart. |
| M3 | Playback engine and server API | Mixed playlists, all defined controls, repeat/shuffle, cancellation, revision handling, and recovery. Fake-clock and failure tests pass. No stale session advances after stop/skip. |
| M4 | Responsive UI | Media, playlist editor, now-playing, and settings screens work on desktop and phone viewport. Item timing is visible/editable inline. Reorder supports keyboard/touch alternatives. No simulated connection presented as real. |
| M5 | Deployment and security | One documented local startup, secure LAN access, health diagnostics, persistent data, and backup/restore walkthrough. Cross-origin mutations and arbitrary outgoing targets are rejected. Closing the UI does not stop playback. |
| M6 | Real-device validation and handoff | User-observed demo plus mixed-content soak test; document pass/fail/blocked results, measured transition behavior, known limits, commands run, and remaining work. |

### Hardware gate

M1 must distinguish three outcomes:

- **Pass:** the configured device accepts static images and short animations, and observed transitions are acceptable to the user. Proceed with the tested profile.
- **Hardware unavailable:** complete simulator-backed implementation and documentation, but label hardware milestones unverified. Provide commands for the user to run on their LAN; do not misreport a cloud-environment timeout as device incompatibility.
- **Incompatible or unacceptable behavior:** report observations and ask whether to accept the limitation, investigate a supported alternative transport, or stop hardware integration. Do not silently replace the requested mixed-GIF product with a static slideshow or expand into firmware modification.

Before accessing hardware, obtain the device IP and confirm that replacing the currently displayed content for the smoke test is acceptable. Request a model/firmware screenshot only if it is not available through a verified read-only query.

## 10. Test plan

### Automated

- RGB encoding length/order; channel and error-response parsing; sequential upload transactions; timeouts and stale generation handling.
- PNG/JPEG orientation and crop; transparent GIFs; disposal modes; frame patches; variable and missing/zero delays; single-frame GIFs; over-budget input; invalid files. Define a deterministic missing-delay normalization policy and show timing warnings.
- Duration and total-play calculations using effective frame timing; no dwell time charged during simulated loading; correct end-of-playlist state.
- Pause/resume, stop during upload, next/previous spam, brightness during loading, reconnect after stop, all-items-failed handling, and process restart.
- Repeated assets with different policies, shuffle coverage/history, concurrent editor revision conflicts, deletion/reference protection, cache invalidation, database migrations, and backup restore.
- API authentication, origin/host checks, path traversal, content limits, redirects, arbitrary device destination rejection, and command replay protection.
- Browser journey: upload one image and one GIF, create playlist, set 30 seconds and 3 plays, reorder, start, skip, stop, refresh, and reopen from another authenticated client.

### Real-device checks

1. Image dwell: observe a 30-second item; record estimated versus observed visible time and transition loading separately.
2. Finite plays: use a distinctive numbered short animation at several play counts. Record observed total cycles and boundary error; do not claim accuracy beyond the measurement.
3. Variable timing: verify the rendered effective animation matches its preview or clearly documents conversion.
4. Controls: pause playlist, resume/restart item, skip during loading, stop, brightness, and screen off/on follow the specified semantics.
5. Reliability: user-approved soak test lasting at least 60 minutes and 100 transitions, at a normal non-stress cadence. Report freezes, recoveries, upload latency distribution, loading artifacts, and server resource growth.
6. Recovery: user-assisted device disconnect/reconnect and server restart retain data and do not replay stale commands.
7. Phone: test actual LAN access; close the page/lock the phone and confirm backend playback continues. Browser emulation alone is not this test.

Unit/integration results establish controller correctness, not physical display timing. Hardware acceptance requires the user's assessment of loading interruptions and play-count precision; record agreed tolerances instead of inventing guarantees.

## 11. Definition of done and agent reporting

The MVP is complete when all requested media/playlist functions run, automated checks pass, restart preserves data, secure local/phone operation is documented, and real-device acceptance has either passed or is explicitly marked blocked. Simulator-only completion must be labeled “software complete; hardware verification pending,” not “device integration verified.”

Required repository deliverables:

- Source and dependency lockfile; lint/typecheck/test/build scripts.
- Example configuration with placeholders, no real device identifiers or secrets.
- README with simulator, local server, phone networking, playback semantics, and recovery instructions.
- Hardware probe/smoke-test scripts with read-only versus display-changing operations clearly separated.
- Unit, integration, and browser tests with redistributable or synthetic fixtures.
- `docs/hardware-validation.md` with dated observations and evidence status.
- `docs/decisions.md` covering timing estimation, renderer/profile limits, dependency licensing, and security defaults.
- Known limitations and a short prioritized backlog.

At each milestone, report what changed, tests run/results, hardware actions taken, assumptions changed, blockers, and the next step. Never report tests as run unless executed. Do not create Jira issues, open PRs, push code, publish a site, or install remote infrastructure unless separately authorized. Follow repository policy for local branches/commits. This plan does not require agent delegation.

## 12. Follow-on backlog

After the mixed-playlist MVP works:

1. **Schedules:** timezone-aware playlist activation, explicit precedence with manual controls, DST/restart behavior, no replay of missed triggers, and schedule acceptance tests.
2. **Always-on host:** tested Docker deployment and ARM64/Raspberry Pi support where dependencies permit.
3. **Convenience:** playlist export/import with versioned schemas, richer organization, installable PWA after secure-context testing.
4. **Transition improvements:** investigate supported local-file/URL playback or device-resident content only if M1 reveals unacceptable uploads. Confirm transfer, timing, and persistence support before committing; no SD-card modification by assumption.
5. **Remote control:** optional authenticated private-network access to the local server. Never direct internet exposure of the Pixoo.
6. **Gallery import:** separate authorization, licensing, credentials, and API-stability assessment. Do not bundle it into ordinary local uploads.

## 13. Kickoff instruction to the implementation agent

Implement the Pixoo-64 playlist controller described in this handoff. First inspect the provided repository and applicable agent instructions. Keep the local-first single-server architecture, simulator adapter, per-item timing, explicit total-play semantics, and hardware-evidence boundaries. Start with M0 and M1; use the simulator when LAN access is unavailable. Ask only for information or authorization needed to progress safely, especially the actual device IP and permission to replace its display during tests. Continue through the software milestones with verification at each step. Do not expand into firmware changes, cloud-gallery access, external publishing, or remote infrastructure without approval. Finish with runnable setup instructions, test results, and a clear statement of what was and was not validated on the physical device.
