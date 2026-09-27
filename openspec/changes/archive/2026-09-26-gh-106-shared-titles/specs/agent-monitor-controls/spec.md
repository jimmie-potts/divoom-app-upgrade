## MODIFIED Requirements

### Requirement: Shared selected monitor view
The application SHALL expose full labels, shared titles and projects, identities, provider/activity/attention, observation timestamps and age, freshness independently of collector health, and exact 64×64 RGB preview. One persisted bounded provider/project/session/query filter SHALL select both preview and display while retaining complete source state for child attribution. Monitor label-edit controls SHALL change labels only through explicit user input to the selected shared owner; notice dismissal SHALL acknowledge only the Pixoo consumer.

#### Scenario: Filter and edit explicit labels
- **WHEN** a user filters by an existing neutral project or session identity and submits a chosen label
- **THEN** the preview and display use the same matching view, full labels remain available, empty results are explicit, and no private path or prompt is inferred

#### Scenario: Dismiss a retained notice through remote ownership
- **WHEN** the selected source is remote and the user dismisses a turn-ended notice
- **THEN** the command retains that owner's request identity and changes only its consumer acknowledgment without marking chat read, approving work or modifying trackers

#### Scenario: Full shared metadata with an owner label
- **WHEN** a session has a user label, a shared title and a project
- **THEN** the user label heads its card, the full title and project remain visible, and title/project text can match the shared query filter without merging sessions
