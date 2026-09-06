## Why

[Issue #4](https://github.com/jimmie-potts/divoom-app-upgrade/issues/4) needs an independently implemented HTTP boundary and controlled smoke tooling before physical protocol claims can be evaluated. The existing fake provides software ordering evidence but cannot establish device behavior.

## What Changes

- Add a pinned-private-IP HTTP adapter with strict response parsing, bounded requests, serialized uploads and honest cancellation outcomes.
- Add separate read-only probe and explicitly enabled display-changing smoke stages using synthetic fixtures.
- Record protocol provenance and a hardware evidence procedure that leaves physical acceptance open until authorized observations exist.

## Capabilities

### New Capabilities

- `device-http-spike`: Narrow protocol transport, provisional profile validation and opt-in hardware experiment commands, covering the source portion of issue #4 criteria 1-5.

### Modified Capabilities

None. The existing device-adapter specification describes the fake. Shared types gain a real-device probe variant and transport error codes without changing fake behavior. Application-foundation remains simulator-only.

## Impact

Device package, command-line scripts, synthetic fixtures, tests and documentation. No application mode switch, web mutation APIs, decoder selection, deployment, firmware changes, cloud discovery or automatic retries. This change's archive proves source/tooling completion only. Issue #4 retains the IP/approval gate and all physical observations and acceptance.
