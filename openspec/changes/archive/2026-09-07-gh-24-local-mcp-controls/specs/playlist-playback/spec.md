## ADDED Requirements

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
