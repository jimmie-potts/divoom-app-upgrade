# MCP media playback specification

## Purpose

Let authenticated local agents select existing Pixoo renditions and playlists and control backend-owned playback with bounded results and shared request identity.

## Requirements

### Requirement: Bounded identifiable catalog selection
The tools list_media and list_playlists SHALL accept bounded search and pagination, return at most 100 rows per call with stable IDs and deterministic ordering, and distinguish duplicate names. Media rows SHALL identify an exact rendition and its asset with approved effective metadata and active-profile compatibility. Playlist rows SHALL identify revision and bounded summary metadata. Results SHALL exclude private paths, originals and raw manifests. Trace: issue #25 catalog criterion.

#### Scenario: Duplicate names and page boundary
- **WHEN** multiple assets or playlists share a name and a caller searches across adjacent pages
- **THEN** IDs distinguish entries and the stable catalog produces no duplicated or omitted rows between those pages
- **AND** each response respects the requested bounded page size without expanding every playlist's items

### Requirement: Explicit media and revisioned playlist commands
show_media SHALL require rendition_id and request_id with an optional validated policy. play_playlist SHALL require playlist_id, expected revision and request_id. Unknown selections, changed revision, unsupported profile or invalid policy SHALL return typed errors without changing current playback. Temporary media SHALL use established defaults and SHALL NOT create or edit a saved playlist. Trace: issue #25 selection and error criteria.

#### Scenario: Stale selected playlist
- **WHEN** a playlist changes after discovery and before its requested revision is captured
- **THEN** the command reports expected and actual revisions and preserves the preceding session and its references

#### Scenario: Existing rendition and invalid policy
- **WHEN** an exact existing rendition is shown with no override
- **THEN** its effective media uses the established default policy in a temporary session
- **AND** a later unsupported or invalid selection cannot replace that session

### Requirement: Shared controls and bounded outcomes
control_playback SHALL accept exactly pause, resume, stop, next and previous with request_id. Mutations SHALL share application replay, conflict, expiry and ordering rules across HTTP, local MCP and device-ID bindings. Results SHALL expose authoritative bounded session/source/state metadata, loading and estimated timing, and known possible effects without claiming upload completion or visual evidence. Read/write annotations SHALL describe their actual behavior. Trace: issue #25 control, identity and result criteria.

#### Scenario: Lost response and competing caller
- **WHEN** an admitted command loses its response and another caller retries the same identity and intent
- **THEN** both callers receive the retained result without a second execution
- **AND** another intent using that identity returns request-conflict

#### Scenario: Client disconnects during loading
- **WHEN** a client disconnects after starting playback
- **THEN** the backend continues playback through its one writer and later browser controls observe the same session
- **AND** navigation and pause retain established loading, history and timing semantics
