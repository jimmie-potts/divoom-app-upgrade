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
