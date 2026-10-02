## ADDED Requirements

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

## MODIFIED Requirements

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
