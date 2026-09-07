## MODIFIED Requirements

### Requirement: Explicit readiness and simulator status
The health endpoint SHALL report server readiness separately from device connectivity, without returning private filesystem paths. The UI SHALL distinguish loading, unavailable service, and a ready simulator foundation. Trace: issue #2 criterion 3.

#### Scenario: Ready foundation
- **WHEN** the ready server is queried
- **THEN** it returns HTTP 200 with status ready, mode simulator, and device connected false
- **AND** the page displays Simulator mode and Server ready with available simulator controls clearly separated from physical-device connectivity

#### Scenario: Health unavailable
- **WHEN** the browser cannot obtain a valid health response
- **THEN** it displays an actionable service-unavailable message and offers retry instead of claiming readiness
