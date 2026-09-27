## Why

[Pixoo #118](https://github.com/jimmie-potts/divoom-app-upgrade/issues/118) lets an agent start the actual Pixoo server in explicit simulator mode with synthetic media, drive library, playlist, playback and Monitor/Media behavior, keep proof and leave a leased preview. The owner chose one shared lifecycle core ([Hub #494](https://github.com/jimmie-potts/agent-device-hub/issues/494), `@jimmie-potts/app-verify`) over per-app lifecycles, so this repository supplies only the Pixoo plug-in and its wrapper.

## What Changes

- Add `npm run verify -- <operation>`, a wrapper that passes the Pixoo plug-in to the vendored shared core.
- Launch the built server with explicit simulator, data directory and port settings, preloaded with a transport guard that refuses non-simulator startup and blocks and records physical transport.
- Seed named synthetic scenarios into a private data directory that is outside every checkout and apart from the owner's normal state.
- Add capture steps with named assertions against fixture pixels and backend state, labelled 64×64 simulator results, and `control-*` negative controls that must fail.
- Add the feature map to the development guide.

## Capabilities

### New Capabilities

- `simulator-verification`: Pixoo's plug-in for disposable verification runs: simulator enforcement, private data, synthetic scenarios, readiness, boundary checks, capture steps, negative controls and the feature map.

### Modified Capabilities

None.

## Impact

Adds `scripts/verify/`, a wrapper script, a vendored core archive, tests and development documentation. No product route, UI, storage format or device behavior changes. Source delivery installs nothing, starts no installed service and contacts no device. Windows-host access remains [Hub #497](https://github.com/jimmie-potts/agent-device-hub/issues/497).
