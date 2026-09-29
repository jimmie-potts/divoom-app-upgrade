## ADDED Requirements

### Requirement: Disposable paired feed pause

An explicitly launched `hub-paired` verification process SHALL honor a private versioned pause request for its run and nonce. It SHALL stop admitting Hub feed requests and forwarded Hub commands, drain requests already in flight, then atomically acknowledge the matching run and nonce with its own process identity. While paused, local pages, health and controller reads SHALL remain responsive, retained feed state SHALL preserve truthful freshness, and no rejected command SHALL be queued for replay. Invalid, linked, oversized, nonprivate or wrong-run controls SHALL block admission without a successful acknowledgment. Ordinary launches SHALL NOT enable this mechanism through inherited environment alone.

#### Scenario: A request already in flight
- **WHEN** a pause arrives while a Hub response is unfinished
- **THEN** no acknowledgment appears until that request drains, then a matching process acknowledgment appears and subsequent timer and read activity makes no new Hub request

#### Scenario: Responsive paused preview
- **WHEN** an owner reads pages or controller state and attempts a Hub command after pause acknowledgment
- **THEN** local reads answer, the feed does not claim fresh observation without evidence, the Hub command is refused and never replayed, and no new Hub request starts

#### Scenario: Resume a live consumer
- **WHEN** the pause request is removed without reseeding
- **THEN** the still-running consumer resumes normal polling without replaying a refused command

#### Scenario: Invalid controls or ordinary startup
- **WHEN** a control file is malformed, linked, nonprivate or for another run, or pause settings are inherited by an ordinary launch
- **THEN** the paired process does not acknowledge unsafe controls, and ordinary startup retains its existing behavior without enabling the pause mechanism

### Requirement: Authorized paired reseed release

A seed encountering a pause SHALL refuse to proceed unless it is `hub-paired` and has a matching one-shot release authorization. It SHALL preserve the pause on failed or unrelated seeding. A successful authorized seed SHALL consume the same pause and release only after the old process has stopped and fresh state has been written, before launching the new process. Reseeding SHALL preserve pairing token files, recorded ports and frozen proof. The new process SHALL accept the reseeded owner's current feed without retaining the prior owner's higher revision.

#### Scenario: Owner resets before consumer
- **WHEN** the coordinator authorizes the paused consumer's reseed after resetting the Hub owner
- **THEN** the old consumer stops, fresh paired state is seeded, the matching controls are consumed, and the new consumer reaches current-feed readiness at the owner's new revision on its recorded ports

#### Scenario: Missing, stale or failed release
- **WHEN** a seed lacks matching release authorization, targets another scenario, sees a newer pause request, or fails before completion
- **THEN** it does not resume the paused feed, retains the outstanding controls and remains stoppable without changing frozen proof

## MODIFIED Requirements

### Requirement: Readiness and boundary checks
A run SHALL be ready only after its simulator ready line on `127.0.0.1` and a health read reporting simulator mode without connectivity. Start checks SHALL confirm simulator mode through health and device settings, and a guard record for the serving port with no transport attempt. A connection to another port SHALL pass only when it went to `127.0.0.1` and the connecting process's own launch declared it paired. The serving process SHALL be paired with exactly the `hub-feed` port in `hub-paired` and with no port otherwise. The `hub-feed` check SHALL pass in `hub-paired` when Pixoo's feed is current, from `verify-owner`, at the Hub's revision. While the launch has had no current feed, it SHALL be skipped only when the Hub refuses the feed token or cannot be reached, and only within a grace period after the launch. It SHALL otherwise fail, naming what the Hub answered or served. It SHALL fail when a current feed turns stale or the revisions do not settle, and SHALL be skipped in other scenarios. A failed start SHALL be named by a fixed cause line for known server and guard failures, without copying server output.


While a valid verification feed pause is active, the paired-feed diagnostic SHALL report `skipped` with a pause reason without probing the Hub. Invalid pause control state SHALL report `failed` without probing the Hub. A paused diagnostic SHALL NOT establish composition readiness; the ordinary current-feed check SHALL pass after authorized reseed release.

#### Scenario: Occupied recorded port
- **WHEN** a relaunch after reseeding finds its recorded port occupied
- **THEN** the server exits and the failure is named `pixoo-start-failed: port in use`

#### Scenario: Unknown server output
- **WHEN** the server's error output matches no known failure, even if it contains a token or path
- **THEN** no cause line is reported

#### Scenario: Pairing that does not match the scenario
- **WHEN** the serving process is paired with a port while the run is standalone, or with another port or none while the run is `hub-paired`
- **THEN** the no-physical-transport check fails and names both port lists

#### Scenario: Lost Hub feed
- **WHEN** the Hub becomes unreachable after the feed was current, and then returns
- **THEN** the `hub-feed` check fails with the stale revision and the connection cause, then passes again without a restart

#### Scenario: Hub feed that Pixoo refuses
- **WHEN** the Hub accepts the feed token but serves another owner, a feed Pixoo refuses or an error status before Pixoo's feed was ever current
- **THEN** the `hub-feed` check fails naming that owner, the refused revision or the status, never the token

#### Scenario: Pairing that never completes
- **WHEN** the Hub still refuses the feed token or cannot be reached after the grace period
- **THEN** the `hub-feed` check fails naming the refusal or the connection cause

#### Scenario: Hub reseeded after pairing
- **WHEN** the Hub's revisions restart below the revision Pixoo applied
- **THEN** the `hub-feed` check fails naming both revisions and the reseed of Pixoo `hub-paired` that recovers it

#### Scenario: Diagnostic during a feed pause
- **WHEN** a paired-feed diagnostic runs while valid or invalid pause control state is present
- **THEN** it reports skipped or failed respectively without making a Hub request and does not claim readiness

