## MODIFIED Requirements

### Requirement: Stable compact session projection

The dashboard SHALL show a summary strip and one top-level session per page. The session SHALL show its provider, activity, attention, retained notice, attributable active-child count, uncertainty and a short user label in up to two lines. Activity, provider, attention and health SHALL each be distinguished by shape or words as well as colour. Uncertain evidence SHALL be shown in words, not only as a symbol. Blocking approval/input SHALL precede continuing questions, then retained notices, then other sessions, with deterministic identity ordering within each group. The summary SHALL show the matching session count, the attention total across all pages, the page position and source and collector health on every page, including an empty one.

#### Scenario: Mixed priorities and child evidence
- **WHEN** a snapshot includes blocked input, a continuing question, attributable children and unknown evidence
- **THEN** priority and identity determine page order, known children are not duplicate top-level sessions, activity remains separate from question/blocking attention, and missing child evidence is visibly unknown

#### Scenario: Every legend state is distinguishable without colour
- **WHEN** sessions in each activity, attention, notice and uncertainty state and each source and collector health state are rendered
- **THEN** each state differs from the others in its lit pixel shape or words, not only in colour

### Requirement: Exact portable rendition

The renderer SHALL produce deterministic complete 64×64 RGB888 frames, each of 12288 bytes, and a browser preview of those same frames. A rendition SHALL carry every frame in order with their uniform delay, and its single-picture field SHALL equal the first frame. It SHALL publish layout data, full labels and precise evidence timestamps outside the constrained picture. Short labels SHALL use an explicit bounded bitmap alphabet, truncation marker and unsupported-character fallback.

#### Scenario: Unsupported and long labels
- **WHEN** a user label contains unsupported characters or exceeds the identifier width
- **THEN** fallback and truncation are deterministic, the full label remains available outside the pixels, and browser pixels equal every RGB frame of the rendition

### Requirement: Distinct row identifiers

The truncation marker SHALL be a glyph that no label or session ID character can produce. Identifiers that fit the 20-character identifier width SHALL be shown whole. A longer user label SHALL keep its first and last characters around the marker. A session without a user label SHALL show its session ID, shortened to the marker and the ID's end, never its start, and SHALL NOT derive a label from titles, prompts or paths.

#### Scenario: Unlabeled sessions with a shared ID prefix
- **WHEN** four unlabeled sessions whose time-ordered IDs share a long prefix are shown on successive pages
- **THEN** each page shows the final characters of its own ID after the marker, the four identifiers differ, and the full IDs remain available outside the pixels

#### Scenario: Labels that differ only at the end
- **WHEN** two long user labels share their opening characters and differ in their final characters
- **THEN** the identifiers keep the opening and final characters around a middle marker and differ

## ADDED Requirements

### Requirement: Attention-only pulse

A page whose session holds approval, input or question attention SHALL have exactly two frames at a uniform 500 ms delay. The frames SHALL differ only in the state tile and attention indicator. Every other page, including an active session without attention, an empty page and a page whose only attention is elsewhere, SHALL have exactly one frame.

#### Scenario: Working session without attention
- **WHEN** the shown session is active and holds no attention
- **THEN** the rendition has one frame and nothing on the device pulses

#### Scenario: Session waiting for approval
- **WHEN** the shown session holds approval attention
- **THEN** the rendition has two 500 ms frames that differ only in the state tile and attention indicator, and the attention total stays steady
