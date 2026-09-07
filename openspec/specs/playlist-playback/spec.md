# Playlist playback specification

## Purpose

Provide deterministic playlist orchestration and paused recovery for [issue #7](https://github.com/jimmie-potts/divoom-app-upgrade/issues/7), criteria 1-7, preserving handoff section 6 and separating estimated software timing from physical evidence.

## Requirements

### Requirement: Immutable session and independent intent
Playback SHALL expose idle, loading, playing, paused, reconnecting and error states. Active, paused or stopped user intent SHALL remain independent from device availability. Each session SHALL retain its immutable playlist revision, unique item identities, policies and rendition references. Saved edits SHALL affect a new session only; restart-with-changes SHALL explicitly capture the current playlist revision.

#### Scenario: Edit an active playlist
- **WHEN** the saved playlist changes during playback
- **THEN** current playback keeps its captured items and policies until an explicit new session starts

### Requirement: Estimated dwell after loading
Playback SHALL use an injectable monotonic clock. Dwell SHALL begin only after successful complete upload and the adapter's estimated ready delay. Duration policies MAY interrupt animations. Plays policies SHALL multiply the requested total executions by the sum of effective uploaded frame delays and ignore embedded GIF repeat metadata. Software timestamps SHALL be labeled estimated and SHALL NOT establish physical playback events. Late callbacks SHALL advance at most one item, without replaying missed intervals.

#### Scenario: Variable-delay animation plays three times
- **WHEN** effective frame delays total 700 ms and the policy is three total plays
- **THEN** loading and estimated start delay are excluded from the 2100 ms dwell

### Requirement: Cancelling controls
Pause SHALL stop automatic advancement while acknowledging that uploaded device animation may continue. Resume SHALL reupload the current item and restart its full policy. Stop SHALL cancel pending transitions and leave displayed content. Next and previous SHALL invalidate old timers and pending work before changing context. Display off SHALL pause orchestration and cancel transitions; screen on SHALL NOT resume paused playback.

#### Scenario: Stop or skip during upload
- **WHEN** stop or navigation supersedes an incomplete upload
- **THEN** its later completion cannot change current state, start dwell or advance another item, even if some device effects already occurred

#### Scenario: Pause and resume
- **WHEN** a playing item is paused and later resumed
- **THEN** no advancement occurs while paused and resume uploads the item again with its full original dwell policy

### Requirement: Deterministic traversal
Repeat-off SHALL finish idle after the final dwell and leave content. Shuffle SHALL visit each item once per forward cycle and avoid adjacent cross-cycle repeats when more than one item exists. Previous SHALL follow recorded playback traversal, including shuffled order, rather than guessing an index. Navigation while paused SHALL change context without uploading. Traversal history SHALL retain up to the most recent 10000 visits.

#### Scenario: Cross-cycle shuffle and previous
- **WHEN** shuffled playback crosses a cycle boundary and previous is requested
- **THEN** the new cycle avoids an immediate repeated item and previous selects the actual preceding history entry

### Requirement: Durable paused recovery
The checkpoint SHALL retain the session snapshot, forward order/cursor, bounded history, intent/state context and last error. Checkpoints SHALL NOT contain process-monotonic deadlines for reuse. Reopening SHALL restore available context paused without device writes. Checkpoint rendition references SHALL survive playlist edits/deletion and SHALL remain protected until context is explicitly replaced or cleared. Snapshot replacement and retention updates SHALL commit atomically.

#### Scenario: Restart while playing
- **WHEN** a process exits during playback and a new player opens its persisted context
- **THEN** it restores the same item and snapshot paused, and explicit resume starts the full policy using new monotonic time

### Requirement: Bounded failure recovery
Connectivity loss SHALL suspend advancement and retain the intended item. Recovery from failures with no prior effects SHALL use bounded exponential probe retries and restart that item only while intent remains active. In device mode, a failure with possible prior effects SHALL take precedence over automatic recovery or skipping, pause advancement, retire pending work and preserve the current context plus error code and uncertainty marker. It SHALL require explicit fresh user intent before further playback writes. Results from retired generations SHALL NOT overwrite newer user intent. Invalid media and rejected uploads SHALL produce a visible typed item error and may skip the failed item. Failure of every item SHALL terminate in error instead of looping. A takeover notification SHALL pause ownership; no background process SHALL fight to reclaim a display controlled by the official app. Simulator recovery SHALL retain its existing behavior. Trace: issue #42 criteria 3-4 in addition to issue #7 recovery requirements.

#### Scenario: Stop during reconnect
- **WHEN** connectivity returns after the user has stopped
- **THEN** stale probes and retries do not upload, restart or advance playback

#### Scenario: All items fail
- **WHEN** every item fails before any successful playback
- **THEN** automatic attempts end in error after a bounded traversal

#### Scenario: Uncertain upload or display control
- **WHEN** a current device-mode upload, brightness or screen operation fails with possible prior effects
- **THEN** the player pauses, retains current context and reports the uncertainty
- **AND** later connectivity recovery sends no automatic replay or next-item upload
- **AND** explicit resume starts the current item again under a fresh generation

#### Scenario: Restart with uncertain context
- **WHEN** a process restarts after an uncertain failure
- **THEN** its persisted error and immutable context restore paused without device requests

#### Scenario: Superseded failure
- **WHEN** a retired operation reports possible effects after a newer user command
- **THEN** its completion cannot overwrite current intent or restart obsolete work

### Requirement: One serialized writer
A player SHALL own one adapter writer and serialize all uploads, probes, brightness and screen operations through it. Brightness SHALL NOT split an upload transaction. Generation cancellation SHALL retire stale work while acknowledging possible prior effects. Preparation of a next rendition SHALL happen only in backend memory/storage and SHALL NOT preload content on the device.

#### Scenario: Brightness during loading
- **WHEN** brightness is requested while a multi-frame upload is active
- **THEN** the control waits for the upload transaction and cannot interleave its frames

### Requirement: Dated display evidence
The player SHALL maintain read-only evidence that distinguishes requested screen/brightness values, acknowledged display writes, probe-observed values and transport availability. Unknown or unsupported observations SHALL remain explicit. Evidence SHALL identify its source and monotonic time without implying visual confirmation. Successful background uploads and reconnect probes SHALL contribute applicable transport evidence. Results from retired generations SHALL NOT overwrite newer evidence or intent. Trace: [issue #24](https://github.com/jimmie-potts/divoom-app-upgrade/issues/24), status-evidence and generation criteria.

#### Scenario: Requested value differs from observation
- **WHEN** a display setting is requested and its write is acknowledged without a probe value
- **THEN** requested and acknowledged values are available separately while the missing observed value remains unavailable

#### Scenario: Observation age and restart
- **WHEN** status is read repeatedly or a player restarts
- **THEN** reads do not refresh evidence timestamps or cause device operations
- **AND** a restarted player reports no carried-over process-monotonic observation or acknowledgment as current evidence

#### Scenario: Background and superseded results
- **WHEN** a current background upload or reconnect probe completes, followed by a result from a retired generation
- **THEN** the current result contributes only the evidence it establishes
- **AND** the retired result cannot replace that evidence or newer user intent

#### Scenario: Possible effects without acknowledgment
- **WHEN** a display command fails with possible prior effects
- **THEN** evidence retains that uncertainty without claiming the requested setting was acknowledged or observed
