## Context

See proposal.md for the outcome and linked scope. `config.ts` rejects device mode,
`api.ts` creates a `FakeDeviceAdapter`, and `device-routes.ts` loads private settings
after player construction. `HttpDeviceAdapter` already supplies the required
transport and FIFO operations. The player currently retries connectivity failures
and skips rejected uploads without first considering `priorEffects`.

Design is required because startup, timing, concurrency and persisted recovery
cross several modules. The user accepted the activation, smoke-profile and
uncertainty recommendations on resumption. ADR 0012 records those decisions.

## Goals / Non-Goals

**Goals:** Keep adapter ownership in application composition; make mode and
profile selection immutable; preserve the existing player and request-identity
contracts; make source tests deterministic through transport injection.

**Non-Goals:** Hardware discovery, raw protocol routes, another writer, MCP tools,
LAN listeners, automatic service installation, firmware inference, precise
visible-play timing, broader media profiles or content restoration on shutdown.

## Decisions

### Activate from one validated startup snapshot

Extend `RuntimeConfig.mode` to `simulator | device`. Extract the existing bounded
version-1 settings reader into a server module reusable by startup and settings
routes. Validate the file before creating the device adapter, player or listener.
Missing settings remain valid in simulator mode; device mode requires an explicit
private IPv4 target and the dated smoke profile. Retain the existing invalid-file
failure behavior in both modes.

Compose `HttpDeviceAdapter` only in device mode and inject its transport in tests.
Default construction still uses `FakeDeviceAdapter({recordHistory:false})`.
The snapshot is copied and immutable; routes save the next-start configuration
and expose active configuration separately with a restart-required indication.
Settings writes never hot-swap the adapter. This avoids retargeting queued work.
Environment IP overrides and hot activation would create additional authority
and race boundaries, so neither is introduced.

### Reuse ownership and command boundaries

`api.ts` continues to create one library, player, command receipt sequence and
event stream. `device-routes.ts` passes probe, brightness and screen requests to
that player. The existing library lock rejects a second backend using the same
directory. Add a local device-ownership lock keyed by a hash of the configured
target in one private per-user lock location outside the selected runtime
directory. Reuse the existing exclusive SQLite ownership pattern so process exit
releases ownership without deleting stale lock files. Acquire it before transport
construction and hold it until the player closes and in-flight transport settles.
This prevents another application backend for the same target in a different
data directory from writing concurrently. Tests inject an isolated lock location.
Documentation still prohibits other hosts, spike tools and external apps from
writing simultaneously; this is not a cross-host device lease.

Use `HttpDeviceAdapter` through its `DeviceAdapter` contract so reset-ID and other
spike-only operations remain inaccessible. The production transport keeps private
IPv4 validation, port 80, `/post`, bounded timeout and no redirects. Startup and
status reads do not probe the device. API command identities remain server-issued
and shared by player/display operations. Later MCP composition must use these
services and cannot choose an IP or start another backend.

### Select the recorded profile without rewriting media

Use `PIXOO64_SMOKE_PROFILE` as the single source of hardware limits. Map it into
the adapter's profile shape with `readyDelayMs:0`; this is an estimate, not a
measured readiness guarantee. Pass the active media profile into catalog import
and render operations. Reuse the existing immutable renderer identity and profile
validation rather than changing stored renditions in place.

Validate every prepared rendition against active frame/timing bounds before
upload, including renditions captured before switching modes. A compatible older
rendition may play even if created under the simulator profile; its actual bytes
and delays must satisfy the active limits. Incompatible media raises a typed
profile error without sending device requests, truncating or retiming animation.

`LibraryPlaybackStore` currently fills a null still delay with 100 ms. Give this
composition an explicit still transport delay: 100 ms for simulator and 500 ms
for device mode. Only PNG/JPEG still transport receives the placeholder. GIFs,
including single-frame GIFs, retain their effective delays. Still dwell remains
duration-only; plays dwell continues to multiply total plays by effective delays.

### Pause uncertainty before reconnect or skip

For device-mode composition only, in `Player.uploaded` and observed display-control handling, inspect failed
`priorEffects` before connectivity recovery or failed-item traversal. A current
failure with possible effects retires pending generation/timers, sets paused
intent/state and preserves the item plus error code and uncertainty marker.
No automatic probe callback, skip or restart can issue another write until fresh
explicit intent. Explicit resume clears the error and starts the current item
from the beginning. An old-generation result remains unable to overwrite a newer
pause, stop or navigation command. Definite no-effect errors keep current bounded
retry/skip behavior.

Extend checkpoint `lastError` with an optional `priorEffects` marker; old records
without it remain valid and no stored schema-version rewrite is required. Expose
the same error through snapshots/SSE and render an explicit resume message.
`Player.close` keeps its cancellation and paused checkpoint contract. No shutdown
reset, screen-off, brightness restoration or content replacement is added.

### Separate readiness, transport and visual evidence

Update core health/diagnostics schemas and browser labels for the selected mode.
Device connectivity starts unknown and is reported from observed transport
results, not configuration existence. Simulator availability never becomes a
physical connection. Keep unavailable brightness/channel/firmware telemetry
absent or explicitly unavailable rather than inventing values. Status reads
must not send probes. Upload completion, loading and estimated dwell remain
separate from physical observation, and the UI retains that wording.

## Risks / Trade-offs

- An HTTP write may apply before cancellation or failure is known. Pause on
  uncertainty, preserve the receipt/error and require explicit resume.
- The smoke profile rejects most GIFs. Preserve originals and references, report
  the active limits, and offer simulator rollback without automatic conversion.
- The dated evidence has unknown firmware and loading interruptions. Keep zero
  added ready delay labeled estimated and leave visible acceptance to #12/#26.
- Another host or external app may control the display. Enforce per-user local
  backend ownership and document exclusive operation without claiming automatic
  takeover detection or cross-host locking.
- Saved settings can differ from the active target. Expose both and require a
  manual restart to apply the change.

## Migration Plan

Existing simulator starts and stored settings remain supported. Existing
checkpoints accept absent uncertainty metadata and always reopen paused.
After separate authorization, an operator saves validated smoke settings in the
private runtime directory, stops the simulator and starts with `PIXOO_MODE=device`.
Returning to `PIXOO_MODE=simulator` and restarting restores simulator operation
using the same untouched library. No installer or service action is part of this
source change. The acceptance runbook requires an explicit target and permission
before any physical command, records observations outside Git, and stops on an
uncertain or unacceptable result.

The simulator retains its existing recovery behavior; device-mode composition explicitly selects the uncertainty pause policy.
