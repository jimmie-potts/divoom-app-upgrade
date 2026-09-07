# ADR 0012: Opt-in physical application adapter

Status: Accepted for [issue #42](https://github.com/jimmie-potts/divoom-app-upgrade/issues/42).

The application already owns one player, its adapter queue and a private library.
The HTTP spike has a tested command path, but application startup currently rejects
device mode. The user accepted explicit environment activation, the existing
private settings file and the dated smoke profile for this integration.

`PIXOO_MODE` defaults to `simulator`. Only `PIXOO_MODE=device` enables a physical
adapter. Startup reads and validates version 1 `device.json` from `PIXOO_DATA_DIR`
before constructing the adapter or accepting requests. Device mode requires the
explicit canonical private IPv4 target and `pixoo64-smoke-2026-09-06` profile.
Missing, malformed or incompatible settings fail startup. There is no target
discovery, default IP, URL override or fallback to another mode.

The backend captures the device configuration and profile once at startup.
Saving settings changes the next startup configuration and cannot replace the
running adapter or retarget queued commands. Status distinguishes saved settings
from the active configuration and indicates when a restart is required. Device
requests use the existing fixed port 80 `/post` transport with redirects disabled.
The browser listener remains on IPv4 loopback. Later MCP clients must reuse this
backend and its services; connecting a client cannot enable hardware.

The application uses one `HttpDeviceAdapter` behind the existing `DeviceAdapter`
contract. Uploads and all controls use its FIFO writer. The existing library lock
excludes a second owner of the same runtime directory. A local ownership lock
keyed by the configured device excludes this user's other backend processes for
the same target even when runtime directories differ. Hold that lock until all
in-flight transport settles. Operators must keep spike tools, other hosts and
external apps from writing to the same display. This source change does not
claim cross-host ownership or automatic takeover detection.

The active media and adapter limits use the recorded smoke bounds: one or two
complete 64x64 RGB frames, exactly 500 ms per uploaded frame, uniform timing.
New media uses that render profile in device mode. Existing immutable renditions
are checked against the active bounds before upload; compatible frames may be
used without rewriting their stored profile or identity. Incompatible animations
fail without frame dropping or retiming. A PNG/JPEG still has no media frame
delay, so its transport placeholder is 500 ms in device mode and 100 ms in
simulator mode. Its duration policy alone determines dwell. GIF delays, including
single-frame GIF timing, retain their existing effective values.

The zero extra ready-delay estimate remains an application estimate. A successful
HTTP result establishes transport acceptance only. Status separates backend
readiness, transport availability, loading and estimated playback timing. It does
not infer visible content, firmware, finite loops or unreported telemetry.

In device-mode composition, an operation failure with `priorEffects: possible` pauses playback and retains
the error and current context. No reconnect probe, automatic skip or replay may
resume writes from that uncertain result. Explicit resume starts the current
item from the beginning under a fresh generation. Definite failures before any
write keep the existing bounded recovery rules. Old-generation results cannot
replace newer user intent. Stop, pause and shutdown retire pending work; shutdown
persists paused recovery and sends no reset, screen, brightness or content restore
command. Cancellation cannot undo an HTTP write already received by the device.

The source change is validated with injected fake HTTP transports and isolated
runtime directories. Installation, personal configuration changes and display
operation remain outside source delivery. Issues #12 and #26 own their separately
authorized physical observations.

The simulator retains its existing recovery behavior; device-mode composition explicitly selects the uncertainty pause policy.
