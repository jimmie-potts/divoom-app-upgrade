# Agent dashboard renderer

## Purpose

Project shared agent session evidence onto an exact, paged 64x64 Pixoo rendition without interpreting providers or requiring physical transport. Source: issue #32.

## Requirements

### Requirement: Stable compact session projection

The dashboard SHALL show a summary strip and one top-level session per page. The session SHALL show its provider, activity, attention, retained notice, attributable active-child count, uncertainty and a short label or title in up to two lines, with a separate project line when available. Activity, provider, attention and health SHALL each be distinguished by shape or words as well as colour. Uncertain evidence SHALL be shown in words, not only as a symbol. Blocking approval/input SHALL precede continuing questions, then retained notices, then other sessions, with deterministic identity ordering within each group. The summary SHALL show the matching session count, the attention total across all pages, the page position and source and collector health on every page, including an empty one.

#### Scenario: Mixed priorities and child evidence
- **WHEN** a snapshot includes blocked input, a continuing question, attributable children and unknown evidence
- **THEN** priority and identity determine page order, known children are not duplicate top-level sessions, activity remains separate from question/blocking attention, and missing child evidence is visibly unknown

#### Scenario: Every legend state is distinguishable without colour
- **WHEN** sessions in each activity, attention, notice and uncertainty state and each source and collector health state are rendered
- **THEN** each state differs from the others in its lit pixel shape or words, not only in colour

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

The renderer SHALL produce deterministic complete 64×64 RGB888 frames, each of 12288 bytes, and a browser preview of those same frames. A rendition SHALL carry every frame in order with their uniform delay, and its single-picture field SHALL equal the first frame. It SHALL publish layout data, full labels, titles, projects and precise evidence timestamps outside the constrained picture. Pixel text SHALL fold accents to base letters before applying its bounded bitmap alphabet, truncation marker and unsupported-character fallback.

#### Scenario: Unsupported and long labels
- **WHEN** a user label contains unsupported characters or exceeds the identifier width
- **THEN** fallback and truncation are deterministic, the full label remains available outside the pixels, and browser pixels equal every RGB frame of the rendition

### Requirement: Distinct row identifiers

The truncation marker SHALL be a glyph that no label or session ID character can produce. Identifiers that fit the 20-character identifier width SHALL be shown whole. The displayed identifier SHALL prefer a shared label, then the shared title, then the session ID. A longer label or title SHALL keep its first and last characters around the marker. A session without a label or title SHALL show its session ID, shortened to the marker and the ID's end, never its start. The renderer SHALL NOT derive identifiers from prompts or paths.

#### Scenario: Unlabeled sessions with a shared ID prefix
- **WHEN** four sessions without labels or titles whose time-ordered IDs share a long prefix are shown on successive pages
- **THEN** each page shows the final characters of its own ID after the marker, the four identifiers differ, and the full IDs remain available outside the pixels

#### Scenario: Labels that differ only at the end
- **WHEN** two long user labels share their opening characters and differ in their final characters
- **THEN** the identifiers keep the opening and final characters around a middle marker and differ

#### Scenario: Shared title and project with an owner label
- **WHEN** a session has a shared title and project, with or without an explicit owner label
- **THEN** the owner label wins when present, the title supplies the otherwise missing identifier, the project appears separately, and attention pulse, activity, children, uncertainty and footer remain visible

#### Scenario: Accented title
- **WHEN** a title contains decomposable accents such as résumé
- **THEN** its pixels contain the base letters RESUME while full Unicode text remains available outside the constrained image

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

### Requirement: Attention-only pulse

A page whose session holds approval, input or question attention SHALL have exactly two frames at a uniform 500 ms delay. The frames SHALL differ only in the state tile and attention indicator. Every other page, including an active session without attention, an empty page and a page whose only attention is elsewhere, SHALL have exactly one frame.

#### Scenario: Working session without attention
- **WHEN** the shown session is active and holds no attention
- **THEN** the rendition has one frame and nothing on the device pulses

#### Scenario: Session waiting for approval
- **WHEN** the shown session holds approval attention
- **THEN** the rendition has two 500 ms frames that differ only in the state tile and attention indicator, and the attention total stays steady

### Requirement: Evidence-specific uncertainty presentation

The renderer SHALL apply the owner-approved [issue #102](https://github.com/jimmie-potts/divoom-app-upgrade/issues/102#acceptance-criteria) policy to `UNSURE` and identifier dimming in both project and non-project layouts. Non-current source connection, uncertain freshness, unknown activity, unknown parent and unknown turn SHALL warn. Unavailable activity, attention, turn or parent evidence SHALL warn for every supported reason. Unavailable ordering or read evidence with ambiguous or lost reason SHALL warn. Unknown ordering alone, unknown optional read evidence, and unavailable ordering or read evidence with missing, unsupported or inaccessible reason SHALL NOT warn solely for those limits. Shared snapshots, ordering and the complete unavailable list SHALL remain unchanged; ignored presentation evidence SHALL remain available outside the pixels.

#### Scenario: Routine missing ordering or optional read evidence
- **WHEN** a current, active, known-turn, evidenced top-level session has unknown ordering and missing ordering evidence, or optional read evidence is unknown or missing, unsupported or inaccessible
- **THEN** those limits alone produce neither `UNSURE` nor identifier dimming, and the full evidence remains available

#### Scenario: Conflict, loss and uncertain session state
- **WHEN** a session has ambiguous or lost ordering/read evidence, any unavailable activity/attention/turn/parent evidence, unknown turn without an unavailable entry, uncertain freshness, unknown activity/parent or a non-current connection
- **THEN** `UNSURE` and identifier dimming remain visible in either layout, without changing attention priority, pulse, child counts or notices
