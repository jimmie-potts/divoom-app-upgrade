## Why

Pixoo needs operational records that can be queried alongside Hub diagnostics. [Issue #134](https://github.com/jimmie-potts/divoom-app-upgrade/issues/134) adopts the accepted shared runtime in existing server and worker boundaries.

## What Changes

- Pin the accepted observability 1.1.0 archive and verify its installed contents.
- Add explicit host enablement, canonical process/request/operation records and optional loopback collection.
- Carry trace context into the owned media worker without changing its result channel or renderer behavior.
- Document selected coverage and deferred instrumentation; validate with simulator fixtures and existing delivery checks.

## Capabilities

### New Capabilities

- `operational-diagnostics`: optional canonical server and worker diagnostics with bounded failure behavior.

### Modified Capabilities

None. Existing domain behavior and transport contracts remain unchanged.

## Impact

Server composition, media worker composition, library dependency injection, immutable vendor dependencies and application tests. No UI, installation, device operation or performance qualification.
