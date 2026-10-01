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
