# Controller UI

## Purpose

Let users manage local media and playlists and control simulator playback from accessible desktop and phone-sized browser views.

## Requirements

### Requirement: Media library and effective previews
The browser SHALL upload bounded PNG/JPEG/GIF files, browse/search the catalog, delete unreferenced assets, and preview selected effective renditions. It SHALL offer fit/crop, nearest/smooth scaling and background color without modifying originals or existing playlist references. Trace: issue #9 criteria 1-2.

#### Scenario: Upload and transform
- **WHEN** a user uploads an image or animation and opens it
- **THEN** the effective preview, dimensions, frame count, loop duration and timing warnings are visible
- **AND** a new transform defaults to fit, nearest scaling and black padding and is saved as an immutable rendition

#### Scenario: Invalid or referenced media
- **WHEN** upload, rendering or deletion fails
- **THEN** an actionable error is visible and existing media and playlist references remain intact

### Requirement: Revisioned playlist editor
The browser SHALL create, rename, duplicate and delete named playlists, add repeated renditions, remove items, reorder with keyboard/touch buttons and save independent inline duration or total-play policies. It SHALL default to 30 seconds per still, three total plays per animation, repeat on and shuffle off. Trace: issue #9 criteria 1-3.

#### Scenario: Mixed playlist
- **WHEN** a user adds an image, a GIF and a duplicate asset and edits their timing/order
- **THEN** saved entries retain independent policies and stable identities across refresh
- **AND** animation duration and total-play modes are both available while stills use duration

#### Scenario: Concurrent editing
- **WHEN** another client changes the loaded playlist revision before a save
- **THEN** the stale save is rejected, the local draft remains visible and explicit reload offers the current revision without overwriting the other client

### Requirement: Honest live player controls
The browser SHALL provide start, pause playlist, resume, stop, next, previous, restart-with-changes and clear-session controls. It SHALL show active playlist/item, captured versus saved revision, intent, loading/availability/errors and estimated remaining time separately from server readiness. Trace: issue #9 criteria 3 and 5.

#### Scenario: Session edits and controls
- **WHEN** saved playlist changes differ from the playing snapshot
- **THEN** the current session is unchanged until explicit restart-with-changes
- **AND** labels explain pause advancement, resume from the beginning and stop leaving last content

#### Scenario: Reconnect and lost command response
- **WHEN** a stream disconnects or a command response is lost
- **THEN** reconnect reconciles authoritative state without replaying user intent
- **AND** an uncertain command can only retry its original payload/identity or be discarded after explicit reconciliation
- **AND** duplicate or older event identities do not regress displayed state

### Requirement: Simulator settings and responsive access
The browser SHALL persist explicit private device IP, profile and optional model/firmware notes and provide serialized screen/brightness controls through the API. It SHALL clearly label simulator mode and no verified physical connection. Controls SHALL fit desktop and phone viewports with labels, focus indicators and touch targets. Trace: issue #9 criteria 3-5.

#### Scenario: Configure and control
- **WHEN** valid settings are saved, probed, or display controls are used
- **THEN** the UI reports simulated outcomes without activating hardware or suggesting verified connectivity
- **AND** screen off pauses orchestration while screen on requires an explicit resume

#### Scenario: Browser journey
- **WHEN** a desktop or phone-viewport user uploads image/GIF media, creates a mixed playlist, edits timing/order, plays/skips/stops and refreshes
- **THEN** saved data and authoritative state remain usable without horizontal overflow
- **AND** this evidence makes no physical phone or display claim
