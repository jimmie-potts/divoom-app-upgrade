## Why

[Issue #81](https://github.com/jimmie-potts/divoom-app-upgrade/issues/81) removes duplicate SSE client-delivery machinery while preserving the distinct browser and native feed protocols. Characterization must precede extraction because their authentication/backpressure sequencing differs.

## What Changes

- Share private encoded-message delivery, queue bounds, authentication, timers, backpressure and cleanup.
- Keep snapshot signatures, history, cursor parsing, replay/resync and envelopes in each existing feed.
- Preserve readiness reservations, authentication wiring and explicit blocked-write policies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This behavior-preserving refactor uses `skip_specs: true`. Existing controller-api, hub-controller-api and agent-monitor-host requirements remain authoritative.

## Impact

Events and ControllerEvents plus one private delivery component, lifecycle tests and ADR 0023. HTTP security retains shared mixed-feed/HEAD admission. No dependency, endpoint, device writer, state owner, public schema, installation or physical operation changes. Acceptance follows issue #81 AC1–AC7 through baseline lifecycle tests and existing application/controller/browser suites.
