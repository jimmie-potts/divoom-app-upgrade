# Run the application with a Pixoo

The application defaults to the simulator. `PIXOO_MODE=device` selects the HTTP
adapter at startup using the private `device.json` settings. The listener remains
on IPv4 loopback. The browser uses the same player and serialized writer in both
modes. [ADR 0012](decisions/0012-physical-application-adapter.md) records the design.

Source tests use injected transports and isolated storage. Installation and
physical acceptance require a separate authorized session with an explicit device
IP and permission to replace current content. No source check establishes visible
output, precise loop counts or phone access. Issues
[#12](https://github.com/jimmie-potts/divoom-app-upgrade/issues/12) and
[#26](https://github.com/jimmie-potts/divoom-app-upgrade/issues/26) own that evidence.

## Prepare private settings

Build with Node 24.5 or later in the 24.x line using `npm ci` and `npm run build`. Choose the private data
directory described in [local operations](local-operations.md). Start explicitly
in simulator mode before saving settings. In Linux/WSL:

```bash
export PIXOO_DATA_DIR="$HOME/.local/share/pixoo-playlist-controller"
export PIXOO_MODE=simulator
npm start
```

In a native Windows PowerShell session:

```powershell
$env:PIXOO_DATA_DIR = Join-Path $env:LOCALAPPDATA 'PixooPlaylistController'
$env:PIXOO_MODE = 'simulator'
npm start
```

In Settings, enter the explicitly supplied private IPv4 address and select
`pixoo64-smoke-2026-09-06`. Leave model or firmware observations blank when unknown.
Save configuration writes a version-1 file beneath `PIXOO_DATA_DIR`; saving does
not enable hardware. Its shape is:

```json
{
  "version": 1,
  "configuration": {
    "ip": "<explicit-private-IPv4>",
    "profile": "pixoo64-smoke-2026-09-06"
  }
}
```

The placeholder is deliberately invalid. Replace it only with the authorized
target if creating the file manually. Keep settings, media and observations
outside Git. Startup rejects missing device settings, malformed files, unsupported
profiles and noncanonical or nonprivate IPv4 targets. It does not discover a
target or fall back to the simulator after a device configuration error.

## Activate and stop

Stop the simulator with Ctrl+C and wait for exit. After the separate physical
session is authorized, use the same directory and set the mode before starting:

```bash
export PIXOO_MODE=device
npm start
```

PowerShell uses `$env:PIXOO_MODE = 'device'` followed by `npm start`.

The backend captures settings once. Later saves show the active target separately
and indicate when restart is required. Saving never retargets queued work. Device
connectivity starts unknown; startup, health reads and opening the browser do not
probe or upload. A saved session reopens paused.

Use one backend for the target. A per-user local lock rejects another backend
for the same IP even with a different data directory. It cannot exclude other
hosts, users, the Divoom app or protocol spike tools. Stop those writers before
operating this application. Do not run the spike beside the backend.

Ctrl+C cancels future work, preserves paused recovery, waits for in-flight
transport to settle and releases ownership. It sends no clear, screen, brightness
or content restoration command. Last content may remain visible and an animation
may continue looping. Cancellation cannot undo a request the display received.

## Use the recorded media limits

Device mode renders with `pixoo64-smoke-2026-09-06`: one or two complete 64×64
frames and exactly 500 ms per animation frame. The recorded smoke test had unknown
firmware and early loading screens. These bounds establish no wider capability.

An incompatible GIF fails with `profile-limit`; the application does not drop
frames or retime it. Older simulator renditions can play only when their actual
frames and delays satisfy the active bounds. Stored renditions stay immutable.
A PNG/JPEG still uses a 500 ms transport placeholder; its duration policy alone
sets dwell. GIF delays, including a single-frame GIF, retain their effective
values. Browser previews and player deadlines are estimates.

In device mode, an operation failure with possible prior effects pauses the
player and preserves its error. It does not automatically reconnect, skip or
retry that operation. Inspect the outcome before choosing fresh intent. Resume
restarts the current item from its beginning. Simulator recovery keeps its
existing bounded retries.

## Bounded acceptance session

Agree on the explicit target, allowed content and brightness before the session.
Keep the target and receipts in private storage. Record the source revision,
runtime mode/profile, model and known firmware, or mark firmware unknown.

1. Start in device mode, confirm the active target and paused state, and inspect
   health without issuing a device request. Select Probe device once. Record the
   transport result separately from anything seen on the screen.
2. Import one allowed PNG/JPEG and one allowed two-frame GIF with 500 ms delays.
   Create a two-item playlist with repeat off and short explicit duration policies.
   Play it once. Observe upload/loading behavior, the visible content and whether
   advancing matches the estimated timing. Do not infer exact finite loops.
3. Exercise pause, explicit resume, next and stop once each while watching the
   display. Record whether stop leaves content and resume restarts the item.
   Use only the agreed brightness once. If screen controls are in the authorized
   scope, turn the screen off and then on once; confirm screen on does not resume.
4. Stop the backend and restart with the same settings. Confirm paused recovery
   without a new upload. Record any mismatch for the owning acceptance issue.

Stop immediately on an uncertain write, unexpected content, unacceptable loading
or conflicting writer. Do not automatically retry, broaden the profile or change
firmware/network settings. Resolve the finding and obtain any additional operation
scope before another attempt. Passing this bounded session does not complete
unexercised issue criteria; local Codex acceptance follows its own runbook.

## Return to the simulator and troubleshoot

Stop the backend, set `PIXOO_MODE=simulator`, and run `npm start` again with the
same private directory. In PowerShell set `$env:PIXOO_MODE = 'simulator'`.
The library and settings remain intact and saved playback restores paused.
`npm run simulator` builds then starts; it inherits the environment, so explicitly
set simulator mode when rolling back from a device session.

For startup errors, check mode, data directory, valid version-1 settings and the
smoke profile. For `busy`, stop the owning backend and wait for exit; do not delete
lock files to force ownership. For offline transport, verify the authorized target
and current network reachability without guessing alternate addresses. Saved
settings require restart to affect the active target. Health readiness confirms
the backend opened; it does not prove device reachability or visible output.

In a command environment that requires an HTTP proxy, enable Node's standard
proxy support with `NODE_USE_ENV_PROXY=1` or `--use-env-proxy` and use the host's
approved `HTTP_PROXY` settings. The device transport follows that configured
route. Set `NO_PROXY=127.0.0.1,localhost` when local API clients must reach the
backend inside the same environment. Adding the device to `NO_PROXY` requests a
direct connection and will fail if the environment has no direct LAN route.
Codex supplies proxy settings when its network proxy is active; its permission
profile must also allow the exact device IP. An allowed destination and a usable
connection route are both needed. Physical observations remain separate from a
successful probe.
