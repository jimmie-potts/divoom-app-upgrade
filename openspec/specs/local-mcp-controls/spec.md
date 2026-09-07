# Local MCP controls Specification

## Purpose

Allow a local authenticated agent to inspect the Pixoo application and request display controls while preserving application ownership and distinguishing transport evidence from physical observation.

## Requirements

### Requirement: Explicit local activation
The application SHALL expose `/mcp` only when explicitly enabled with valid private credential configuration. Activation SHALL preserve loopback binding and the explicitly selected runtime mode. Missing activation SHALL leave MCP unavailable without provisioning credentials or changing device configuration. Trace: [issue #24](https://github.com/jimmie-potts/divoom-app-upgrade/issues/24), activation and local-access criteria.

#### Scenario: Default startup
- **WHEN** the application starts without MCP activation
- **THEN** `/mcp` is unavailable and ordinary simulator and browser behavior remain unchanged
- **AND** no credential or device activation is created

#### Scenario: Explicit simulator access
- **WHEN** MCP is enabled with valid credentials in simulator mode
- **THEN** an authenticated native client can initialize without an Origin header
- **AND** connection and discovery produce no device writes

### Requirement: Protected bounded discovery
MCP SHALL authenticate each HTTP request against current private credential state, enforce read/control authorization, validate the exact listener Host and every supplied Origin, and reject cross-site fetch metadata. It SHALL use the shared module's bounded transport and registration behavior. Credentials, private paths, device addresses and media metadata SHALL NOT enter discovery, results or logs. Trace: issue #24, authentication, shared-module and tool-description criteria.

#### Scenario: Invalid caller
- **WHEN** a caller supplies a foreign Host or Origin, invalid credential or unauthorized scope
- **THEN** protected data and effects remain unavailable with a sanitized result

#### Scenario: Revocation during a session
- **WHEN** a credential is revoked after successful initialization
- **THEN** later requests on the existing session are rejected before application access

#### Scenario: Bounded delivery
- **WHEN** transport capacity or message limits are exceeded
- **THEN** excess work fails within the configured bounds without creating another device writer or an unbounded waiting queue

### Requirement: Fixed display tools
The local endpoint SHALL bind exactly `get_status()`, `set_brightness(percent, request_id)` and `set_screen(on, request_id)` for the existing application target. Inputs SHALL reject extra fields, brightness outside integer 0-100, nonboolean screen state and malformed request identities before effects. Status SHALL be annotated read-only and display mutations as writes. Arbitrary targets, raw commands, URLs and filesystem inputs SHALL NOT be accepted. Trace: issue #24, tool, validation and description criteria.

#### Scenario: Discovery and invalid input
- **WHEN** an authorized client discovers tools and submits an invalid brightness or screen input
- **THEN** it sees the fixed tool schemas and receives a validation error without consuming an application request identity or invoking the adapter

#### Scenario: Screen control during playback
- **WHEN** an authorized client turns the screen off and then on
- **THEN** off follows the player's cancellation and pause semantics
- **AND** on does not resume playback

### Requirement: Honest status projection
Status SHALL separate server readiness, selected mode, observed connectivity, requested display values, acknowledged writes, probe observations and player state. It SHALL identify the server epoch, next command identity, monotonic sample time, observation timestamps or ages, and unavailable values. Simulator status SHALL report physical connectivity false. Transport acknowledgment SHALL NOT establish visual confirmation. Status SHALL omit the full captured playlist and private device details. Trace: issue #24, status-evidence criterion.

#### Scenario: Unobserved ready application
- **WHEN** status is read before transport observations exist
- **THEN** readiness is reported separately from unknown connectivity and unavailable display observations
- **AND** simulator physical connectivity remains false

#### Scenario: Repeated read after a write
- **WHEN** status is read repeatedly after an acknowledged brightness write
- **THEN** the requested and acknowledged values remain distinct from probe-observed brightness
- **AND** reads do not send probes, advance generations or refresh the original observation timestamp

### Requirement: Application outcomes and delivery lifetime
MCP display commands SHALL share the existing application's admission, generation and receipt semantics. Structured outcomes SHALL retain request identity, applicable operation timing, typed errors and possible prior effects. Replays SHALL preserve the original outcome. Client cancellation or disconnect after admission SHALL NOT automatically replay or cancel owner work. Ambiguous outcomes SHALL identify uncertainty and prohibit automatic retry with a new identity. Trace: issue #24, shared-service, replay and cancellation criteria.

#### Scenario: Concurrent HTTP and MCP controls
- **WHEN** HTTP and MCP submit the same display command identity and values
- **THEN** both join one application execution and receive projections of the same retained outcome
- **AND** a different command at that identity is rejected without effects

#### Scenario: Upload and uncertain delivery
- **WHEN** a display control overlaps an upload or its client disconnects after admission
- **THEN** the existing serialized writer preserves the upload transaction and the backend continues running
- **AND** a failure with possible prior effects retains uncertainty without automatic command replay

### Requirement: Source qualification and acceptance boundary
The delivery SHALL pin the immutable shared module and compatible SDK/license record and verify the built application with a real protocol client, synthetic credentials and fake transport. Documentation SHALL describe local credential setup/revocation, Codex Streamable HTTP configuration, startup/shutdown, rollback and same-machine Windows/WSL diagnostics. Source evidence SHALL remain separate from installed-client and physical acceptance in #26. Trace: issue #24, verification and documentation criteria.

#### Scenario: Clean source validation
- **WHEN** the documented source checks run in isolated runtime storage without a physical device
- **THEN** the built server supports authenticated discovery and valid/invalid tool calls while browser checks remain successful
- **AND** no personal client configuration or hardware acceptance is claimed
