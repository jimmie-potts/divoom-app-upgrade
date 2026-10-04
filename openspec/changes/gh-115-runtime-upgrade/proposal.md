## Why

[Pixoo #115](https://github.com/jimmie-potts/divoom-app-upgrade/issues/115) replaces manual service upgrades with the owning command required by the shared installation contract. The running build identity from #114 makes exact installed verification possible and enables qualified cross-repository delivery.

## What Changes

- Add read-only plan/status and guarded upgrade/rollback commands for the established Linux user service.
- Prepare immutable, manifest-verified releases from clean merged source; retain a verified legacy recovery copy during first adoption.
- Bind target, installed baseline, configuration, service identity and recovery evidence to a plan; persist installation intent before outage and final semantic receipts before success.
- Qualify previous-code reopening of candidate-written state before stopping writers. Preserve the latest library, monitoring state, configuration and credentials during rollback.
- Verify running revision, existing controller health/connectivity and retained state through bounded checks. Report partial adoption, failed recovery and uncertain finalization honestly.
- Replace the in-place upgrade instructions with one procedure and conditional agent pointers for installation and shared delivery claims. Routine established installation uses the owner's standing authority; device and unqualified migration boundaries remain explicit.
- Add the fixed owning stdin installation/reconciliation adapter for the shared supervisor, reusing the same plan, locks, recovery and semantic receipts. Preserve existing credential storage and stopped-service ownership.

## Capabilities

### New Capabilities

- `runtime-upgrade`: exact-plan installation, immutable releases, compatible recovery, private receipts and bounded verification.

### Modified Capabilities

None. Existing offline library backup behavior is preserved; a callback retains its owner lease through the updater's complete snapshot and selection. Source build identity remains the #114 contract.

## Impact

Owning installer tooling, operations/agent guidance, vendored contracts 1.2.0 and focused fake-service tests integrated into existing CI. No new device commands, host, scheduler, shared installer framework or library format. Source tests do not establish physical display acceptance; the exact target and startup effects remain part of installed qualification.
