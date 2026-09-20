## Purpose

Qualify synthetic Pixoo dashboard updates with bounded traffic and reproducible previews while keeping software, transport and visible-device evidence separate.

## ADDED Requirements

### Requirement: Explicit bounded experiment
The comparison tool SHALL default to a fake adapter, ignore device environment activation in fake mode, and reject unknown or invalid options before device setup. Physical mode SHALL require an explicit protocol-tool target, source revision, test owner, model/firmware record, display replacement consent and confirmation that external writers are stopped. Both protocol tools SHALL share the normal backend's local target lock and retain it until transport closure. Cross-host exclusion SHALL remain an operator responsibility.

#### Scenario: Default invocation
- **WHEN** the operator invokes the tool without physical flags, even with a device environment target
- **THEN** only synthetic fake operations occur and the report makes no transport or physical success claim

#### Scenario: Competing writer or missing authorization
- **WHEN** physical prerequisites are missing or another local process holds the target lock
- **THEN** the tool fails before sending a device command

### Requirement: Latest-picture delivery within bounds
The experiment SHALL use the existing serialized adapter for complete single-frame uploads, a configurable 1000–10000 ms cadence, a 1000–60000 ms run deadline and at most 20 uploads. Defaults SHALL be provisional 3000 ms cadence and 15000 ms duration. It SHALL coalesce obsolete pending pictures, stop on the first failure or cancellation, and perform no retry or automatic reset/restoration. Each operation SHALL be limited by the remaining deadline and a 5000 ms timeout.

#### Scenario: Burst during an upload or cadence wait
- **WHEN** several synthetic pictures arrive before the next upload is eligible
- **THEN** only the latest eligible picture is submitted next and older pending pictures are counted as coalesced

#### Scenario: Uncertain failure
- **WHEN** an upload fails with possible prior effects
- **THEN** no subsequent upload or recovery command is submitted and the report preserves uncertainty

### Requirement: Reproducible synthetic pictures
The tool SHALL provide synthetic 64×64 complete RGB cases with a summary strip, four rows, provider/state icons, short labels, subagent counts, attention totals, overflow pages, row removal and rapid changes. Browser previews SHALL use exactly the upload RGB bytes without device fonts. Text/item execution SHALL remain unavailable unless command support and exact-preview reproduction are qualified; inability to establish those properties SHALL be reported rather than replaced by guessed commands.

#### Scenario: Preview and stale row clearing
- **WHEN** a full four-row case is followed by a shorter case
- **THEN** the complete replacement clears removed rows and the browser canvas pixels match the complete upload frame

### Requirement: Separate evidence and pending physical decision
Reports SHALL identify the candidate, settings, synthetic case, frame hash, event/submission/completion timing and operation outcomes, excluding device IP and raw device responses. Acknowledgment latency SHALL never be labeled visible latency. The procedure SHALL require fresh settings observations and record restoration limits before replacement. Documentation SHALL leave physical measurements and the final method/cadence decision pending until dated observations satisfy issue #30.

#### Scenario: Successful transport without an observer
- **WHEN** every physical operation is acknowledged but visible measurements are absent
- **THEN** the result remains observation-pending and cannot close physical acceptance
