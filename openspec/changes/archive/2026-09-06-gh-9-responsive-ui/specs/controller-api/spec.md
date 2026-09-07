## MODIFIED Requirements

### Requirement: Authoritative live state
Player snapshots SHALL expose session identity, captured playlist revision and immutable session data, playback intent, simulator availability and estimated timing. SSE SHALL identify each event by server epoch and sequence, replay retained events, and send a full resync when history is unavailable. Stream disconnection SHALL not stop playback. Snapshots SHALL include a server monotonic sample in the same clock domain as timing deadlines so clients can estimate remaining time without comparing unrelated clocks. Trace: issue #8 criteria 2, 3 and 5.

#### Scenario: Reconnect stream
- **WHEN** a client reconnects with a retained Last-Event-ID
- **THEN** it receives events after that sequence without reexecuting commands
- **AND** an unknown epoch or expired sequence produces a full authoritative resync

#### Scenario: Restart and shutdown
- **WHEN** the server restarts or shuts down
- **THEN** restart opens the existing session paused with a new server epoch and shutdown closes streams and persistence without deleting data
