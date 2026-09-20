## Why

[Pixoo #37](https://github.com/jimmie-potts/divoom-app-upgrade/issues/37) needs a protected controller boundary for shared hub clients. Browser and MCP clients already share an owning backend; the hub must use that owner and its queue too.

## What Changes

- Adopt the released controller contract 1.0.0 with its immutable receipt and fixtures.
- Add an explicitly enabled native controller API with configured neutral identity, bounded snapshots/events, machine authorization and guarded commands.
- Translate supported power, brightness and media operations into the existing player and library services. Keep unsupported extensions unavailable.
- Add fake-backed consumer compatibility and security/concurrency checks.

## Capabilities

### New Capabilities

- `hub-controller-api`: Shared controller contract adoption, native authorization, command admission and resumable observations.

### Modified Capabilities

None. Existing browser and MCP contracts remain valid.

## Impact

Server composition, common command admission, configuration, native routes and tests change. The source artifact is pinned in vendor. Source documentation and the linked hub work guide require synchronization. Default startup remains simulator; this work neither installs clients nor operates hardware. Monitor/Media integration remains #33, without a dependency on that work.
