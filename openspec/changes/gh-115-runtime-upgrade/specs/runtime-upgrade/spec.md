## Purpose

Upgrade the established Pixoo user service to a verified source revision with recoverable private state and attributable evidence of the running release. Trace: issue #115 and shared install contract 1.2.0.

## ADDED Requirements

### Requirement: Read-only exact installation plan
The owning command SHALL provide plan and status without creating install state, restarting services or commanding a device. A plan SHALL bind the exact merged target, installed inventory, private configuration digests, named service, executable, complete revision comparison and qualified recovery sequence. Unknown comparisons SHALL remain explicit. Mutation SHALL recheck those inputs under an exclusive installation lock and use applicable standing authority without adding a routine human approval gate.

#### Scenario: Changed baseline
- **WHEN** configuration or installed bytes change after a plan is reviewed
- **THEN** upgrade refuses before stopping the service and requires a refreshed plan

### Requirement: Immutable source and retained legacy identity
New releases SHALL be built from clean full merged revisions using pinned dependencies and verified complete inventories. Unexpected files, escaping links and conflicting bytes at one release revision SHALL refuse. First adoption SHALL retain the existing verified dependency closure as a hash-identified legacy copy when its full revision is not proven, without changing unrelated runtime history or the external Node executable.

#### Scenario: Legacy adoption interrupted
- **WHEN** adoption stops between retaining the original, changing the current link and updating the owned service entrypoint
- **THEN** durable intent and preserved originals identify the incomplete transition, and another upgrade refuses automatic replay

### Requirement: Prove compatible latest-state recovery
Before outage, the updater SHALL establish that previous code can reopen every supported durable record kind the candidate can write. Unknown or incompatible recovery SHALL refuse. Candidate failure SHALL recover only to the qualified prior release using the latest durable state, without importing the pre-upgrade backup.

#### Scenario: Candidate writes before health failure
- **WHEN** the candidate writes supported durable records and then fails verification
- **THEN** successful recovery reads those newer records with previous code and reports a failed operation with verified rollback

### Requirement: One writer and complete backup
The updater SHALL record durable intent, stop the named service, verify its process exits and exclude other writers before copying mutable files. Backup SHALL include library originals and referenced renditions plus named monitoring state, credentials and configuration, excluding transient sockets and locks. It SHALL preserve the existing environment file, device identity and settings unless separately authorized.

#### Scenario: Stop or backup failure
- **WHEN** a writer remains or backup cannot complete consistently
- **THEN** no release switch occurs and the receipt reports the observed failure and required recovery

### Requirement: Bounded process and health verification
Upgrade and explicit rollback SHALL verify the selected running identity and existing health/controller connectivity within bounded time and attempts. Legacy recovery SHALL combine executable resolution, process identity/start time and served-artifact evidence when build metadata is absent. Service active state or a disk receipt alone SHALL NOT prove running success. Verification SHALL add no physical probe or display replacement command.

#### Scenario: Wrong running build
- **WHEN** the service is active but health reports a different revision
- **THEN** the candidate fails verification and only qualified recovery is attempted

### Requirement: Durable receipts and safe retention
Every operation SHALL use the complete install-receipt/1.0 semantic validator and retain private attributable evidence. Success requires a durable final receipt, healthy selected process and state-preservation evidence. Failed finalization SHALL return failure and retain a barrier against blind replay. Pruning SHALL occur only after verified success, retaining current plus three prior successful owned releases and every referenced recovery target; legacy, backups, receipts and unrelated history SHALL remain untouched.

#### Scenario: Final receipt write fails
- **WHEN** the new service is healthy but final receipt durability cannot be established
- **THEN** the command reports receipt-finalization-failed, performs no pruning and requires reconciliation of the retained operation

### Requirement: Installed and physical acceptance remain distinct
The owning procedure SHALL declare merged-plus-installed completion and the explicit source-only exception with a linked installation obligation. Source fixtures SHALL NOT establish installed service or physical acceptance. The first qualified upgrade SHALL verify the exact installed build; startup display effects and physical display confirmation retain their applicable device scope.

#### Scenario: Source qualification passes
- **WHEN** fake-service and packaged checks pass without operating the established installation
- **THEN** the report identifies source evidence and retains the installed and physical acceptance still pending
