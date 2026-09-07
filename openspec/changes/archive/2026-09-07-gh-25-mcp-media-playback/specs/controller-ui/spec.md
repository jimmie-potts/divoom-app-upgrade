## MODIFIED Requirements

### Requirement: Honest live player controls
The browser SHALL provide start, pause playlist, resume, stop, next, previous, restart-with-changes and clear-session controls. It SHALL show active source/item, captured versus saved revision for saved playlists, intent, loading/availability/errors and estimated remaining time separately from server readiness. Temporary media SHALL be labeled as a temporary media session without a saved revision, and restart-with-changes SHALL be unavailable for that source. Trace: issue #9 criteria 3 and 5 and issue #25 concurrent browser context.

#### Scenario: Session edits and controls
- **WHEN** saved playlist changes differ from the playing snapshot
- **THEN** the current session is unchanged until explicit restart-with-changes
- **AND** labels explain pause advancement, resume from the beginning and stop leaving last content

#### Scenario: Reconnect and lost command response
- **WHEN** a stream disconnects or a command response is lost
- **THEN** reconnect reconciles authoritative state without replaying user intent
- **AND** an uncertain command can only retry its original payload/identity or be discarded after explicit reconciliation
- **AND** duplicate or older event identities do not regress displayed state

#### Scenario: Temporary media shown in the browser
- **WHEN** an agent starts temporary media while the player panel is open
- **THEN** the panel shows the actual media name and temporary-session label without a fabricated saved revision
- **AND** restart-with-changes is disabled while the remaining controls retain their existing semantics
