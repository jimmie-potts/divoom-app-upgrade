## ADDED Requirements

### Requirement: Diagnostic build identity
Diagnostics SHALL return the same process-owned `build: {sourceRevision, version}`
as health. A package version alone SHALL NOT establish source provenance, and
build identity SHALL remain distinct from shared-state revisions. Reading it
SHALL NOT probe or operate a device. Trace: issue #114 diagnostic criteria.

#### Scenario: Compare health and diagnostics
- **WHEN** a client reads both endpoints from one running backend
- **THEN** both report the same build identity, including explicit unknown provenance
