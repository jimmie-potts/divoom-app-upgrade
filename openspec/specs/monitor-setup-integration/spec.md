# Monitor setup integration

## Purpose

Provide reproducible Pixoo integration evidence for shared reversible monitoring setup while separating source verification from installed-client and physical acceptance.

## Requirements

### Requirement: Reuse shared reversible setup

Pixoo packaging SHALL consume the versioned Hub setup implementation without maintaining another installer. Its source rehearsal SHALL use disposable private configuration and the simulator, preserving unrelated hooks and permission settings.

#### Scenario: Install and remove against Pixoo
- **WHEN** a synthetic qualified producer is applied using a reviewed current configuration digest
- **THEN** repeated application preserves one owned entry per event, the producer reaches the simulator, and removal revokes its credential and preserves unrelated settings added since installation

#### Scenario: Configuration changes after review
- **WHEN** the target differs from the reviewed setup plan
- **THEN** application refuses the stale plan without overwriting the changed target

#### Scenario: Unqualified producer
- **WHEN** setup is applied for a source without qualification
- **THEN** its producer remains disabled and does not emit monitoring events

### Requirement: Preserve evidence and authorization boundaries

The operator runbook SHALL identify source provenance, prerequisites, setup/removal and recovery operations, credential handling, client trust and host-route limits. It SHALL require an owner and explicit authorization before personal setup, client launches, state migration or physical tests. Source evidence SHALL NOT establish installed, real-client or visible-device success.

#### Scenario: Source rehearsal passes
- **WHEN** disposable setup and synthetic hook checks pass
- **THEN** the receipt identifies source and fixture coverage and retains required-client, frontend and physical observations as pending

#### Scenario: Required route is unqualified
- **WHEN** a required client version, hook path or Windows/WSL route lacks qualification
- **THEN** the runbook retains the gap and leaves that producer disabled unless the owner explicitly accepts a documented degraded mode
