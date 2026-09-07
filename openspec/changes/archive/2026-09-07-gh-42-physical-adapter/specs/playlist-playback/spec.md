## MODIFIED Requirements

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
