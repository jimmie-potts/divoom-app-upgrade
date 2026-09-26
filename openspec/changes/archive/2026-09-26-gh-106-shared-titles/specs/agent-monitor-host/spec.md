## ADDED Requirements

### Requirement: Shared metadata snapshot negotiation
The selected source SHALL request snapshot 1.2 to retain shared title, project and label provenance. Authenticated session reads SHALL keep snapshot 1.0 by default and allow explicit 1.1 or 1.2 selection. Legacy projections SHALL exclude title/project/label provenance and agent-origin labels. Unsupported versions SHALL reject without starting another owner or silently declaring healthy empty state.

#### Scenario: Embedded and remote metadata
- **WHEN** the selected owner supplies valid shared title and project metadata
- **THEN** the local Monitor view retains it through snapshot 1.2 with the same session selector and freshness

#### Scenario: Legacy reader
- **WHEN** a reader omits snapshotVersion or requests snapshot 1.1
- **THEN** its versioned snapshot omits new metadata and preserves supported explicit user labels
