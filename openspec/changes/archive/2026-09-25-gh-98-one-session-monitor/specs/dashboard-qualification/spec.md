## MODIFIED Requirements

### Requirement: Latest-picture delivery within bounds
The experiment SHALL use the existing serialized adapter for complete pictures of one frame, or two frames at a uniform 500 ms delay, each as one upload, with a configurable 1000–10000 ms cadence, a 1000–60000 ms run deadline and at most 20 uploads. Defaults SHALL be provisional 3000 ms cadence and 15000 ms duration. It SHALL coalesce obsolete pending pictures, stop on the first failure or cancellation, and perform no retry or automatic reset/restoration. Each operation SHALL be limited by the remaining deadline and a 5000 ms timeout.

#### Scenario: Burst during an upload or cadence wait
- **WHEN** several synthetic pictures arrive before the next upload is eligible
- **THEN** only the latest eligible picture is submitted next and older pending pictures are counted as coalesced

#### Scenario: Uncertain failure
- **WHEN** an upload fails with possible prior effects
- **THEN** no subsequent upload or recovery command is submitted and the report preserves uncertainty

#### Scenario: Two-frame picture
- **WHEN** a synthetic picture has a pulse frame
- **THEN** one upload carries both frames at 500 ms and the report hashes both frames

### Requirement: Reproducible synthetic pictures
The tool SHALL provide synthetic 64×64 complete RGB cases in the one-session monitor layout: a summary strip, a state tile, provider marks, a two-line label, subagent counts, attention totals, a two-frame attention pulse, successive pages, session removal and rapid changes. Browser previews SHALL use exactly the upload RGB bytes of every frame without device fonts. Text/item execution SHALL remain unavailable unless command support and exact-preview reproduction are qualified; inability to establish those properties SHALL be reported rather than replaced by guessed commands.

#### Scenario: Preview and stale row clearing
- **WHEN** a session case is followed by an empty case
- **THEN** the complete replacement clears the previous session and the browser canvas pixels match every upload frame
