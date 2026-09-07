## MODIFIED Requirements

### Requirement: Immutable session and independent intent
Playback SHALL expose idle, loading, playing, paused, reconnecting and error states. Active, paused or stopped user intent SHALL remain independent from device availability. Each session SHALL retain its immutable source, unique item identities, policies and rendition references, including the captured revision for saved playlists. Temporary media SHALL identify its actual rendition without claiming a saved playlist ID or revision. Saved edits SHALL affect a new session only; restart-with-changes SHALL explicitly capture the current saved playlist revision and SHALL reject temporary-media context without changing playback. Trace: issue #25 temporary-session and error criteria in addition to issue #7.

#### Scenario: Edit an active playlist
- **WHEN** the saved playlist changes during playback
- **THEN** current playback keeps its captured items and policies until an explicit new session starts

#### Scenario: Temporary source controls
- **WHEN** a temporary media session is paused, resumed, stopped or navigated
- **THEN** existing playback semantics apply to its immutable item
- **AND** restart-with-changes returns unsupported-operation without retiring that session

## ADDED Requirements

### Requirement: Selection admission preserves prior playback
Invalid or superseded content selection SHALL NOT retire the existing writer generation, change prior intent, or replace the prior checkpoint. Accepted selection SHALL replace context coherently before new playback begins, and later cancellation SHALL remain effective during pending admission. Trace: issue #25 invalid-selection and concurrency criteria.

#### Scenario: Invalid selection while playing
- **WHEN** unknown media, an incompatible rendition, invalid computed policy or stale playlist revision is selected during playback
- **THEN** the typed failure leaves prior playback and retained context unchanged

#### Scenario: Stop during queued capture
- **WHEN** stop supersedes a start waiting for capture
- **THEN** stop cancels future playback immediately and the late capture cannot replace context or restart output

#### Scenario: Checkpoint adoption and subsequent save
- **WHEN** a valid capture commits while another control is waiting
- **THEN** that control observes the newly committed context or supersedes capture before commit
- **AND** no old session save overwrites the replacement or causes an ownership failure
