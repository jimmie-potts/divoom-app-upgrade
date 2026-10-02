## MODIFIED Requirements

### Requirement: Bounded physical operation runbook
Documentation SHALL provide placeholder-based configuration, explicit device start, graceful stop, simulator rollback and troubleshooting instructions. It SHALL require a separately authorized target and permission to replace content before physical operation, one writer for the target, and the explicitly selected dated profile limits. The physical acceptance runbook SHALL bound operations, stop on uncertain or unacceptable results and separate source checks, transport receipts and user observations for issues #12, #26 and #55. Private addresses, media and receipts SHALL stay outside Git. Trace: issue #42 criteria 6-8 and issue #55 AC3–AC6.

#### Scenario: Configure and return to simulator
- **WHEN** an operator follows the documented mode-selection and rollback sequence
- **THEN** settings are saved in private runtime storage, device activation requires an explicit restart in device mode, and a simulator restart preserves media with playback paused

#### Scenario: Physical acceptance remains pending
- **WHEN** source tests pass without an authorized display session
- **THEN** delivery records source completion without claiming visible output, exact finite loops, phone connectivity or closure of physical acceptance
