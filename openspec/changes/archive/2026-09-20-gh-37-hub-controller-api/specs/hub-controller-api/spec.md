## Purpose

Expose the existing Pixoo controller to authenticated shared hub clients while preserving one device writer, bounded replay and explicit uncertainty.

## ADDED Requirements

### Requirement: Protected configured identity
The controller SHALL offer an opt-in loopback machine API using the released controller contract 1.0. It SHALL publish configured neutral identity and explicit supported capabilities without private addresses, paths or catalog names. Credentials SHALL authorize read/control access only to this configured backend. Browser Host, Origin and fetch-metadata protections SHALL remain enforced.

#### Scenario: Native access and browser protection
- **WHEN** a machine client authenticates with an enabled scoped credential
- **THEN** it can read snapshots and submit only permitted operations, while absent/revoked credentials and foreign origins are rejected before replay or effects

#### Scenario: Defaults and unsupported extensions
- **WHEN** ordinary startup or capability discovery occurs
- **THEN** startup remains simulator by default, physical observations are unknown in simulator mode, and zones, scenes, previews and modes remain explicitly unsupported until implemented

### Requirement: One guarded command owner
All native commands SHALL use the same request sequence, player and serialized adapter as browser and MCP clients. Strict validation SHALL reject arbitrary destinations, paths and raw commands. Admitted commands SHALL preserve revision/generation checks, retained failures, cancellations and possible prior effects. Screen-on SHALL NOT resume playback.

#### Scenario: Duplicate and competing clients
- **WHEN** clients repeat an identical native request or race different requests at one identity
- **THEN** a matching request joins or replays its retained outcome, and a conflicting request cannot execute another write

#### Scenario: Obsolete intent
- **WHEN** a new command has an obsolete configuration revision or generation, or an expired request epoch
- **THEN** it cannot produce effects; semantic failures after reservation remain replayable, and expired identities cannot reserve new work

#### Scenario: Media revision and cancellation
- **WHEN** a discovered playlist changes before native selection, or another client supersedes queued output
- **THEN** the stale selection is rejected or the existing generation rules cancel obsolete work without losing possible prior effects

### Requirement: Honest bounded snapshots and feeds
Snapshots SHALL separate desired, pending, last successful transmission, last outcome, external ownership and physical observations. Native feeds SHALL use a separate cursor namespace with 32 retained snapshots, at most 16 streams and bounded backpressure. Unknown, future or expired cursors SHALL produce full resync without commands. Streams SHALL reauthorize and terminate after revocation.

#### Scenario: Uncertain send and fresh health
- **WHEN** a transport fails with possible effects and a subsequent read reports a healthy service
- **THEN** the retained outcome still records uncertainty and the service does not invent physical confirmation or refresh observation evidence time

#### Scenario: Feed recovery and revocation
- **WHEN** a client reconnects with a retained cursor or loses its credential
- **THEN** the server replays only later events or sends a full resync, and denies revoked access including retained data

### Requirement: Consumer compatibility evidence
The repository SHALL provide a fake-backed compatibility command for hub CI and verify its immutable contract artifact. Tests SHALL exercise owning HTTP authorization, replay, concurrency, generation, uncertainty and browser regression behavior without hardware or credentials from a live installation.

#### Scenario: Reproducible source checks
- **WHEN** CI runs the compatibility suite from a fresh Node 24 install
- **THEN** shared schema/semantic fixtures and owning controller tests execute using isolated runtime data and synthetic credentials
