## MODIFIED Requirements

### Requirement: Local diagnostics and bounded transient state
The backend SHALL expose loopback diagnostics for uptime, selected mode,
library readiness and player/device availability without private paths, IPs,
media names or raw errors. Transient request, event and playback caches SHALL
remain bounded; routine requests SHALL NOT create persistent logs. Durable user
media SHALL NOT be discarded as a cache. Trace: issue #10 startup criterion and issue #42 criteria 5-6.

#### Scenario: Diagnose a running simulator
- **WHEN** a local client reads diagnostics after startup
- **THEN** it can distinguish a ready backend and simulator availability from an actual device connection, without receiving private runtime details

## ADDED Requirements

### Requirement: Bounded physical operation runbook
Documentation SHALL provide placeholder-based configuration, explicit device start, graceful stop, simulator rollback and troubleshooting instructions. It SHALL require a separately authorized target and permission to replace content before physical operation, one writer for the target, and the dated smoke limits. The physical acceptance runbook SHALL bound operations, stop on uncertain or unacceptable results and separate source checks, transport receipts and user observations for issues #12 and #26. Private addresses, media and receipts SHALL stay outside Git. Trace: issue #42 criteria 6-8.

#### Scenario: Configure and return to simulator
- **WHEN** an operator follows the documented mode-selection and rollback sequence
- **THEN** settings are saved in private runtime storage, device activation requires an explicit restart in device mode, and a simulator restart preserves media with playback paused

#### Scenario: Physical acceptance remains pending
- **WHEN** source tests pass without an authorized display session
- **THEN** delivery records source completion without claiming visible output, exact finite loops, phone connectivity or closure of physical acceptance
