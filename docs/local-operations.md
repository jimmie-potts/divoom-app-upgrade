# Local startup and recovery

These commands use Node 24 and a local filesystem. They serve the production UI
and API through one native backend process. Simulator mode requires no device.
[Device startup](device-application.md) documents explicit physical activation
and separately authorized acceptance. No shared hub or hook installer is needed. Source delivery does not install a service or change
host settings.

## Start and stop

Build once from the checkout root:

```bash
npm ci
npm run build
```

Choose a persistent directory outside every Git checkout. For Linux/WSL:

```bash
export PIXOO_DATA_DIR="$HOME/.local/share/pixoo-playlist-controller"
export PIXOO_PORT=8787
export PIXOO_MODE=simulator
npm start
```

For a native Windows Node 24 PowerShell session:

```powershell
$env:PIXOO_DATA_DIR = Join-Path $env:LOCALAPPDATA 'PixooPlaylistController'
$env:PIXOO_PORT = '8787'
$env:PIXOO_MODE = 'simulator'
npm start
```

Open the printed loopback URL. `npm run simulator` builds and starts the same
process. `npm start` works after a build; it does not rebuild stale output.
Environment variables select the directory, port and mode. Saved `device.json`
settings remain private and do not enable hardware by themselves. Device mode
requires explicit startup selection and a valid immutable settings snapshot.
`npm run simulator` inherits the selected environment; set simulator mode explicitly
when returning from a device session.

Keep the terminal, backend process and host awake while playing. Closing a browser
page leaves playback running. Closing the terminal, ending the WSL instance,
logging out or rebooting can stop the process. Sleep suspends host scheduling;
there is no wall-clock catch-up or physical timing guarantee. No automatic login
startup or restart service is installed. Use the same directory on the next
manual start to recover saved context paused.

Stop with Ctrl+C and wait for the process to exit before backup or moving data.
SIGINT/SIGTERM handling drains the player and in-flight adapter transport before
releasing ownership and closing the catalog. Shutdown sends no display restoration
command; last content may remain visible. On Windows,
use Ctrl+C in its console; forced process termination is not graceful shutdown.
Keep one backend per data directory. A `busy` error means another owner holds it;
stop that owner rather than deleting owner.sqlite or SQLite sidecars.

## Diagnostics

With the backend running and the same PIXOO_PORT in the current shell:

```bash
npm run diagnostics
curl --fail http://127.0.0.1:8787/api/health
curl --fail http://127.0.0.1:8787/api/diagnostics
```

PowerShell can use `Invoke-RestMethod http://127.0.0.1:8787/api/diagnostics`.
For a dynamically chosen port, use the printed port for both the command and URL.
Diagnostics have a five-second CLI deadline. A nonzero exit means configuration,
reachability or response validation failed; the CLI never prints an unexpected
server response.

Health reports server readiness, selected mode and device connectivity. Simulator
connectivity is always false. Device connectivity starts null and changes only
with observed transport availability. Health and diagnostic reads issue no probes.
Diagnostics add uptime, library readiness and player state/intent. Simulator
`available` means the fake accepted an operation. Device transport success does
not establish visible output.
These responses exclude private paths, device IPs, media names and raw errors.
Readiness confirms successful opening, not a full disk integrity scan. Offline
backup and restore perform that verification.

Check startup output for missing build assets, invalid mode/port, unwritable data,
occupied port, owner conflicts or incompatible storage. Preserve data after a
migration or corruption error. Do not delete the catalog to make startup pass.

## Bounded transient data

The backend admits at most 32 HTTP requests, including at most 16 event clients.
It retains 32 state events and 256 completed command receipts. Playback holds at
most two rendered animations. Default media rendering admits one active job and
four queued jobs, with a 10 MiB upload limit and 30-second job deadline. See
[media bounds](media-rendering.md) and [API bounds](api.md).

Fastify request logging and fake-device history are disabled. Startup emits one
address line; shutdown errors are reported to the console. No routine per-request
or playback disk logs accumulate. If an operator redirects console output, that
external log needs their own rotation policy.

