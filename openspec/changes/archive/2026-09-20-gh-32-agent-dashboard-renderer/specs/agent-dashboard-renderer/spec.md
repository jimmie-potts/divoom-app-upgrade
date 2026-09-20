## Purpose

Project shared agent session evidence onto an exact, paged 64x64 Pixoo rendition without interpreting providers or requiring physical transport. Source: issue #32.

## ADDED Requirements

### Requirement: Stable compact session projection

The dashboard SHALL show a summary and at most four top-level sessions per page, provider and activity symbols, short user labels, attributable active-child counts and uncertainty. Color SHALL NOT be the only distinction. Blocking approval/input SHALL precede continuing questions, then retained notices, then other sessions, with deterministic identity ordering within each group. Attention totals SHALL remain visible across pages.

#### Scenario: Mixed priorities and child evidence
- **WHEN** a snapshot includes blocked input, a continuing question, attributable children and unknown evidence
- **THEN** priority and identity determine row order, known children are not duplicate top-level rows, activity remains separate from question/blocking symbols, and missing child evidence is visibly unknown

### Requirement: Independent timed pagination

Overflow SHALL rotate every ten seconds using injectable time independently of render cadence. Session/filter changes SHALL clamp the page, preserve stable ordering and restart the page interval. Empty results SHALL retain summary/health information.

#### Scenario: Overflow shrinks or filters change
- **WHEN** a later page loses its rows or a filter reduces the matching sessions
- **THEN** the page clamps to the last valid page, and the next rotation occurs ten seconds after the changed membership

### Requirement: Preserve shared evidence semantics

Notices SHALL reflect the selected consumer's shared acknowledgments and new-turn policy without renderer persistence or inferred task success. Observation freshness SHALL be distinct from collector and source health.

#### Scenario: Restart, dismissal and new turn
- **WHEN** shared state retains or removes a notice after restart, acknowledgment or a new turn
- **THEN** the next rendition reflects that state and never substitutes task-completed or chat-read semantics

#### Scenario: Stale source with running collector
- **WHEN** the source becomes stale while its cached collector reports running
- **THEN** source health and uncertain observations remain visible without declaring the collector stopped

### Requirement: Exact portable rendition

The renderer SHALL produce deterministic 12288-byte RGB888 pixels and a browser preview of those same pixels. It SHALL publish layout data, full labels and precise evidence timestamps outside the constrained rows. Short labels SHALL use an explicit bounded bitmap alphabet, truncation marker and unsupported-character fallback.

#### Scenario: Unsupported and long labels
- **WHEN** a user label contains unsupported characters or exceeds the row width
- **THEN** fallback and truncation are deterministic, the full label remains available outside the pixels, and browser pixels equal the RGB rendition

### Requirement: Bounded current-state publication

The rendering service SHALL coalesce bursts to one newest pending snapshot alongside at most one active render. Superseded or closed generations SHALL NOT publish. Rendering cadence SHALL be configurable independently of pagination. Resync SHALL replace current state, including deletions, and failures SHALL NOT publish partial frames.

#### Scenario: Slow obsolete render and state burst
- **WHEN** newer snapshots arrive while rendering is pending
- **THEN** only the newest generation can publish, pending work stays bounded, and cadence does not alter the ten-second page schedule

### Requirement: Source-only preview boundary

Authenticated preview reads SHALL consume the selected session-source facade and preserve existing read security. Rendering and synthetic simulator examples SHALL remain usable without device configuration. Monitoring SHALL NOT take over media or invoke a physical writer.

#### Scenario: Preview access and simulator use
- **WHEN** a reader requests a rendition or synthetic pixels are sent to the deterministic fake
- **THEN** authorized preview pixels match layout output, unauthorized reads fail, and no physical command or provider interpretation occurs
