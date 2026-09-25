# Agent monitor controls

## Purpose

Provide explicit user-controlled Pixoo monitoring and media ownership while preserving shared session authority, exact previews and one serialized device writer. Scope is [issue #33](https://github.com/jimmie-potts/divoom-app-upgrade/issues/33).

## Requirements

### Requirement: Shared selected monitor view
The application SHALL expose full labels, identities, provider/activity/attention, observation timestamps and age, freshness independently of collector health, and exact 64×64 RGB preview. One persisted bounded provider/project/session/query filter SHALL select both preview and display while retaining complete source state for child attribution. Labels SHALL change only through explicit user input to the selected shared owner; notice dismissal SHALL acknowledge only the Pixoo consumer.

#### Scenario: Filter and edit explicit labels
- **WHEN** a user filters by an existing neutral project or session identity and submits a chosen label
- **THEN** the preview and display use the same matching view, full labels remain available, empty results are explicit, and no private path, prompt or title is inferred

#### Scenario: Dismiss a retained notice through remote ownership
- **WHEN** the selected source is remote and the user dismisses a turn-ended notice
- **THEN** the command retains that owner's request identity and changes only its consumer acknowledgment without marking chat read, approving work or modifying trackers

### Requirement: Explicit display participation
Monitor and Media SHALL be explicit modes. Entering Monitor SHALL pause playlist advancement. Explicit start, show-media, restart or resume SHALL select Media. Leaving Monitor SHALL preserve paused playback until explicit media intent. Collection SHALL continue in either mode and unsolicited agent events SHALL NOT take over Media. The only automatic Media change SHALL be the owner's explicit now-playing Media setting, which resumes only playback it paused itself.

#### Scenario: Attention while Media owns the display
- **WHEN** questions, approvals, errors or turn ends arrive during Media
- **THEN** monitor state and preview update without a monitor picture or ownership change

#### Scenario: Return to paused media
- **WHEN** the user enters Monitor during playback and then selects Media
- **THEN** the captured playlist remains paused until explicit resume or start

#### Scenario: Now-playing setting off
- **WHEN** the now-playing Media setting is Off and a new track starts during Media
- **THEN** no picture or ownership change occurs

### Requirement: One generation-guarded display writer
All media, monitor and display controls SHALL use the existing backend adapter and serialized queue. Mode changes, screen-off and shutdown SHALL retire obsolete callbacks and pending pictures. At most one monitor upload and one latest desired rendition SHALL be retained; no old completion SHALL restore ownership. Complete RGB frames SHALL use a configurable minimum submission interval of 1000 ms by default, no faster than 1000 ms.

#### Scenario: Switch modes during upload
- **WHEN** a Monitor upload is in flight and explicit media intent supersedes it
- **THEN** no subsequent picture from the old mode is submitted and its completion cannot replace current intent; possible already-applied effects remain identified

#### Scenario: Coalesced burst
- **WHEN** several snapshots arrive within the cadence or while an upload is active
- **THEN** only the newest current rendition remains eligible after the minimum interval, without replaying missed pictures

### Requirement: Finite protected integration commands
A versioned Pixoo integration extension SHALL expose supported operations, selected/pending mode, effective participation, selected filters, cadence and generation/configuration guards without changing released controller API 1.0. Browser and native integration operations SHALL share the backend command ledger with playback/MCP, reject unknown fields, stale revisions/generations, conflicting duplicates and old epochs, and preserve existing Host/Origin/authentication boundaries. Source label/acknowledgment commands SHALL preserve the selected owner's separate identity.

#### Scenario: Multiple clients and replay
- **WHEN** two clients submit different integration commands with one request identity, or a client submits stale configuration/generation
- **THEN** one intent can execute, conflicts are retained/rejected, and replay of the exact original request never repeats a display operation

#### Scenario: Revoked native client
- **WHEN** a native client lacks scope or its credential is revoked
- **THEN** reads, commands and subsequent stream delivery are denied without widening browser access or exposing raw device operations

### Requirement: Authoritative reconnect and source-only delivery
The browser SHALL reconcile from current snapshots after sequence-aware SSE reconnect and ignore stale events/responses. Reconnect SHALL NOT replay mode transitions or missed pictures. Normal startup SHALL remain simulator-only; this capability SHALL NOT install hooks, discover hardware or expand MCP tools.

#### Scenario: Reconnect or owner cutover
- **WHEN** a client reconnects, the backend restarts, or the selected session owner is explicitly switched and rolled back
- **THEN** the browser resyncs current mode/view and shared state without creating local agent-state authority, and the reconnect itself does not activate the display

### Requirement: Startup recovery and bounded failure
Restart SHALL retain mode, filters and paused media context and restore active sessions uncertain through the state owner. In device mode, startup with a saved Monitor selection and a requested screen-on state SHALL restore Monitor presentation through the existing player generation and serialized adapter, without a client command or new request identity ([issue #77](https://github.com/jimmie-potts/divoom-app-upgrade/issues/77) owner decision). Simulator startup, a saved Media selection and a retained screen-off request SHALL remain passive until explicit activation. Screen-off SHALL stop monitoring work; screen-on SHALL NOT resume playback or monitoring. Failed monitor transmission, including the first after startup, SHALL suspend monitoring until explicit activation, with no automatic retries after uncertain effects.

#### Scenario: Device startup restores Monitor
- **WHEN** a device-mode backend starts with saved Monitor mode and the screen requested on
- **THEN** playback context stays paused, participation becomes active and the newest complete picture is submitted through the serialized adapter without a client command

#### Scenario: Simulator, Media, screen-off and screen-on stay passive
- **WHEN** a backend starts in simulator mode, starts with saved Media mode, restarts with a retained screen-off request, or the user turns a stopped screen on
- **THEN** snapshots and previews remain available but no monitor upload occurs before explicit activation

#### Scenario: Uncertain transmission
- **WHEN** a monitor write fails with possible prior effects, including the first write after startup
- **THEN** the current view remains selected but participation is inactive, uncertainty is reported, and no automatic probe or retry occurs
