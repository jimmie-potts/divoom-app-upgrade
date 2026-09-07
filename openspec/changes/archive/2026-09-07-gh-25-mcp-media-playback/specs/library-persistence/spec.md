## ADDED Requirements

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
