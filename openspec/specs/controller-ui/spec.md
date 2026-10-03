# Controller UI

## Purpose

Let users manage local media and playlists and control the selected backend mode from accessible desktop and phone-sized browser views.

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

### Requirement: Simulator settings and responsive access
The browser SHALL persist explicit private device IP, profile and optional model/firmware notes and provide serialized screen/brightness controls through the API. It SHALL label the active mode, distinguish saved from active configuration, and report simulator outcomes or observed device transport results without claiming visual verification. Settings changes SHALL indicate when restart is required. Controls SHALL fit desktop and phone viewports with labels, focus indicators and touch targets. Trace: issue #9 criteria 3-5, issue #42 criteria 4-6 and issue #55 AC6.

#### Scenario: Configure and control
- **WHEN** valid settings are saved, probed, or display controls are used in simulator mode
- **THEN** the UI reports simulated outcomes without activating hardware or suggesting verified connectivity
- **AND** screen off pauses orchestration while screen on requires an explicit resume

#### Scenario: Browser journey
- **WHEN** a desktop or phone-viewport user uploads image/GIF media, creates a mixed playlist, edits timing/order, plays/skips/stops and refreshes
- **THEN** saved data and authoritative state remain usable without horizontal overflow
- **AND** this evidence makes no physical phone or display claim

#### Scenario: Device mode and uncertainty
- **WHEN** the browser connects to an explicitly activated device backend
- **THEN** it labels device mode, the selected active profile limits and estimated timing separately from visual evidence
- **AND** an uncertain operation displays its error and explains that explicit resume restarts the item
- **AND** saving settings or reconnecting the browser does not activate hardware, retarget the running backend or replay lost commands

#### Scenario: Explain uniform frame timing
- **WHEN** Settings shows the selected uniform physical profile limits
- **THEN** it explains that every frame uses the same delay and pauses use repeated frames that count toward the frame limit
- **AND** complete mixed-delay imports and previews remain available even though physical playback is unavailable

### Requirement: Preview and playback compatibility are distinct
The media library SHALL show whether a selected rendition satisfies the active playback profile and retain complete preview access when it does not. Unknown compatibility SHALL remain explicit. Saved playlist authoring SHALL remain available regardless of physical compatibility; physical playback admission SHALL still reject incompatible content with a clear reason. Trace: issue #55 AC1 and AC6.

#### Scenario: Preview an animation outside the current device profile
- **WHEN** an admitted animation exceeds the active physical profile
- **THEN** its complete effective preview remains available and the UI explains that physical playback is not qualified
- **AND** the UI permits adding it to a saved playlist without representing that edit as physical playback admission

### Requirement: Optional device notes stay secondary
Settings SHALL keep the saved IP and playback profile visible and place optional model and firmware notes in a collapsed-by-default Device details disclosure. These notes SHALL NOT select the playback profile or gate GIF import and preview. Saving with the disclosure collapsed SHALL preserve existing notes. Trace: issue #55 owner-approved Settings refinement.

#### Scenario: Save settings without editing optional notes
- **GIVEN** a saved model or firmware note
- **WHEN** the operator opens Settings and saves with Device details collapsed
- **THEN** the saved notes remain unchanged and are available when the disclosure is expanded

### Requirement: Read-only build information
Settings SHALL show the running backend's short source revision and make its full
revision selectable and copyable. Unknown or unavailable provenance SHALL remain
explicit. Build information SHALL refresh through the existing server-consistent
runtime read without changing device settings or issuing device commands.
Trace: issue #114 Settings criterion.

#### Scenario: Read and copy a known revision
- **WHEN** Settings has a known running source revision
- **THEN** it shows the short revision and exposes the full value for copying
- **AND** copying reports success or an actionable clipboard failure

#### Scenario: Unqualified build
- **WHEN** the backend reports unknown provenance
- **THEN** Settings labels it unknown without implying that the package version identifies a commit