Originals, renditions, playlists and saved context are durable user data, not an
automatically evicted disk cache. Library deletion respects references; interrupted
renderer staging is recovered on open. Capacity grows with imported media and
retained renditions. Monitor free disk space and remove unused assets through the
library UI. Do not delete referenced files by hand.

## Back up and restore

Stop the backend first. Commands take explicit absolute paths and never default
to your personal data. The destination must not exist, its parent must exist, and
source/destination must not contain each other. All paths must be outside Git.
For Linux/WSL, choose a private existing parent, then run:

```bash
npm run backup -- "$PIXOO_DATA_DIR" "$HOME/pixoo-backup-2026-09-06"
npm run restore -- "$HOME/pixoo-backup-2026-09-06" "$HOME/pixoo-restored-2026-09-06"
```

PowerShell uses the same commands with Windows absolute paths:

```powershell
npm run backup -- $env:PIXOO_DATA_DIR (Join-Path $env:USERPROFILE 'pixoo-backup-2026-09-06')
npm run restore -- (Join-Path $env:USERPROFILE 'pixoo-backup-2026-09-06') (Join-Path $env:USERPROFILE 'pixoo-restored-2026-09-06')
```

Choose a new name for each run. Backup acquires the existing catalog owner lock,
performs ordinary migration/staging recovery, verifies integrity and references,
and takes a SQLite-consistent snapshot including committed WAL content. It copies
cataloged originals, every cataloged rendition, playlists, retained sessions,
checkpoint and optional validated device.json together. Unrelated files, locks,
staging, logs and unregistered orphan media are excluded and remain in the source.

A bundle contains manifest.json, a `.pixoo-backup` marker, library/catalog.sqlite,
library/media and optional device.json. Its versioned inventory records byte sizes
and SHA-256 hashes. Keep it private: it contains media, playlist names and possibly
device details. It is not encrypted or authenticated. Hashes detect damage, not
an attacker who replaces both the manifest and files. Restore only trusted backups.

Restore verifies the inventory and hashes, then opens and checks a new copy of the
catalog and its media relationships. It never opens the source bundle as a mutable
library. Existing destinations, even empty ones, are rejected. Bundles are bounded
at 100,000 files, 512 MiB per file, 20 GiB total and 32 MiB of manifest JSON. Large
libraries beyond those limits require future tooling rather than a partial backup.

Output carries `.pixoo-incomplete` until verification succeeds. Failures or power
loss can leave that directory behind. Startup refuses incomplete output and backup
bundles. Preserve failed output for inspection, or remove only that failed output
manually and retry with a new destination. Never remove a marker to force startup.
Keep source and output quiescent during these offline commands. A completed command
is not a guarantee against storage hardware failure; verify a restore periodically.

After a successful restore, set PIXOO_DATA_DIR to the new directory and `npm start`.
Inspect the library and paused session before resuming. Keep the original directory
until satisfied. To roll back, stop the backend and select the original directory.
No restore command replaces the old data or starts playback.

## Windows and WSL reachability

The listener is IPv4 loopback only. First run health/diagnostics inside the same
WSL distribution as the backend. If that fails, inspect the process and printed
port before testing Windows networking.

If WSL succeeds, try the same `http://127.0.0.1:<port>` URL from the Windows
browser and PowerShell. Read-only checks can help distinguish routing and port use:

```powershell
wsl --list --verbose
Test-NetConnection 127.0.0.1 -Port 8787
Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
```

In WSL, `ss -ltn 'sport = :8787'` shows listeners. A failed Windows connection when
WSL succeeds is a host/WSL reachability problem, not device unavailability. Check
which process owns the port and whether the intended WSL instance is running.
Do not add forwarding, firewall or router rules as a workaround. If Windows cannot
reach WSL loopback, use the native Windows Node 24 build and a separate Windows
local data directory. Do not share a live SQLite directory between Windows and WSL.
Transfer only an offline verified bundle if moving data.

Phone/LAN access with authentication and HTTPS remains separate work. Docker,
ARM64 and Raspberry Pi deployment are unverified. Ubuntu/Windows automated source
checks and emulated phone viewports do not establish those deployment claims.
