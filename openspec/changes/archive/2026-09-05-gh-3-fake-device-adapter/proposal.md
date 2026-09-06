## Why

The foundation has no executable device boundary. [Issue #3](https://github.com/jimmie-potts/divoom-app-upgrade/issues/3) needs deterministic adapter evidence so renderer and playback work can proceed without hardware.

## What Changes

- Add typed device operations and complete RGB animation inputs, with serialized uploads and controls.
- Add a fake adapter with injected timing, failures, cancellation, generation invalidation, and inspectable operation/frame records.
- Verify synthetic RGB frames, transaction ordering, and failure recovery through deterministic tests.

## Capabilities

### New Capabilities

- `device-adapter`: Simulator operation contracts, frame validation, serialization, cancellation and estimated readiness. Scenarios map to issue #3 criteria 1-3.

### Modified Capabilities

None. Application-foundation readiness and the disconnected UI remain unchanged.

## Impact

Changes are confined to the device package, tests, and documentation/specification. No new dependencies, HTTP routes, decoder, playback engine, hardware transport, installation or physical tests are included. Firmware payloads and timing remain unverified under issue #4.
