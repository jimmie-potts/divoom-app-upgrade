## MODIFIED Requirements

### Requirement: Explicit physical startup
Device mode SHALL require explicit PIXOO_MODE=device and a valid version-1 private device configuration containing a canonical private IPv4 target and the pixoo64-smoke-2026-09-06, pixoo64-gif-2026-10-01 or pixoo64-hosted-2026-10-01 profile. Missing or invalid device settings SHALL fail before listening or any device request. Default startup SHALL remain simulator-only even with saved hardware settings. Startup SHALL capture immutable target/profile settings; saving settings or connecting a client SHALL NOT activate or retarget hardware. Startup SHALL restore media context paused without replaying it to the device; separately configured Monitor activation retains its existing behavior. Trace: issue #42 criteria 1-3 and issue #55 AC5–AC6.

#### Scenario: Missing or incompatible device configuration
- **WHEN** device mode is explicitly selected but settings are absent, malformed, a symlink, oversized, or specify an unsupported device profile
- **THEN** startup fails without listening or contacting a target
- **AND** existing settings and media remain intact

#### Scenario: Default mode with saved device target
- **WHEN** the application starts without PIXOO_MODE=device and valid settings for a supported observed profile exist
- **THEN** it serves a simulator and performs no device requests

#### Scenario: Explicit device mode
- **WHEN** the application starts in device mode with valid private settings for a supported observed profile
- **THEN** its control listener binds only IPv4 loopback and captures one immutable device target/profile
- **AND** saved playback context opens paused without replaying that context to the display


#### Scenario: Hosted startup configuration
- **WHEN** the hosted profile is selected in device mode
- **THEN** startup requires explicit private file-listener bind, port and device-reachable HTTP origin settings
- **AND** missing or invalid settings fail before any device request while simulator startup opens no file listener
