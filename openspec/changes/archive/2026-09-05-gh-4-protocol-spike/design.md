## Context

See proposal.md. Existing DeviceAdapter is used only by the fake and has simulator-only probe types. The application remains simulator-only. Native Node HTTP provides a testable direct connection without adding a dependency or proxy behavior. Security, cancellation and hardware evidence require this design.

## Goals / Non-Goals

**Goals:** Verify bounded JSON handling and operation sequences against fake servers; prepare individual user-observable hardware stages.

**Non-Goals:** Enable a real backend mode, implement playback/media decoding, discover devices, change firmware, reset device settings, or declare hardware compatibility from source checks.

## Decisions

- Implement a new HTTP adapter independently. Share frame validation/snapshot helpers with the fake, but preserve its deterministic scheduler. The real writer holds an asynchronous transport request through closure, so it cannot release immediately as the in-memory fake does.
- Use native node:http with agent disabled, fixed port/path, direct validated private IPv4 and no redirects. A low-level internal request helper accepts loopback/ephemeral ports only for fake-server tests; the public device factory validates destinations. Bound responses to 16 KiB and require HTTP 2xx plus numeric error_code. Extract only known probe fields; raw device response text and address do not enter diagnostics.
- Extend probe results with a device variant and typed HTTP/device/protocol failures. Keep fake behavior unchanged. Queued timeouts settle promptly. Active cancellation resolves only after native request closure; already-sent mutating requests imply possible prior effects even if no response arrives.
- Read Channel/GetIndex and Channel/GetAllConf for probe. Model and firmware are user observations unless a verified response source is found. Upload reads Draw/GetHttpGifId once, then sends each Draw/SendHttpGif with PicID and offsets starting at zero. Do not select channels, retry or reset implicitly.
- Community implementations disagree about resetting IDs before uploads. Default to no reset, as used by r12f's ID query approach. Provide one separate, explicit Draw/ResetHttpGifId experiment, not a factory/firmware reset or automatic recovery loop. A failed command ends its stage.
- Use an explicitly selected provisional profile capped at two frames, 100-1000ms uniform delays, 64x64 RGB, and zero additional readiness estimate. These small experiment bounds are application safeguards, not discovered limits. Reject variable delays rather than silently changing them. Observed profiles can be supplied later through trusted code after device evidence.
- Build a synthetic static pattern and a two-frame 500ms GIF with corresponding complete RGB fixtures. Generate the tiny GIF from our own palette/LZW byte writer; no decoder is adopted. Verify its frame data independently in tests. Smoke uploads the paired effective RGB frames, not a claim of a media import pipeline.
- Expose separate CLI stages: probe, static, gif, transitions, controls and reset. Require --allow-display-change for mutating stages and explicit PIXOO_DEVICE_IP. Static and GIF are individually observed before transitions. Ten transitions alternate static/GIF with conservative pauses. Controls restore the previously read brightness and screen state on success; no content restoration is promised. Unknown control state blocks the controls stage.
- Source artifacts and tests may be reviewed/merged while physical acceptance stays open. Hardware observations, exact device identity and the user's loading assessment belong to the issue/evidence report; no incomplete physical task is archived as complete.

## Risks / Trade-offs

- Local request closure cannot undo work already applied by a device. Report possible prior effects and do not promise physical cancellation.
- The official documentation portal does not render commands here. Pinned community sources establish hypotheses, not a universally supported contract.
- A synthetic GIF with known paired RGB frames tests protocol output but not arbitrary GIF decoding. That remains issue #5.

## Migration Plan

Add library exports and opt-in scripts without changing application configuration or creating runtime state. There is no data migration or installation. Reverting the source removes the experimental tooling while the simulator still runs.
