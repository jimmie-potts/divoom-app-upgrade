## MODIFIED Requirements

### Requirement: Simulator settings and responsive access
The browser SHALL persist explicit private device IP, profile and optional model/firmware notes and provide serialized screen/brightness controls through the API. It SHALL label the active mode, distinguish saved from active configuration, and report simulator outcomes or observed device transport results without claiming visual verification. Settings changes SHALL indicate when restart is required. Controls SHALL fit desktop and phone viewports with labels, focus indicators and touch targets. Trace: issue #9 criteria 3-5 and issue #42 criteria 4-6.

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
- **THEN** it labels device mode, active smoke limits and estimated timing separately from visual evidence
- **AND** an uncertain operation displays its error and explains that explicit resume restarts the item
- **AND** saving settings or reconnecting the browser does not activate hardware, retarget the running backend or replay lost commands
