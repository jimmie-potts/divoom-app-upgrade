## MODIFIED Requirements

### Requirement: Authoritative live state
Player snapshots SHALL expose session identity, captured playlist revision and immutable session data, playback intent, adapter availability and estimated timing. SSE SHALL identify each event by server epoch and sequence, replay retained events, and send a full resync when history is unavailable. Stream disconnection SHALL not stop playback. Snapshots SHALL include a server monotonic sample in the same clock domain as timing deadlines so clients can estimate remaining time without comparing unrelated clocks. Trace: issue #8 criteria 2, 3 and 5 and issue #42 criteria 3-5.

#### Scenario: Reconnect stream
- **WHEN** a client reconnects with a retained Last-Event-ID
- **THEN** it receives events after that sequence without reexecuting commands
- **AND** an unknown epoch or expired sequence produces a full authoritative resync

#### Scenario: Restart and shutdown
- **WHEN** the server restarts or shuts down
- **THEN** restart opens the existing session paused with a new server epoch and shutdown closes streams and persistence without deleting data

### Requirement: Explicit device targets and bounded work
Saved device settings SHALL accept only an explicit canonical private IPv4 address and supported fixed profile with bounded model/firmware notes. Simulator mode SHALL never activate hardware from saved settings. All physical HTTP transport SHALL remain fixed to port 80 and /post and reject redirects. HTTP admission, multipart bytes/parts, JSON bodies, command receipt history, event history and stream clients SHALL be bounded. Trace: issue #8 criteria 3-5 and issue #42 criteria 1-3.

#### Scenario: Arbitrary destination
- **WHEN** a client supplies a public address, hostname, URL, port/path override or raw device payload
- **THEN** validation rejects it without network access

#### Scenario: Simulator configuration and overload
- **WHEN** valid device settings are saved and probed in simulator mode, or API capacity is exhausted
- **THEN** configuration survives restart but reports no physical connectivity, and excess work receives a typed busy response

## ADDED Requirements

### Requirement: Active device configuration and evidence
Device status SHALL expose selected mode, saved configuration, active configuration/profile and whether a restart is needed to apply saved changes. Saving settings SHALL NOT alter active adapter ownership or queued command targets. Health and diagnostics SHALL separate server readiness from observed transport availability. Unknown connectivity and unavailable telemetry SHALL remain explicit; transport success SHALL NOT establish visible content or precise timing. Status reads SHALL NOT probe hardware. Trace: issue #42 criteria 1-3 and 5.

#### Scenario: Save another target while running
- **WHEN** valid settings for a different target or profile are saved during device operation
- **THEN** status identifies the pending restart and retains the active startup configuration
- **AND** subsequent commands continue to use the original adapter and target

#### Scenario: Device operation results
- **WHEN** a probe or display command is submitted in device mode
- **THEN** it uses the player-owned queue and returns typed observed results without inventing visual or unavailable telemetry
- **AND** display command retries retain the existing shared request identity and cannot duplicate effects

#### Scenario: Readiness without device observation
- **WHEN** the ready device-mode server is queried before any successful transport result
- **THEN** readiness remains distinct from unknown device connectivity
- **AND** no query sends a device request
