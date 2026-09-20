## Why

[Issue #31](https://github.com/jimmie-potts/divoom-app-upgrade/issues/31) needs one durable shared agent-state host inside the existing Pixoo backend. Released agent-state 1.0.0 supplies the shared engine; consumers must not copy it or depend on a device or browser.

## What Changes

- Pin the verified release and compose private durable storage, authenticated bounded HTTP admission and the existing SSE implementation.
- Add a selected session-source facade for embedded and remote ownership, labels, filters and acknowledgment.
- Add explicit quiesce/export/import and rollback tooling, documented source examples and isolated failure/performance checks.
- Preserve simulator defaults and existing explicit device activation, as confirmed by the user. Monitoring never invokes device services.

## Capabilities

### New Capabilities

- `agent-monitor-host`: Durable hosting, authenticated session access, selected-owner facade and migration.

### Modified Capabilities

None. Existing controller operations and protections retain their contracts.

## Impact

Server composition, private monitor storage/configuration, routes, SSE reuse, package pins, tests and docs/agent-monitoring.md. Hub guide synchronization requires a companion PR. No installed hooks, live migrations, device requests or public publication.
