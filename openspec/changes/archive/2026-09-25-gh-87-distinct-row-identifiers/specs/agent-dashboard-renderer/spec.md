## ADDED Requirements

### Requirement: Distinct row identifiers

The truncation marker SHALL be a glyph that no label or session ID character can produce. Identifiers that fit the row SHALL be shown whole. A longer user label SHALL keep its first and last characters around the marker. A row without a user label SHALL show its session ID, shortened to the marker and the ID's end, never its start, and SHALL NOT derive a label from titles, prompts or paths.

#### Scenario: Unlabeled sessions with a shared ID prefix
- **WHEN** four unlabeled sessions whose time-ordered IDs share a long prefix appear on one page
- **THEN** each row shows the final characters of its own ID after the marker, the four identifiers differ, and the full IDs remain available outside the pixels

#### Scenario: Labels that differ only at the end
- **WHEN** two long user labels share their opening characters and differ in their final characters
- **THEN** the rows keep the opening and final characters around a middle marker and show different identifiers
