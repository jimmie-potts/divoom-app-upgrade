## ADDED Requirements

### Requirement: Evidence-specific uncertainty presentation

The renderer SHALL apply the owner-approved [issue #102](https://github.com/jimmie-potts/divoom-app-upgrade/issues/102#acceptance-criteria) policy to `UNSURE` and identifier dimming in both project and non-project layouts. Non-current source connection, uncertain freshness, unknown activity, unknown parent and unknown turn SHALL warn. Unavailable activity, attention, turn or parent evidence SHALL warn for every supported reason. Unavailable ordering or read evidence with ambiguous or lost reason SHALL warn. Unknown ordering alone, unknown optional read evidence, and unavailable ordering or read evidence with missing, unsupported or inaccessible reason SHALL NOT warn solely for those limits. Shared snapshots, ordering and the complete unavailable list SHALL remain unchanged; ignored presentation evidence SHALL remain available outside the pixels.

#### Scenario: Routine missing ordering or optional read evidence
- **WHEN** a current, active, known-turn, evidenced top-level session has unknown ordering and missing ordering evidence, or optional read evidence is unknown or missing, unsupported or inaccessible
- **THEN** those limits alone produce neither `UNSURE` nor identifier dimming, and the full evidence remains available

#### Scenario: Conflict, loss and uncertain session state
- **WHEN** a session has ambiguous or lost ordering/read evidence, any unavailable activity/attention/turn/parent evidence, unknown turn without an unavailable entry, uncertain freshness, unknown activity/parent or a non-current connection
- **THEN** `UNSURE` and identifier dimming remain visible in either layout, without changing attention priority, pulse, child counts or notices
