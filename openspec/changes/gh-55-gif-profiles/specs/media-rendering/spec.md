## MODIFIED Requirements

### Requirement: Runtime profile compatibility
Applications in both runtime modes SHALL render new library media under the existing simulator-v1 application budget: 500 frames, 10 MiB upload, 50-million composed-source pixels and a 30-second job deadline. Device playback SHALL independently validate every prepared rendition against its active profile before upload; the historical profile SHALL remain one or two complete 64x64 RGB frames at exactly 500 ms. An explicitly selected pixoo64-gif-2026-09-30 profile SHALL admit up to 20 complete frames with variable effective delays from 100 through 800 ms as a bounded envelope inferred from recorded physical observations. Saving a profile SHALL require restart to affect runtime admission. Existing renditions SHALL remain immutable and may be used only when their actual frames and delays satisfy the active profile. Incompatible media SHALL produce a typed profile error without device requests, truncation or retiming. Simulator mode SHALL retain its provisional simulator profile. Trace: issue #42 criteria 4-5 and issue #55 AC1–AC2.

#### Scenario: Incompatible existing rendition
- **WHEN** a saved session references an animation whose frame count or effective delays exceed the selected physical profile
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

#### Scenario: Complete import despite unqualified playback
- **WHEN** a 20-frame GIF with varied effective delays is imported in device mode within the application budget
- **THEN** every frame and effective delay persists and remains previewable after restart without a device request
- **AND** incompatible physical playback rejects before replacing current context or queueing device work


#### Scenario: Select the observed GIF profile
- **WHEN** device mode starts with the explicitly saved pixoo64-gif-2026-09-30 profile
- **THEN** the adapter, player and catalog compatibility use its 20-frame and 100–800 ms bounds with variable timing
- **AND** saving another profile does not change active admission until restart
- **AND** prior smoke-profile and simulator renditions retain their identities and may play only if their actual frames and delays fit the selected bounds
