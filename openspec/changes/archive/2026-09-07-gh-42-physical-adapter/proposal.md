## Why

[Issue #42](https://github.com/jimmie-potts/divoom-app-upgrade/issues/42) connects the
delivered HTTP adapter to the local application. Browser playback and later MCP
clients need one explicitly activated device writer, with the dated smoke limits
and uncertain-write handling defined before source implementation.

## What Changes

- Accept explicit `PIXOO_MODE=device` using a validated snapshot of private
  `device.json`; keep default startup and unattended checks in simulator mode.
- Compose the existing physical adapter with the existing player, API command
  identity and serialized queue. Saved settings take effect only after restart.
- Apply the smoke frame/timing bounds to rendering and playback without changing
  immutable media or claiming broader firmware support.
- Pause after possible prior effects until explicit user intent resumes playback.
  Preserve stop, screen, traversal and paused-recovery semantics.
- Report selected mode and observed transport availability separately from
  estimated timing and physical observations. Document manual operations and the
  separately authorized acceptance runbook.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `application-foundation`: explicit physical startup with immutable validated
  configuration and default simulator behavior, issue #42 criteria 1-2.
- `controller-api`: active versus saved device settings and transport status
  through the existing protected command boundary, criteria 2-3 and 5.
- `media-rendering`: active runtime profile selection and immutable compatibility
  checks, criteria 4-5.
- `playlist-playback`: pause and retain uncertainty before automatic recovery or
  skipping, criteria 3-5.
- `controller-ui`: mode-aware settings and honest device/uncertainty messages,
  criteria 4-6.
- `local-operations`: device-aware diagnostics, rollback and bounded physical
  runbook, criteria 6-8.

## Impact

Changes span server startup/configuration and routes, shared response schemas,
playback/store composition, checkpoint error metadata, and browser status labels.
The existing HTTP transport, device contract, library ownership and renderer
profiles remain the basis. No new runtime dependency, MCP implementation,
installation or hardware request is included. Issue #12 and #26 retain physical
acceptance. ADR 0012 records the lasting decisions.
