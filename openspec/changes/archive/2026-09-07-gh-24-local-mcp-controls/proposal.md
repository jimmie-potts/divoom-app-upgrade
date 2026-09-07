## Why

[Issue #24](https://github.com/jimmie-potts/divoom-app-upgrade/issues/24) adds local agent control to the existing Pixoo application. The shared MCP module now provides the reusable transport boundary; Pixoo needs bindings that preserve its player, request identities and single device writer.

## What Changes

- Add optional authenticated `/mcp` bindings for status, brightness and screen controls using the immutable shared MCP release from [hub #7](https://github.com/jimmie-potts/agent-device-hub/issues/7).
- Route HTTP and MCP display commands through the same application service and retained results.
- Report requested display settings, acknowledged writes and dated transport observations separately.
- Add explicit private credential provisioning/revocation tooling and local Codex configuration documentation for later acceptance in #26.

## Capabilities

### New Capabilities

- `local-mcp-controls`: Optional local status and display tools, authenticated discovery, bounded delivery and source qualification.

### Modified Capabilities

- `controller-api`: Shared display request identity across HTTP/MCP and a narrowly scoped authenticated native-client route exception.
- `playlist-playback`: Read-only display and connectivity evidence owned by the player.

## Impact

The server composition, display handlers, configuration, request security and player evidence are affected. Existing HTTP response shapes, playback semantics, simulator defaults and one adapter/queue remain compatible. The shared package and its SDK/license receipt become pinned dependencies. Media tools belong to #25; native hub controller integration belongs to #37. This delivery does not install software, change personal Codex settings or operate a physical display.
