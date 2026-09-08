## Purpose

Define Pixoo's adoption of the released shared lifecycle contract and the consumer semantics required by later monitoring composition and rendering.

## ADDED Requirements

### Requirement: Reproducible shared contract consumption
Pixoo source SHALL pin a released shared lifecycle contract with artifact version, API version, source revision and archive checksum. Its conformance checks SHALL consume the upstream cases without a separate provider adapter or validator.

#### Scenario: Accepted release installation
- **WHEN** a clean source checkout installs its pinned dependencies
- **THEN** the installed lifecycle package and shared cases match the recorded archive and manifest hashes
- **AND** its validator agrees with the upstream acceptance and deterministic deduplication expectations

#### Scenario: Unrecognized or altered input
- **WHEN** the shared validator receives an unsupported API version or non-allowlisted metadata
- **THEN** it rejects the input using fixed content-free errors rather than copying rejected payloads

### Requirement: Distinct monitoring semantics
The Pixoo consumer contract SHALL distinguish activity, continuing questions, blocked attention, turn-ended notices, interruption, acknowledgment and observation freshness. A turn end SHALL imply neither success nor readership. These source requirements SHALL NOT be presented as an implemented dashboard or state engine.

#### Scenario: Turn end alongside attention
- **WHEN** a valid turn-end observation exists alongside unresolved question or blocked evidence
- **THEN** the documented consumer mapping preserves each fact separately and does not infer completion or resolved attention

#### Scenario: Missing observations
- **WHEN** evidence becomes stale or required signals are unsupported
- **THEN** the mapping represents uncertainty and unavailable counts explicitly, without treating silence as completion, connectivity or permission

### Requirement: Session attribution and private metadata boundaries
The consumer contract SHALL preserve separate sessions in one project and aggregate only attributable children. It SHALL allow neutral identifiers and explicit user-chosen labels while excluding prompt/tool/transcript content, copied titles, credentials and private paths from monitoring payloads, persistence, diagnostics and errors.

#### Scenario: Concurrent sessions with unknown children
- **WHEN** two sessions share a project label but parent evidence is unknown
- **THEN** the mapping keeps distinct session identities and does not invent an aggregate relationship or child count

#### Scenario: User-chosen label
- **WHEN** a user supplies a supported explicit label
- **THEN** it remains presentation metadata and does not merge sessions or authorize copying agent-generated titles

### Requirement: Consumer-only notice acknowledgment
The Pixoo contract SHALL define monitor acknowledgment separately from agent read state and from other consumers' notice policies.

#### Scenario: Pixoo dismissal
- **WHEN** a user dismisses a Pixoo monitor notice
- **THEN** the defined policy acknowledges that notice for the Pixoo consumer only and does not edit Codex read state, clear another consumer's notice or resolve a blocked action

### Requirement: Version and provider evidence qualification
The compatibility document SHALL identify supported contract versions and required Codex Desktop/CLI and Claude Code paths. It SHALL distinguish documented, artifact-observed, unsupported and inaccessible signals, with live acceptance assigned to its separate owner.

#### Scenario: Inaccessible installed provider
- **WHEN** a required installed version or lifecycle signal cannot be verified
- **THEN** the source matrix records the gap and stop condition without claiming installed-client compatibility from fixtures

### Requirement: Shared source and one state owner
The documented architecture SHALL keep shared event/state code in Hub released packages and Pixoo composition, rendering, monitor policy and its device writer in Pixoo. It SHALL specify initial embedded hosting and a later explicit state-owner handoff without concurrent database access or implicit fallback ownership.

#### Scenario: Future remote owner selection
- **WHEN** a later authorized delivery selects a remote state owner
- **THEN** its contract requires explicit quiesce/export/import and rollback, preserves identity, and prohibits a fallback local reducer or a second writer

#### Scenario: Media or device unavailable
- **WHEN** later monitoring consumers operate while Media mode is selected or the device is unavailable
- **THEN** the contract keeps collection independent, preserves the media owner and uses the existing serialized device writer
- **AND** legacy Nanoleaf behavior remains unchanged until an explicitly verified shared-input cutover
