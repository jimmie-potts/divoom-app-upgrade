## Why

The production UI and simulator backend now share one native process, but users
need a recoverable copy of their library and a way to diagnose local startup.
[Issue #10](https://github.com/jimmie-potts/divoom-app-upgrade/issues/10) owns this
delivery, tracing handoff sections 8–11.

## What Changes

- Add offline, verified backup and restore commands for the private catalog,
  its referenced media and saved device settings.
- Add private-safe runtime diagnostics and document native startup, shutdown,
  data retention and Windows/WSL troubleshooting.
- Exercise backend playback after the browser closes.

## Capabilities

### New Capabilities

- `local-operations`: Offline recovery bundles and local operational diagnostics.

### Modified Capabilities

None. Existing startup, simulator transport and paused recovery contracts remain.

## Impact

Server tooling, library verification, tests and operations documentation. No new
dependency, hook installer, LAN listener, OS service installation or device work.
Shared collection remains owned by agent-device-hub#8 and optional for media use.
