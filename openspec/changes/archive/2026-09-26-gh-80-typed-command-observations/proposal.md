## Why

[Issue #80](https://github.com/jimmie-potts/divoom-app-upgrade/issues/80) separates command observations from replay serialization. Today the native observer interprets unknown positional payloads and results, hiding affected consumers from typechecking.

## What Changes

- Characterize the existing ledger lifecycle, replay, isolation and capacity before refactoring.
- Give application producers typed operation metadata and correlated completion results; handle variants exhaustively in ControllerState.
- Preserve fingerprints, execution timing, request attribution and endpoint-dependent pending accounting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is an internal refactor; `skip_specs: true` applies. The existing controller-api and hub-controller-api requirements and ADR 0013 remain authoritative. No public schema, scheduling, persistence or authorization contract changes.

## Impact

Commands, ControlService and ControllerState, plus focused tests. Shared monitor ownership stays separate. No dependencies, installation, live-state changes or physical operations. Acceptance follows issue #80 AC1–AC6 with focused baseline checks, application/controller/browser suites, independent reviews and current CI.
