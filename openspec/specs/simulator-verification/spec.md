# simulator-verification Specification

## Purpose
Run the actual Pixoo server as a disposable simulator-only verification run through the shared app-verify core, with private synthetic data, an observed transport boundary that refuses devices and installed services, assertive capture steps with negative controls and a feature map that matches them.

## Requirements

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
A verification run SHALL launch the built server with explicit simulator mode, the run's own data directory and port, and a transport guard. The guard SHALL refuse to start the server unless the final process environment selects the simulator, and SHALL remove every other inherited `PIXOO_*` setting before the server reads its configuration, except the native controller setting of a `hub-paired` launch. Every launch SHALL declare its paired ports explicitly, empty outside `hub-paired`. A run SHALL NOT bind an installed port.

#### Scenario: Ambient device settings
- **WHEN** a run starts while the caller selects device mode, the owner's data directory, the installed port, MCP and the native controller, and the run's data holds a saved device target
- **THEN** health reports simulator mode without connectivity, playback, an upload and a probe send no physical request, the MCP and controller routes are absent, and the owner's directories stay unchanged

#### Scenario: Lost simulator setting
- **WHEN** the launch environment no longer selects the simulator
- **THEN** the server does not start and no transport attempt is recorded

#### Scenario: Inherited controller setting
- **WHEN** the caller enables the native controller and names another controller identity for a launch that declares no paired port
- **THEN** the guard removes both, while a paired launch keeps the controller enabled with its default identity

### Requirement: Observed transport boundary
Through the public Node.js APIs, the transport guard SHALL block and record, before it leaves the process, every outbound HTTP request, UDP socket, Unix socket connection and TCP connection except to the process's own listening port and to a port its own launch declared as paired, so installed loopback services are refused like a device. Records SHALL name hosts and ports, never URL paths. Only a `hub-paired` launch SHALL declare a paired port, the `hub-feed` port, and never an installed port.

#### Scenario: Physical transport attempt
- **WHEN** code in a guarded process calls the device transport or fetches a non-loopback address
- **THEN** the call fails without a connection, and the recorded attempt fails the no-physical-transport check

#### Scenario: Installed loopback service
- **WHEN** code in a guarded process connects to `127.0.0.1:8788`, another local port or a Unix socket
- **THEN** the connection is refused and recorded, and the no-physical-transport check fails; a connection to the process's own listening port is allowed

#### Scenario: Paired launch reaching beyond the Hub
- **WHEN** a process launched with the Hub port declared connects to that port, to an installed port, to another local port and sends a device request
- **THEN** only the Hub connection is allowed and recorded as paired, the other attempts are refused and recorded, and the check fails in `hub-paired`

### Requirement: Guarded code execution
A fork of Node and every file-based worker thread SHALL run under the same guard, even when the caller replaces `execArgv` or `env`, with fork options honored as Node reads them. Every other public process start SHALL be refused and recorded, including a fork of another program and an eval worker. The launch SHALL empty `NODE_OPTIONS`. The guard is not a sandbox against hostile code already in the process (side-effecting `toString`, internal bindings, native addons).

#### Scenario: Forked children and workers
- **WHEN** a guarded process forks a child with replaced arguments and environment, as the media worker does, or with an undefined argument list before its options, or starts a worker with an empty `execArgv`
- **THEN** each child or worker keeps its options, its connection is refused and recorded, and an upload still renders in the guarded media worker

#### Scenario: Other process starts
- **WHEN** a guarded process calls each other public way to start or replace a process, forks another program as `execPath`, or starts an eval worker
- **THEN** every call is refused and recorded without the eval source, and nothing it would have started runs or reaches the network

#### Scenario: Inherited preload
- **WHEN** the caller's `NODE_OPTIONS` imports a module, for the server or for a forked child
- **THEN** that module never runs

### Requirement: Private synthetic data
Seeding SHALL write only into an empty real directory outside every Git checkout, including through symlink aliases. That directory SHALL NOT be, contain or lie inside the owner's normal data and lock directories or an inherited data directory. Scenarios SHALL use only generated 64×64 fixtures, one playlist and synthetic agent sessions. Standalone scenarios SHALL generate any credential for the run, revoke it after seeding and never store it in plain text. The `hub-paired` scenario SHALL keep the caller's feed token only in its private remote monitor configuration, and the controller token only as a digest.

#### Scenario: Unsafe or occupied data directory
- **WHEN** the data directory is in a checkout, reached through an alias, overlaps owner state, is a link or already holds files
- **THEN** seeding or launch fails before the server starts

#### Scenario: Concurrent runs and reseed
- **WHEN** two runs are active and one is reseeded to another scenario on its recorded port
- **THEN** each run keeps its own port and state, and the reseeded run shows only the new scenario

