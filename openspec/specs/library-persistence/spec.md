# Library persistence specification

## Purpose

Persist the media catalog and revisioned playlists while protecting every rendition referenced by a playlist or retained session. This capability implements [issue #6](https://github.com/jimmie-potts/divoom-app-upgrade/issues/6) criteria 1-4.

## Requirements

### Requirement: Versioned private catalog
The library SHALL migrate its SQLite metadata transactionally under configured private storage outside Git. It SHALL preserve asset content hashes and original metadata, store immutable rendition manifests, and reject incompatible newer or foreign databases without resetting them. Restart SHALL retain committed metadata and media.

#### Scenario: Migration fails
- **WHEN** a migration statement fails
- **THEN** that migration rolls back without advancing its version or losing earlier committed metadata

#### Scenario: Process restarts
- **WHEN** the library closes or its owning process exits and it is reopened
- **THEN** committed assets, playlists, item identities, revisions and session references remain available

### Requirement: Revisioned playlist editing
The library SHALL create, rename, duplicate, delete and edit ordered named playlists. Each mutation of an existing playlist SHALL require its expected revision and reject stale revisions without partial changes. Item identities SHALL remain stable through reorder and edits; duplicates SHALL receive new item identities while retaining immutable rendition references. Repeated assets with different policies SHALL be allowed.

#### Scenario: Concurrent stale edit
- **WHEN** two edits supply the same initial revision
- **THEN** only the first committed edit succeeds and the other receives a revision-conflict error with the current revision

#### Scenario: Repeat an asset and reorder
- **WHEN** a playlist includes the same rendition twice with different valid policies and is reordered
- **THEN** both unique item IDs and policies remain attached to their respective entries

### Requirement: Valid playback policies
Duration and total-play values SHALL be finite positive safe integers. Only a rendition with more than one effective frame SHALL accept a total-plays policy. Default policies SHALL be 30000 ms for stills and three total plays for animations. A single-frame GIF SHALL use still-item policy validation. Playlist defaults SHALL enable repeat and disable shuffle.

#### Scenario: Invalid plays or durations
- **WHEN** a policy is fractional, nonfinite, nonpositive, or requests plays for a still
- **THEN** the edit fails with a typed validation error and leaves the playlist revision unchanged

### Requirement: Reference-safe media lifecycle
The library SHALL retain originals and immutable renditions referenced by playlists or persisted session references. Deleting a referenced asset SHALL fail with actionable playlist/session identifiers. Editing or deleting a playlist SHALL NOT release a session's references. Sessions SHALL remain protected across restart until explicitly released.

#### Scenario: Active rendition outlives its playlist
- **WHEN** a session retains a rendition and the playlist is edited or removed
- **THEN** asset deletion remains blocked until the session releases its references

#### Scenario: Transform changes
- **WHEN** an asset receives a different transform or profile
- **THEN** a new rendition identity is cataloged without changing existing playlist/session references or their cached files

### Requirement: Recoverable file cleanup
The library SHALL coordinate imports, deletion and recovery under one exclusive owner. Unreferenced-asset deletion SHALL record cleanup intent durably before removing files and SHALL retry unfinished cleanup on reopen. Failed imports SHALL clean their owned partial files. Recovery SHALL preserve unrecognized files and committed media rather than broadly sweeping storage.

#### Scenario: File deletion fails after metadata commit
- **WHEN** a cleanup step cannot finish
- **THEN** a typed cleanup-pending error identifies the asset, its durable cleanup record remains, and retry completes only the recorded deletion

#### Scenario: Another owner opens the same directory
- **WHEN** a live library owner already holds that storage directory
- **THEN** a second owner fails with a typed busy error; process exit releases ownership without manual lock deletion

### Requirement: Guarded checkpoint capture
Session capture SHALL validate the selected immutable content, expected saved revision when supplied, policies and selected profile before replacing checkpoint or references. Revision checking and replacement SHALL be atomic with respect to catalog edits. Superseded admission SHALL NOT replace context. Trace: issue #25 revision, invalid-selection and concurrency criteria.

#### Scenario: Edit or cancellation at admission
- **WHEN** an edit invalidates a supplied revision or a later control supersedes capture before commit
- **THEN** capture returns a typed conflict or cancellation and retains the preceding checkpoint and references

### Requirement: Temporary media retention
A single-media checkpoint SHALL retain an immutable source identity and one rendition without inserting or modifying saved playlists. Source and snapshot SHALL be immutable on subsequent saves. Old checkpoints lacking explicit source metadata SHALL remain readable as saved-playlist context. Paused or stopped media context SHALL retain references through restart until replacement or clear. Trace: issue #25 temporary-session and retention criteria.

#### Scenario: Restart and attempted deletion
- **WHEN** a temporary session is paused, reopened and its asset is requested for deletion
- **THEN** the same source restores with its retained rendition and deletion reports the retaining session
- **AND** no saved playlist was created

#### Scenario: Legacy checkpoint and changed source
- **WHEN** an old saved-playlist checkpoint is reopened or a caller attempts to alter the source of an existing checkpoint
- **THEN** old context remains readable and the source mutation fails without changing retained ownership
