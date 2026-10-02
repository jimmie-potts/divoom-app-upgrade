# media-rendering Specification

## Purpose

Provide bounded, reproducible media renditions whose previews preserve the exact frames and effective timing consumed by later playback. Scope is linked to issue #5, criteria 1-5.

## Requirements

### Requirement: Bounded ingestion and background work
The system SHALL accept signature-validated PNG, JPEG and GIF bytes with configurable default limits of 10 MiB per upload and 50 million decoded source canvas pixels across frames. It SHALL reject unsupported animation containers and malformed or over-budget input before publication. Background work SHALL have bounded concurrency, queue length and a deadline; cancellation or failure SHALL remove only the request's partial files.

#### Scenario: Stream exceeds the upload limit
- **WHEN** a streamed upload crosses its configured byte limit
- **THEN** ingestion fails with a typed limit error and publishes no partial original or rendition

#### Scenario: Decode fails or stalls
- **WHEN** a background decoder fails, exceeds its deadline, or is cancelled
- **THEN** the request fails, its child process terminates before its work slot is released, and existing media remains intact

### Requirement: Source composition and timing
The system SHALL composite GIF patches with transparency, interlacing and disposal modes 0-3, reject unsupported modes, preserve source delays including zero and missing values, and expose effective delays separately. Positive delays SHALL be preserved; missing or zero delays SHALL normalize to 100 ms with per-frame warnings. A single-frame GIF SHALL remain identified as GIF with its frame timing. Embedded repeat policy SHALL NOT determine playback repetitions.

#### Scenario: Restore previous and background
- **WHEN** a GIF uses transparent frame patches and disposal 2 or 3
- **THEN** the next complete canvas reflects restoration of the previous patch area or prior canvas before the next patch is drawn

#### Scenario: Absent timing
- **WHEN** a GIF frame has a missing or zero delay
- **THEN** source metadata retains null or zero, effective timing records 100 ms, and a warning identifies that frame and normalization

### Requirement: Complete transformed frames and previews
The system SHALL preserve accepted original bytes, apply image orientation before fit or center-crop, support nearest and smooth scaling, and flatten transparency onto an explicit RGB background. Every effective frame SHALL contain 64x64 complete RGB pixels. Preview images and their ordered delays SHALL represent these exact effective frames.

#### Scenario: Oriented transparent content
- **WHEN** a supported source is transformed using a selected fit, resampling mode and background
- **THEN** its original stays byte-identical and independently decoded preview pixels equal the rendition RGB frames

### Requirement: Immutable rendition identity and profile gates
The system SHALL identify cached renditions by source hash, canonical transform, renderer version and complete profile. Published files SHALL never be overwritten by another request. Duplicate requests SHALL reuse the completed result; different transforms or profiles SHALL have distinct identities. It SHALL reject profile violations without truncation, frame dropping or timing changes beyond the documented missing-delay normalization. Default limits SHALL be labeled provisional simulator safeguards; an explicitly selected observed device profile SHALL remain limited to its recorded hardware evidence.

#### Scenario: Unsupported timing or frame count
- **WHEN** source frames exceed the selected profile's count or effective timing bounds
- **THEN** the request returns a profile error without publishing a shortened or retimed rendition

#### Scenario: Duplicate concurrent uploads
- **WHEN** equal original bytes, transforms, renderer and profile are submitted concurrently
- **THEN** both requests refer to the same immutable complete rendition and neither removes the other's files

### Requirement: Runtime profile compatibility
Applications in both runtime modes SHALL render new library media under the existing simulator-v1 application budget: 500 frames, 10 MiB upload, 50-million composed-source pixels and a 30-second job deadline. Device playback SHALL independently validate every prepared rendition against its active profile before upload; the historical profile SHALL remain one or two complete 64x64 RGB frames at exactly 500 ms. An explicitly selected pixoo64-gif-2026-10-01 profile SHALL admit up to 20 complete frames with one uniform effective delay from 100 through 800 ms per animation as a bounded envelope inferred from recorded physical observations. Saving a profile SHALL require restart to affect runtime admission. Existing renditions SHALL remain immutable and may be used only when their actual frames and delays satisfy the active profile. Incompatible media SHALL produce a typed profile error without device requests, truncation or retiming. Simulator mode SHALL retain its provisional simulator profile. Trace: issue #42 criteria 4-5 and issue #55 AC1–AC2.

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
- **WHEN** device mode starts with the explicitly saved pixoo64-gif-2026-10-01 profile
- **THEN** the adapter, player and catalog compatibility use its 20-frame and 100–800 ms bounds with uniform timing
- **AND** saving another profile does not change active admission until restart
- **AND** prior smoke-profile and simulator renditions retain their identities and may play only if their actual frames and delays fit the selected bounds

#### Scenario: Pause through repeated frames
- **WHEN** an animation holds a pose using consecutive identical frames with the same delay as every other frame
- **THEN** playback preserves every repeated frame, its order and delay
- **AND** repeats count toward the 20-frame limit rather than being deduplicated

#### Scenario: Mixed delays within the numeric bounds
- **WHEN** a GIF has differing effective frame delays, even if every delay is between 100 and 800 ms
- **THEN** physical admission rejects it before replacing current context or sending a device request
- **AND** imports and complete previews preserve its effective delays without automatic conversion

### Requirement: Lossless hosted profile admission
The separate pixoo64-hosted-2026-10-01 profile SHALL admit at most 500 frames with uniform 50–800 ms whole-centisecond delays, and multi-frame renditions SHALL contain at most 256 distinct effective RGB colors in total. These bounds SHALL be identified as a software admission envelope informed by observed 20×100 ms, 100×50 ms and 500×60 ms fixtures, not a hardware maximum or exhaustive qualification. Prior profiles SHALL remain unchanged. Browser/catalog compatibility and playback admission SHALL agree. Unsupported color or timing SHALL reject before context replacement, preserving full imports, previews, originals and immutable identities. Single-frame images SHALL retain full-color RGB transport. Trace: issue #55 AC1–AC2 and AC4–AC6.

#### Scenario: Too many effective colors
- **WHEN** an otherwise admitted multi-frame rendition needs more than 256 distinct effective colors
- **THEN** hosted compatibility is false and playback rejects with profile-limit before replacing the previous context or issuing a device command
- **AND** complete import and preview remain available without quantization

#### Scenario: Long uniform animation
- **WHEN** a 500-frame animation at uniform 60 ms fits the global color budget
- **THEN** hosted playback can prepare every effective frame and delay without truncation or deduplication
- **AND** a saved or restarted media context preserves its immutable rendition identity
