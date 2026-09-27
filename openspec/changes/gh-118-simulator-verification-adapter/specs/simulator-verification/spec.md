## ADDED Requirements

### Requirement: Adapter command
`npm run verify -- <operation>` SHALL pass the Pixoo plug-in to the vendored shared verification core, which owns the run lifecycle, receipt and proof. The wrapper SHALL refuse a Node version outside 24.5 through 24.x before loading the plug-in. `start` and `restart` SHALL build the checkout before seeding. Steps that change state, and every control, SHALL be marked for a fresh reseed.

#### Scenario: Unsupported Node
- **WHEN** the wrapper runs under Node 22
- **THEN** it prints one JSON result naming the Node requirement and exits with status 3 without starting a run

#### Scenario: Rebuilt checkout under a live preview
- **WHEN** the checkout is rebuilt with different web sources while a run serves it
- **THEN** `doctor` reports the served artifact digest as changed rather than matching

### Requirement: Simulator-only runs
A verification run SHALL launch the built server with explicit simulator mode, the run's own data directory and port, and a transport guard. The guard SHALL refuse to start the server unless the final process environment selects the simulator. It SHALL block and record every outbound HTTP request and non-loopback connection before it leaves the process. A run SHALL NOT bind an installed port.

#### Scenario: Ambient device settings
- **WHEN** a run starts while the caller selects device mode, the owner's data directory and the installed port, and the run's data holds a saved device target
- **THEN** health reports simulator mode without connectivity, playback and a probe send no physical request, and the owner's directories stay unchanged

#### Scenario: Lost simulator setting
- **WHEN** the launch environment no longer selects the simulator
- **THEN** the server does not start and no transport attempt is recorded

#### Scenario: Physical transport attempt
- **WHEN** code in a guarded process calls the device transport or fetches a non-loopback address
- **THEN** the call fails without a connection, and the recorded attempt fails the no-physical-transport check

### Requirement: Private synthetic data
Seeding SHALL write only into an empty real directory outside every Git checkout, including through symlink aliases. That directory SHALL NOT be, contain or lie inside the owner's normal data and lock directories or an inherited data directory. Scenarios SHALL use only generated 64×64 fixtures, one playlist and synthetic agent sessions. Any credential SHALL be generated for the run, revoked after seeding and never stored in plain text.

#### Scenario: Unsafe or occupied data directory
- **WHEN** the data directory is in a checkout, reached through an alias, overlaps owner state, is a link or already holds files
- **THEN** seeding or launch fails before the server starts

#### Scenario: Concurrent runs and reseed
- **WHEN** two runs are active and one is reseeded to another scenario on its recorded port
- **THEN** each run keeps its own port and state, and the reseeded run shows only the new scenario

### Requirement: Readiness and boundary checks
A run SHALL be ready only after its simulator ready line on `127.0.0.1` and a health read reporting simulator mode without connectivity. Start checks SHALL confirm simulator mode through health and device settings, and a guard record for the serving port with no transport attempt.

#### Scenario: Occupied recorded port
- **WHEN** a relaunch after reseeding finds its recorded port occupied
- **THEN** the server exits and its error names the port

### Requirement: Assertive capture steps
Capture steps SHALL drive the actual page and record named assertions for library selection, playlist progression, playback controls, Monitor/Media transitions, recovery from a lost command response and the device boundary. Pixel assertions SHALL compare drawn pixels with fixture definitions or with the server's exact monitor picture. Each step SHALL end by asserting that the run has recorded no transport attempt. Saved 64×64 results SHALL include an exact PNG, an enlarged copy and a label that marks them as simulator rendering, not physical display evidence.

#### Scenario: Reference run
- **WHEN** every step runs against a seeded reference run
- **THEN** every assertion passes, and the progression, library and monitor results equal their expected pixels

#### Scenario: Lost response
- **WHEN** a Next response is lost after the server applied it and the user retries
- **THEN** the retry reuses the request identity and playback advances exactly once

### Requirement: Negative controls
Each `control-*` step SHALL run a reference step with a known-wrong behavior injected between the page and the server, and SHALL report failed at the assertion that names that behavior.

#### Scenario: Known-wrong behavior
- **WHEN** frames are wrong, Next is applied twice, Select Media resumes playback or a retry uses a fresh identity
- **THEN** the matching control fails at its library pixel, item 2, paused-intent or single-effect assertion, and a reference step on the same run still passes

### Requirement: Consistent feature map
The development guide SHALL map library, playlist, playback, 64×64 rendering, Monitor/Media, recovery and the device boundary to their entry, capture step, deterministic action and expected observation. It SHALL list exactly the registered steps, controls, scenarios, fixtures and saved results.

#### Scenario: Drift
- **WHEN** a step, control, scenario, fixture or saved result is renamed without updating the map
- **THEN** the feature map test fails
