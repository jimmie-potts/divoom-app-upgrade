## REMOVED Requirements

### Requirement: Inactive recovery and bounded failure
**Reason**: The issue #77 owner decision reverses "restart requires explicit display activation" for device mode. Its scenario "Restart and screen-on are passive" no longer holds for a device-mode restart.
**Migration**: Replaced by "Startup recovery and bounded failure", which keeps screen-off, screen-on, simulator and failed-transmission behavior and adds device-mode startup restore.

## ADDED Requirements

### Requirement: Startup recovery and bounded failure
Restart SHALL retain mode, filters and paused media context and restore active sessions uncertain through the state owner. In device mode, startup with a saved Monitor selection and a requested screen-on state SHALL restore Monitor presentation through the existing player generation and serialized adapter, without a client command or new request identity ([issue #77](https://github.com/jimmie-potts/divoom-app-upgrade/issues/77) owner decision). Simulator startup, a saved Media selection and a retained screen-off request SHALL remain passive until explicit activation. Screen-off SHALL stop monitoring work; screen-on SHALL NOT resume playback or monitoring. Failed monitor transmission, including the first after startup, SHALL suspend monitoring until explicit activation, with no automatic retries after uncertain effects.

#### Scenario: Device startup restores Monitor
- **WHEN** a device-mode backend starts with saved Monitor mode and the screen requested on
- **THEN** playback context stays paused, participation becomes active and the newest complete picture is submitted through the serialized adapter without a client command

#### Scenario: Simulator, Media, screen-off and screen-on stay passive
- **WHEN** a backend starts in simulator mode, starts with saved Media mode, restarts with a retained screen-off request, or the user turns a stopped screen on
- **THEN** snapshots and previews remain available but no monitor upload occurs before explicit activation

#### Scenario: Uncertain transmission
- **WHEN** a monitor write fails with possible prior effects, including the first write after startup
- **THEN** the current view remains selected but participation is inactive, uncertainty is reported, and no automatic probe or retry occurs

## MODIFIED Requirements

### Requirement: Authoritative reconnect and source-only delivery
The browser SHALL reconcile from current snapshots after sequence-aware SSE reconnect and ignore stale events/responses. Reconnect SHALL NOT replay mode transitions or missed pictures. Normal startup SHALL remain simulator-only; this capability SHALL NOT install hooks, discover hardware or expand MCP tools.

#### Scenario: Reconnect or owner cutover
- **WHEN** a client reconnects, the backend restarts, or the selected session owner is explicitly switched and rolled back
- **THEN** the browser resyncs current mode/view and shared state without creating local agent-state authority, and the reconnect itself does not activate the display
