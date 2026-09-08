## Why

[Pixoo #29](https://github.com/jimmie-potts/divoom-app-upgrade/issues/29) needs one consumer contract before monitoring is embedded. Hub #2 now provides released lifecycle metadata and shared conformance cases; Pixoo can consume those exact bytes and define its display policy without another provider adapter or reducer.

## What Changes

- Pin the released lifecycle contract 1.0.0 archive and its source/checksum receipt for reproducible offline installation.
- Exercise its shared cases and privacy/version rejection through the real package in Pixoo's canonical application checks.
- Define the Pixoo mapping for sessions, attention, notices, labels, freshness and acknowledgment, with explicit missing-signal and installed-client limits.
- Document the shared source versus Pixoo host boundary, future ownership handoff and preserved legacy Nanoleaf behavior.

## Capabilities

### New Capabilities

- `shared-monitor-contract`: Pixoo's released-contract dependency and monitoring consumer requirements.

### Modified Capabilities

None. Existing media, player, API, MCP and UI requirements remain unchanged.

## Impact

A development dependency, vendored immutable release archive/receipt, contract-consumer tests and documentation. No monitoring runtime, dashboard, provider collector, service, state migration, personal configuration or physical operations are introduced. The linked Hub work-guide companion records adoption and source delivery separately from the future host.
