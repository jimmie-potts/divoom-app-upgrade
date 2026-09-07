## ADDED Requirements

### Requirement: Runtime profile compatibility
A device-mode application SHALL render new media using pixoo64-smoke-2026-09-06 and validate every prepared rendition against its bounds before upload: one or two complete 64x64 RGB frames at exactly 500 ms effective delay per frame. Existing renditions SHALL remain immutable and may be used only when their actual frames and delays satisfy the active profile. Incompatible media SHALL produce a typed profile error without device requests, truncation or retiming. Simulator mode SHALL retain its provisional simulator profile. Trace: issue #42 criteria 4-5.

#### Scenario: Incompatible existing rendition
- **WHEN** a saved session references an animation with too many frames or an effective delay other than 500 ms in device mode
- **THEN** preparation fails with a typed profile error before sending any upload command
- **AND** original media, rendition identity and retained references remain unchanged

#### Scenario: Compatible existing rendition
- **WHEN** a prior simulator rendition contains one or two frames satisfying the active smoke bounds
- **THEN** device playback may use its exact immutable bytes and effective animation delays
- **AND** the stored profile and rendition identity remain unchanged

#### Scenario: Still transport placeholder
- **WHEN** a PNG/JPEG still is prepared for device playback
- **THEN** its single upload frame uses a 500 ms transport placeholder and its duration policy alone determines dwell
- **AND** GIF effective delays, including single-frame GIF delays, are never replaced by that placeholder
