## MODIFIED Requirements

### Requirement: Local simulator startup
The application SHALL start one backend serving its browser page and API on IPv4 loopback, defaulting to simulator mode and port 8787. Simulator mode and ordinary startup/status reads SHALL perform no device requests. Trace: issue #2 criteria 1, 3 and 4.

#### Scenario: Start the built application
- **WHEN** a developer runs the documented simulator command after dependency installation
- **THEN** the browser page and GET /api/health are served from the printed loopback URL by the same backend
- **AND** no hardware is connected or contacted

#### Scenario: Stop the server
- **WHEN** the running process receives a shutdown signal
- **THEN** it releases its listener and exits without deleting runtime data

### Requirement: Explicit readiness and simulator status
The health endpoint SHALL report server readiness separately from device connectivity, without returning private filesystem paths. The UI SHALL distinguish loading, unavailable service, and a ready backend with its selected mode. Trace: issue #2 criterion 3.

#### Scenario: Ready foundation
- **WHEN** the ready simulator server is queried
- **THEN** it returns HTTP 200 with status ready, mode simulator, and device connected false
- **AND** the page displays Simulator mode and Server ready with available simulator controls clearly separated from physical-device connectivity

#### Scenario: Health unavailable
- **WHEN** the browser cannot obtain a valid health response
- **THEN** it displays an actionable service-unavailable message and offers retry instead of claiming readiness

### Requirement: External runtime configuration
The application SHALL use PIXOO_DATA_DIR for an absolute runtime directory outside source control, defaulting to the user's local application data directory. It SHALL fail before listening on invalid configuration, unusable storage, or invalid mode/device settings. Trace: issue #2 criterion 4 and issue #42 criteria 1-2.

#### Scenario: Valid external directory
- **WHEN** an external data directory is supplied
- **THEN** startup creates missing directories and verifies they are usable without overwriting existing data

#### Scenario: Source directory or symlink alias
- **WHEN** the configured data directory is inside the current checkout or another Git checkout, including through a symlink
- **THEN** startup rejects the configuration before creating that data directory or listening

#### Scenario: Invalid settings
- **WHEN** the data directory is relative or blank, mode is neither simulator nor device, or port is not an integer from 0 through 65535
- **THEN** startup reports a configuration error and exits unsuccessfully

## ADDED Requirements

### Requirement: Explicit physical startup
Device mode SHALL require explicit PIXOO_MODE=device and a valid version-1 private device configuration containing a canonical private IPv4 target and pixoo64-smoke-2026-09-06 profile. Missing or invalid device settings SHALL fail before listening or any device request. Default startup SHALL remain simulator-only even with saved hardware settings. Startup SHALL capture immutable target/profile settings; saving settings or connecting a client SHALL NOT activate or retarget hardware. Startup SHALL restore context paused without sending a device request. Trace: issue #42 criteria 1-3.

#### Scenario: Missing or incompatible device configuration
- **WHEN** device mode is explicitly selected but settings are absent, malformed, a symlink, oversized, or specify an unsupported device profile
- **THEN** startup fails without listening or contacting a target
- **AND** existing settings and media remain intact

#### Scenario: Default mode with saved device target
- **WHEN** the application starts without PIXOO_MODE=device and valid smoke settings exist
- **THEN** it serves a simulator and performs no device requests

#### Scenario: Explicit device mode
- **WHEN** the application starts in device mode with valid private smoke settings
- **THEN** it binds only IPv4 loopback and captures one immutable device target/profile
- **AND** saved playback context opens paused without probing or writing to the display

### Requirement: Local device writer ownership
The backend SHALL claim exclusive local ownership for the configured target independently of the chosen runtime data directory before allowing physical operations. A conflicting backend for that target in the same user environment SHALL fail without device requests. Shutdown SHALL cancel pending operations, retain paused recovery and hold device ownership until in-flight transport settles, without clearing or restoring display content. Trace: issue #42 criteria 1-3.

#### Scenario: Same target with different runtime directories
- **WHEN** a second backend starts for a locally owned target using another data directory
- **THEN** it fails with a busy ownership error before sending a device request

#### Scenario: Shutdown during upload
- **WHEN** shutdown interrupts a physical upload
- **THEN** no further frames or reset/display restoration commands are submitted
- **AND** ownership is released only after in-flight transport settles, while prior effects remain possible
