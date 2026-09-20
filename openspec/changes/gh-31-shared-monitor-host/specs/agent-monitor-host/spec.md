## Purpose

Host shared monitoring inside the existing backend while keeping one durable owner and a consistent interface for local and remote consumers.

## ADDED Requirements

### Requirement: Durable shared ownership
The host SHALL consume a pinned verified shared engine, preserve its lifecycle semantics and store agent state privately under one exclusive owner independently of controller storage.

#### Scenario: Restart and competing owner
- **WHEN** an owner restarts or a second process attempts to acquire its store
- **THEN** committed identities, revisions, labels and notices survive, restarted evidence is uncertain, and concurrent ownership is refused

#### Scenario: Failed commit
- **WHEN** a write is interrupted or fails
- **THEN** recovery observes an atomic preceding or completed revision and no partial success receipt

### Requirement: Protected bounded monitoring
The host SHALL authenticate ingestion, snapshots, feeds, labels, filters and acknowledgment while preserving existing Host, Origin, native-client, payload, time, queue and replay protections. It SHALL apply the shared privacy allowlist before persistence and delegate reduction, deduplication, child rollup, freshness and retention to the shared engine.

#### Scenario: Privacy and prior-turn replay
- **WHEN** forbidden content, duplicate observations or prior-turn events arrive
- **THEN** excluded content never enters state, transport diagnostics or errors, and prior-turn events cannot restore cleared notices

#### Scenario: Retention and uncertainty
- **WHEN** five minutes pass without session evidence or journal bounds are reached
- **THEN** evidence becomes uncertain independently of collector health and the diagnostic journal retains at most 24 hours and 10000 events without removing current labels or notices

#### Scenario: Explicit monitor acknowledgment
- **WHEN** an authorized client acknowledges a notice or changes a user label
- **THEN** only the intended monitor operation occurs with bounded replay and no inference of chat readership, approval or successful completion

### Requirement: Independent consumers
Collection and versioned feeds SHALL operate with no browser and in either display mode without device writes. Consumer stalls SHALL NOT delay other consumers or producer admission. Producer failures SHALL remain bounded and fail-open.

#### Scenario: Stalled consumer and reconnect
- **WHEN** one consumer stalls or reconnects beyond retained history
- **THEN** delivery remains bounded, healthy consumers continue, and the reconnecting consumer receives a current resync rather than old effects

### Requirement: Selected session source and migration
Every downstream snapshot, change, filter, label and acknowledgment operation SHALL use one selected embedded or remote source. Remote mode SHALL NOT open local shared storage or start a reducer. Quiesce/export/import SHALL use versioned validation and preserve owner/session identities, revisions and notices with explicit exclusive handoff.

#### Scenario: Remote host loss
- **WHEN** a selected remote owner becomes unavailable or returns invalid state
- **THEN** consumers see stale or unavailable feed status, writes fail without automatic replay, and no local owner starts

#### Scenario: Cutover and rollback
- **WHEN** an operator quiesces and stops an owner, imports into an empty destination and switches the source
- **THEN** identities, labels, revisions and notices remain intact, occupied destinations reject import, and rollback requires releasing the replacement owner first

### Requirement: Source-only activation and evidence
Startup SHALL retain its simulator default and existing explicit device activation. Monitoring SHALL NOT activate device control or install hooks. Source examples and isolated fake-clock, privacy, migration, retention and Linux budget checks SHALL document their evidence limits.

#### Scenario: Monitoring activation
- **WHEN** monitoring is explicitly enabled with valid private configuration
- **THEN** the existing backend hosts it without another server, player or writer and no physical effect follows from an agent event
