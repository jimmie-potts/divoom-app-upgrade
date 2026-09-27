## ADDED Requirements

### Requirement: Adapter command
`npm run verify -- <operation>` SHALL pass the Pixoo plug-in to the vendored shared verification core, which owns the run lifecycle, receipt and proof. The wrapper SHALL refuse a Node version outside 24.5 through 24.x before loading the plug-in, and the plug-in SHALL load without build output. `start` and `restart` SHALL build the checkout before seeding and report a failed build with a fixed line. Steps that change state, and every control, SHALL be marked for a fresh reseed.

#### Scenario: Unsupported Node
- **WHEN** the wrapper runs under Node 22
- **THEN** it prints one JSON result naming the Node requirement and exits with status 3 without starting a run

#### Scenario: Fresh checkout and failed build
- **WHEN** `help` runs where no build output exists, or the build fails with private text in its output
- **THEN** `help` answers with one JSON line, and the failed build is reported by exit code or signal without any of its output

#### Scenario: Rebuilt checkout under a live preview
- **WHEN** the checkout is rebuilt with different web sources while a run serves it
- **THEN** `doctor` reports the served artifact digest as changed rather than matching

### Requirement: Simulator-only runs
A verification run SHALL launch the built server with explicit simulator mode, the run's own data directory and port, and a transport guard. The guard SHALL refuse to start the server unless the final process environment selects the simulator, and SHALL remove every other inherited `PIXOO_*` setting before the server reads its configuration. A run SHALL NOT bind an installed port.

#### Scenario: Ambient device settings
- **WHEN** a run starts while the caller selects device mode, the owner's data directory, the installed port, MCP and the native controller, and the run's data holds a saved device target
- **THEN** health reports simulator mode without connectivity, playback, an upload and a probe send no physical request, the MCP and controller routes are absent, and the owner's directories stay unchanged

#### Scenario: Lost simulator setting
- **WHEN** the launch environment no longer selects the simulator
- **THEN** the server does not start and no transport attempt is recorded

### Requirement: Observed transport boundary
Through the public Node.js APIs, the transport guard SHALL block and record, before it leaves the process, every outbound HTTP request, UDP socket, Unix socket connection and TCP connection except to the process's own listening port, so installed loopback services are refused like a device. Records SHALL name hosts and ports, never URL paths. A later paired scenario MAY allow declared ports of another disposable run, never an installed port.

#### Scenario: Physical transport attempt
- **WHEN** code in a guarded process calls the device transport or fetches a non-loopback address
- **THEN** the call fails without a connection, and the recorded attempt fails the no-physical-transport check

#### Scenario: Installed loopback service
- **WHEN** code in a guarded process connects to `127.0.0.1:8788`, another local port or a Unix socket
- **THEN** the connection is refused and recorded, and the no-physical-transport check fails; a connection to the process's own listening port is allowed

### Requirement: Guarded code execution
A process the server forks and every worker thread it starts SHALL run under the same guard, even when the caller replaces `execArgv` or `env`, and fork options SHALL be honored as Node reads them. Every other process start the public API offers (`spawn`, `exec`, `execFile`, their Sync forms, `ChildProcess#spawn`, `process.execve`) SHALL be refused and recorded. The launch SHALL empty `NODE_OPTIONS`. Internal bindings and native addons are out of scope.

#### Scenario: Forked children and workers
- **WHEN** a guarded process forks a child with replaced arguments and environment, as the media worker does, or with an undefined argument list before its options, or starts a worker with an empty `execArgv`
- **THEN** each child or worker keeps its options, its connection is refused and recorded, and an upload still renders in the guarded media worker

#### Scenario: Other process starts
- **WHEN** a guarded process calls each other public way to start or replace a process
- **THEN** every call is refused and recorded, and nothing it would have started reaches the network

#### Scenario: Inherited preload
- **WHEN** the caller's `NODE_OPTIONS` imports a module, for the server or for a forked child
- **THEN** that module never runs

### Requirement: Private synthetic data
Seeding SHALL write only into an empty real directory outside every Git checkout, including through symlink aliases. That directory SHALL NOT be, contain or lie inside the owner's normal data and lock directories or an inherited data directory. Scenarios SHALL use only generated 64×64 fixtures, one playlist and synthetic agent sessions. Any credential SHALL be generated for the run, revoked after seeding and never stored in plain text.

#### Scenario: Unsafe or occupied data directory
- **WHEN** the data directory is in a checkout, reached through an alias, overlaps owner state, is a link or already holds files
- **THEN** seeding or launch fails before the server starts

#### Scenario: Concurrent runs and reseed
- **WHEN** two runs are active and one is reseeded to another scenario on its recorded port
- **THEN** each run keeps its own port and state, and the reseeded run shows only the new scenario

### Requirement: Readiness and boundary checks
A run SHALL be ready only after its simulator ready line on `127.0.0.1` and a health read reporting simulator mode without connectivity. Start checks SHALL confirm simulator mode through health and device settings, and a guard record for the serving port with no transport attempt. A failed start SHALL be named by a fixed cause line for known server and guard failures, without copying server output.

#### Scenario: Occupied recorded port
- **WHEN** a relaunch after reseeding finds its recorded port occupied
- **THEN** the server exits and the failure is named `pixoo-start-failed: port in use`

#### Scenario: Unknown server output
- **WHEN** the server's error output matches no known failure, even if it contains a token or path
- **THEN** no cause line is reported

### Requirement: Assertive capture steps
Capture steps SHALL drive the actual page and record named assertions for library selection, playlist progression, playback controls, Monitor/Media transitions, recovery from a lost command response and the device boundary. Pixel assertions SHALL compare drawn pixels with fixture definitions or with the server's exact monitor picture. Each step SHALL end by asserting that the run has recorded no transport attempt.

#### Scenario: Reference run
- **WHEN** every step runs against a seeded reference run
- **THEN** every assertion passes, and the progression, library and monitor results equal their expected pixels

#### Scenario: Lost response
- **WHEN** a Next response is lost after the server applied it and the user retries
- **THEN** the retry reuses the request identity and playback advances exactly once

### Requirement: Labelled simulator results
Saved 64×64 results SHALL include an exact PNG, an enlarged copy and a label that marks them as simulator rendering, not physical display evidence.

#### Scenario: Saved progression result
- **WHEN** playlist progression ends on item 2
- **THEN** the capture holds the exact 64×64 PNG of that item's first frame, an 8× copy and a label naming the run, scenario and simulator rendering

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
