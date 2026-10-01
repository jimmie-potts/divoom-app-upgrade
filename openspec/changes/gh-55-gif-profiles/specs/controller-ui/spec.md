## ADDED Requirements

### Requirement: Preview and playback compatibility are distinct
The media library SHALL show whether a selected rendition satisfies the active playback profile and retain complete preview access when it does not. Unknown compatibility SHALL remain explicit. Saved playlist authoring SHALL remain available regardless of physical compatibility; physical playback admission SHALL still reject incompatible content with a clear reason. Trace: issue #55 AC1 and AC6.

#### Scenario: Preview an animation outside the current device profile
- **WHEN** an admitted animation exceeds the active physical profile
- **THEN** its complete effective preview remains available and the UI explains that physical playback is not qualified
- **AND** the UI permits adding it to a saved playlist without representing that edit as physical playback admission