#### Scenario: Paired credentials at rest
- **WHEN** `hub-paired` is seeded
- **THEN** no file in the data directory holds the controller token, and only the 0600 remote configuration holds the feed token

### Requirement: Readiness and boundary checks
A run SHALL be ready only after its simulator ready line on `127.0.0.1` and a health read reporting simulator mode without connectivity. Start checks SHALL confirm simulator mode through health and device settings, and a guard record for the serving port with no transport attempt. A connection to another port SHALL pass only when the connecting process's own launch declared it paired. The serving process SHALL be paired with exactly the `hub-feed` port in `hub-paired` and with no port otherwise. The `hub-feed` check SHALL pass in `hub-paired` when Pixoo's feed is current, from `verify-owner`, at the Hub's revision. It SHALL be skipped while the launch has never had a current feed and in other scenarios, and SHALL fail when a current feed turns stale. A failed start SHALL be named by a fixed cause line for known server and guard failures, without copying server output.

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
- **THEN** the `hub-feed` check fails with the stale revision, then passes again without a restart

### Requirement: Assertive capture steps
Capture steps SHALL drive the actual page and record named assertions for library selection, playlist progression, playback controls, Monitor/Media transitions, recovery from a lost command response, the device boundary and Hub pairing. Pixel assertions SHALL compare drawn pixels with fixture definitions or with the server's exact monitor picture. Each step SHALL end by asserting that the run has recorded no transport attempt.

#### Scenario: Reference run
- **WHEN** every step runs against a seeded reference run
- **THEN** every assertion passes, and the progression, library and monitor results equal their expected pixels

#### Scenario: Lost response
- **WHEN** a Next response is lost after the server applied it and the user retries
- **THEN** the retry reuses the request identity and playback advances exactly once

#### Scenario: Hub-fed Monitor
- **WHEN** `hub-sessions` runs on a paired run
- **THEN** the feed is current at the Hub's revision, the Monitor lists every Hub session and project, the canvas equals the server picture, the controller endpoint answers the Hub's token with the default identity and refuses a request without it, and only the run's port and the Hub port were reached

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

#### Scenario: Stale Hub feed on the page
- **WHEN** the page's monitor view reports the Hub feed stale without its sessions
- **THEN** `control-hub-feed-stale` fails at the Monitor list assertion, and `hub-sessions` on the same run still passes

### Requirement: Consistent feature map
The development guide SHALL map library, playlist, playback, 64×64 rendering, Monitor/Media, recovery, the device boundary and Hub pairing to their entry, capture step, deterministic action and expected observation. It SHALL list exactly the registered steps, controls, scenarios, fixtures and saved results.

#### Scenario: Drift
- **WHEN** a step, control, scenario, fixture or saved result is renamed without updating the map
- **THEN** the feature map test fails

### Requirement: Hub-paired scenario
The plug-in SHALL declare the optional input `hub-feed`, which the `hub-paired` scenario requires: the paired Hub run's origin, exactly `http://127.0.0.1:<port>/`, on neither an installed service's port nor the run's own port. The `hub-paired` seed SHALL read `hub-feed-token` and `hub-controller-token` from the run directory, each a private regular file holding one 43-character base64url token. It SHALL write the remote monitor configuration for owner `verify-owner` at `<hub-feed>api/monitor/v1` with the feed token, register the controller token for read and control by digest only, and seed no local sessions. Only a `hub-paired` launch SHALL enable the native controller API, with its default identity, and declare the Hub port to the transport guard. From that launch on, the ready line SHALL announce the run's main origin as endpoint `controller`. A token SHALL never be an input or appear in a receipt, event, log or failure detail.

#### Scenario: Pairing before the Hub accepts the token
- **WHEN** a run is reseeded `hub-paired` while the Hub rejects its feed token, and the Hub later accepts it
- **THEN** the reseed succeeds with the feed unavailable and the `hub-feed` check skipped, then the feed turns current at the Hub's revision and the Monitor lists the Hub's sessions

#### Scenario: Hub controller calls
- **WHEN** the Hub reads the controller snapshots with its controller token and sends one `brightness.set` command, then repeats the same request
- **THEN** both snapshots name controller `pixoo-controller` and device `pixoo-local`, a request with another token is refused, and exactly one brightness operation reaches the simulator's writer

#### Scenario: Missing or unsafe token file
- **WHEN** a token file is missing, a link, readable by others, or holds anything but one token
- **THEN** the seed fails with a fixed line that names the file and no token, and writes nothing

#### Scenario: Reseed to a standalone scenario
- **WHEN** a paired run is reseeded to `library-playlist`
- **THEN** it embeds its own owner, its controller routes answer 404, the `controller` endpoint is still announced, and the earlier Hub reads still pass the transport check
