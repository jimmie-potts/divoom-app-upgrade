# Application foundation

## Purpose

Provide a reproducible local simulator foundation so developers can run and verify the application without a physical display or private media.

## Requirements

### Requirement: Local simulator startup
The application SHALL start one backend serving its browser page and API on IPv4 loopback, defaulting to simulator mode and port 8787. It SHALL perform no device requests. Trace: issue #2 criteria 1, 3 and 4.

#### Scenario: Start the built application
- **WHEN** a developer runs the documented simulator command after dependency installation
- **THEN** the browser page and GET /api/health are served from the printed loopback URL by the same backend
- **AND** no hardware is connected or contacted

#### Scenario: Stop the server
- **WHEN** the running process receives a shutdown signal
- **THEN** it releases its listener and exits without deleting runtime data

### Requirement: Explicit readiness and simulator status
The health endpoint SHALL report server readiness separately from device connectivity, without returning private filesystem paths. The UI SHALL distinguish loading, unavailable service, and a ready simulator foundation. Trace: issue #2 criterion 3.

#### Scenario: Ready foundation
- **WHEN** the ready server is queried
- **THEN** it returns HTTP 200 with status ready, mode simulator, and device connected false
- **AND** the page displays Simulator mode and Server ready without suggesting playlist or device functionality exists

#### Scenario: Health unavailable
- **WHEN** the browser cannot obtain a valid health response
- **THEN** it displays an actionable service-unavailable message and offers retry instead of claiming readiness

### Requirement: External runtime configuration
The application SHALL use PIXOO_DATA_DIR for an absolute runtime directory outside source control, defaulting to the user's local application data directory. It SHALL fail before listening on invalid configuration, unusable storage, or unsupported real-device mode. Trace: issue #2 criterion 4.

#### Scenario: Valid external directory
- **WHEN** an external data directory is supplied
- **THEN** startup creates missing directories and verifies they are usable without overwriting existing data

#### Scenario: Source directory or symlink alias
- **WHEN** the configured data directory is inside the current checkout or another Git checkout, including through a symlink
- **THEN** startup rejects the configuration before creating that data directory or listening

#### Scenario: Invalid settings
- **WHEN** the data directory is relative or blank, mode is not simulator, or port is not an integer from 0 through 65535
- **THEN** startup reports a configuration error and exits unsuccessfully

### Requirement: Reproducible developer checks
The repository SHALL provide executable lint, typecheck, unit/integration test, browser test, build and startup commands using pinned dependencies and Node 24. Trace: issue #2 criteria 1-3.

#### Scenario: Fresh checkout validation
- **WHEN** dependencies are installed from the lockfile and documented checks run
- **THEN** all five workspaces compile, regression checks run without hardware, and the built UI passes its simulator/browser smoke checks
- **AND** dependency versions and licenses are documented while GIF decoder selection remains deferred
