## MODIFIED Requirements

### Requirement: Backend lifetime is independent of the browser
Documented native startup SHALL serve production UI and API from one loopback
origin, retain external data across graceful shutdown, and keep orchestration
running after all browser pages close while the host and process remain awake.
Documentation SHALL describe Windows/WSL reachability checks and native Windows
as an alternative. Source delivery SHALL NOT install services or change
networking policy. Trace: issue #10 startup, browser lifetime and platform criteria.

#### Scenario: Browser closes during playback
- **WHEN** a browser starts a bounded playlist and closes before it finishes
- **THEN** the backend continues advancing the playlist and reports the resulting state to a later client

## ADDED Requirements

### Requirement: Optional Linux user service
The repository SHALL provide a placeholder-based systemd user-service template and private environment example for one installed backend per data directory. The example SHALL select device mode, monitoring, the controller flag and the stable controller identity. The service SHALL start with the user manager, restart on failure within a bounded start limit, and stop with SIGTERM within a timeout longer than the device transport deadline so the player drains and the catalog closes. Documentation SHALL cover install, upgrade, rollback and removal, keep private paths and settings outside Git, and state that installing the service is a separately authorized step. Trace: [issue #77](https://github.com/jimmie-potts/divoom-app-upgrade/issues/77).

#### Scenario: Example settings select hub operation
- **WHEN** the example environment is loaded with a private data directory holding valid device settings
- **THEN** startup configuration selects device mode with monitoring, the controller and the documented controller identity enabled

#### Scenario: Service manager stops the backend
- **WHEN** the backend receives SIGTERM during active playback
- **THEN** it exits successfully, and the next start on the same data directory opens the catalog with the interrupted session paused
