# Controller API

## Purpose

Expose the local controller through validated HTTP commands and recoverable state streams while protecting private media, explicit device selection and command ownership.

## Requirements

### Requirement: Validated controller routes
The API SHALL expose the handoff section 5 media, playlist, device configuration, probe, display, player and event functions with shared strict runtime schemas and consistent typed errors. It SHALL reject raw device commands, arbitrary paths and remote media URLs. Trace: issue #8 criteria 1 and 3.

#### Scenario: Import and edit a playlist
- **WHEN** a client uploads one bounded PNG/JPEG/GIF, creates a playlist and replaces its items
- **THEN** it receives immutable rendition metadata and a revisioned playlist with accepted playback defaults
- **AND** named preview routes serve only validated rendition frames

#### Scenario: Invalid upload or retained asset
- **WHEN** an upload is malformed, oversized or contains extra parts, or a referenced asset is deleted
- **THEN** the API returns a typed error and preserves existing originals, playlists and retained sessions

### Requirement: Concurrency and command identity
Playlist mutations SHALL require an expected revision. Player commands SHALL use a server-issued epoch and monotonically sequenced request identity. Concurrent matching replays SHALL share the same result; different payloads at one identity SHALL conflict. Old or expired identities SHALL never execute again, including after restart. Trace: issue #8 criteria 2 and 5.

#### Scenario: Stale editor
- **WHEN** two clients edit the same playlist revision
- **THEN** exactly one edit succeeds and the other receives a revision conflict with current revision information

#### Scenario: Command replay and restart
- **WHEN** clients replay a command, use its identity for a different command, or submit an identity from a previous server lifetime
- **THEN** the matching retained replay returns its original result and conflicting or expired requests are rejected without another action

### Requirement: Authoritative live state
Player snapshots SHALL expose session identity, captured playlist revision and immutable session data, playback intent, adapter availability and estimated timing. SSE SHALL identify each event by server epoch and sequence, replay retained events, and send a full resync when history is unavailable. Stream disconnection SHALL not stop playback. Snapshots SHALL include a server monotonic sample in the same clock domain as timing deadlines so clients can estimate remaining time without comparing unrelated clocks. Trace: issue #8 criteria 2, 3 and 5 and issue #42 criteria 3-5.

#### Scenario: Reconnect stream
- **WHEN** a client reconnects with a retained Last-Event-ID
- **THEN** it receives events after that sequence without reexecuting commands
- **AND** an unknown epoch or expired sequence produces a full authoritative resync

#### Scenario: Restart and shutdown
- **WHEN** the server restarts or shuts down
- **THEN** restart opens the existing session paused with a new server epoch and shutdown closes streams and persistence without deleting data

### Requirement: Local request security
The server SHALL remain loopback-only and validate the exact listener host/port and any Origin. Unsafe requests SHALL require same-origin evidence or an explicit non-simple request header. Cross-site requests and arbitrary forwarded hosts SHALL not authorize access. An authentication hook SHALL gate API reads, writes and streams before effects when configured. Trace: issue #8 criteria 4 and 5.

#### Scenario: Untrusted caller
- **WHEN** a caller supplies a foreign host/origin, cross-site fetch metadata or a simple mutation without origin evidence
- **THEN** the server rejects the request without storage or player effects

#### Scenario: Authentication hook
- **WHEN** the configured authentication hook denies or fails
- **THEN** API data and effects remain unavailable, including event streams, with sanitized errors

### Requirement: Explicit device targets and bounded work
Saved device settings SHALL accept only an explicit canonical private IPv4 address and supported fixed profile with bounded model/firmware notes. Simulator mode SHALL never activate hardware from saved settings. All physical HTTP transport SHALL remain fixed to port 80 and /post and reject redirects. HTTP admission, multipart bytes/parts, JSON bodies, command receipt history, event history and stream clients SHALL be bounded. Trace: issue #8 criteria 3-5 and issue #42 criteria 1-3.

#### Scenario: Arbitrary destination
- **WHEN** a client supplies a public address, hostname, URL, port/path override or raw device payload
- **THEN** validation rejects it without network access

#### Scenario: Simulator configuration and overload
- **WHEN** valid device settings are saved and probed in simulator mode, or API capacity is exhausted
- **THEN** configuration survives restart but reports no physical connectivity, and excess work receives a typed busy response

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
