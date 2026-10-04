# Local startup and recovery

These commands use Node 24 and a local filesystem. They serve the production UI
and API through one native backend process. Simulator mode requires no device.
[Device startup](device-application.md) documents explicit physical activation
and separately authorized acceptance. No shared hub or hook installer is needed.
Authorized delivery includes routine upgrades of the established installation;
new service setup and changed host settings need their own scope. An optional
[Linux user service](#run-as-a-linux-user-service) keeps an installed backend
running across WSL restarts.

## Start and stop

Build once from the checkout root:

```bash
npm ci
npm run build
```

Choose a persistent directory outside every Git checkout. The backend runs on
Linux or WSL; native Windows is not supported
([ADR 0021](decisions/0021-linux-wsl-only-host.md)).

```bash
export PIXOO_DATA_DIR="$HOME/.local/share/pixoo-playlist-controller"
export PIXOO_PORT=8787
export PIXOO_MODE=simulator
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
there is no wall-clock catch-up or physical timing guarantee. A manual start
has no automatic restart; the optional user service below adds one. Use the
same directory on the next start to recover saved context paused.

Stop with Ctrl+C and wait for the process to exit before backup or moving data.
SIGINT/SIGTERM handling drains the player and in-flight adapter transport before
releasing ownership and closing the catalog. Shutdown sends no display restoration
command; last content may remain visible. Forced process termination is not
graceful shutdown.
Keep one backend per data directory. A `busy` error means another owner holds it;
stop that owner rather than deleting owner.sqlite or SQLite sidecars.

## Run as a Linux user service

A systemd user service starts the installed backend with the user manager,
restarts it after a failure and stops it with SIGTERM so the player drains. Use
it in WSL or Linux with systemd enabled. It replaces a manual launcher; do not
run both against the same data directory or device.

Creating or removing a service on a real host needs that named scope. Routine
upgrades use the owner's standing installation authority. Before new setup,
stop the manual backend, take an offline
[backup](#back-up-and-restore) and record the prior launcher privately.

### Install

Build the installed checkout with Node 24 (`npm ci` and `npm run build`). Keep
it separate from development worktrees so an upgrade is an explicit step.
Copy the templates from [examples/systemd](../examples/systemd):

```bash
mkdir -p ~/.config/systemd/user ~/.config/pixoo-playlist-controller
install -m 0600 examples/systemd/pixoo-playlist-controller.env ~/.config/pixoo-playlist-controller/service.env
install -m 0644 examples/systemd/pixoo-playlist-controller.service ~/.config/systemd/user/
```

Edit both copies. In the unit, replace `<absolute-node-24>` with the output of
`fnm exec --using=.nvmrc -- node -p process.execPath` and
`<absolute-installed-checkout>` with the checkout path. In `service.env`, set
`PIXOO_DATA_DIR` to the existing absolute private directory. EnvironmentFile
values are literal, so `$HOME` and `~` are not expanded.

The example selects the settings the shared hub needs:

| Variable | Example | Purpose |
| --- | --- | --- |
| `PIXOO_MODE` | `device` | Uses the private validated `device.json` target |
| `PIXOO_MONITOR_ENABLED` | `1` | Enables [agent monitoring](agent-monitoring.md) |
| `PIXOO_CONTROLLER_ENABLED` | `1` | Exposes the [hub controller API](hub-controller-api.md) |
| `PIXOO_CONTROLLER_DEVICE_ID`, `PIXOO_CONTROLLER_ID`, `PIXOO_CONTROLLER_SOURCE_ID` | `pixoo-local`, `pixoo-controller`, `pixoo` | Stable identity the hub registered |

Keep the identity identical to the current registration. Copy any other
variable the prior launcher exported, such as `PIXOO_MCP_ENABLED` or proxy
settings, into `service.env`. Then start it:

```bash
systemctl --user daemon-reload
systemctl --user enable --now pixoo-playlist-controller.service
systemctl --user status pixoo-playlist-controller.service
journalctl --user -u pixoo-playlist-controller.service -n 20
```

The log reports `Pixoo device listening on http://127.0.0.1:<port>`. Run the
[diagnostics](#diagnostics) with the same port. In device mode, a saved Monitor
selection restores monitor presentation at startup; see
[monitor operations](agent-monitoring.md#monitor-panel-and-display-ownership).

The unit's `WantedBy=default.target` starts the backend when the user manager
starts. Without linger that happens when the first WSL session opens, which is
how the existing Nanoleaf monitor service starts. `loginctl enable-linger` starts
the user manager with the distribution instead. That is a host setting to decide
during installation. After a full Windows reboot, WSL itself still has to start;
a Windows-side autostart is outside this setup.

`Restart=on-failure` restarts after a crash or failed startup, at most three
times in two minutes. A `busy` owner conflict, invalid settings or storage error
stops there; inspect the journal instead of deleting locks. `TimeoutStopSec=30`
leaves time for in-flight transport to settle before systemd forces an exit.

### Upgrade and roll back

Use the owning command from a reviewed checkout with Node 24.5 or later in the
24.x line. It builds the exact merged target in a clean detached checkout and
retains a complete compiled closure, including dependencies. It never edits the
shared Node installation or rebuilds the selected program in place. The shared
[install contract](https://github.com/jimmie-potts/agent-device-hub/blob/controller-contracts-v1.2.0/docs/install-contract.md)
defines receipt semantics; this procedure owns Pixoo's installation behavior.

Keep a mode-0600 JSON configuration outside Git. All paths are absolute,
canonical and owned by the installation user. `runtimeRoot`, `dataDirectory`
and `evidenceRoot` are private directories; runtime and data are outside Git on
the Linux filesystem. `sourceRoot` is a clean checkout of the trusted repository.
The external `node` is the unit's resolved Node executable; `npm` is its resolved
`npm-cli.js`. Use the existing unit, environment, data and credentials:

```json
{
  "schemaVersion": 1,
  "owner": "<named-installation-owner>",
  "runtimeRoot": "/absolute/pixoo-playlist-controller-runtime",
  "sourceRoot": "/absolute/clean-source",
  "unitFile": "/absolute/systemd/user/pixoo-playlist-controller.service",
  "environmentFile": "/absolute/service.env",
  "dataDirectory": "/absolute/private-data",
  "node": "/absolute/node-24/bin/node",
  "npm": "/absolute/node-24/lib/node_modules/npm/bin/npm-cli.js",
  "evidenceRoot": "/absolute/private-install-evidence",
  "controllerTokenFile": null,
  "controllerRegistration": null,
  "inactiveStartReason": null,
  "transitionReserveSeconds": 600
}
```

When the existing controller is enabled, bind `controllerTokenFile` to its existing
private read-capable bearer token file. Alternatively, set
`controllerRegistration` to `{"file":"/absolute/existing-host.json","id":"pixoo"}`
and leave `controllerTokenFile` null. This reads the existing Hub registration
without copying its token and requires the exact Pixoo kind, loopback endpoint,
device/controller identity and an enabled read principal. The plan binds the
registration file's digest. Do not provision a credential or alter settings to
make an upgrade pass. An inactive service blocks installation until
the existing stop and startup authority are understood. Record that qualified
handoff in `inactiveStartReason`; an empty reason cannot authorize startup.

Before a delivery, create and inspect an exact plan. Retain it for status checks
after success or interruption; read-only status validates the retained document
and owner configuration without requiring its old baseline to remain current.
An unresolved transition or unverified health reports inspection required and
does not remove its barrier. A later install or rollback requires a fresh plan.
The plan reads state and source history, and writes only the requested private
evidence file. It does not start the service or contact the display:

```bash
node apps/server/dist/runtime-cli.js plan <full-merged-sha> --config <config.json> --output <plan.json>
node apps/server/dist/runtime-cli.js status --config <config.json> --plan <plan.json>
node apps/server/dist/runtime-cli.js upgrade <full-merged-sha> --config <config.json> --plan <plan.json>
```

Review the plan's blockers, full commit comparison, configuration digests,
baseline inventory, service, startup effects and recovery sequence. Routine
authorized delivery proceeds after merge and successful main CI without another
approval request. Refresh a changed plan. A device-mode restart can restore the
saved Monitor display; physical observation remains separate acceptance.

Before outage, preparation compares the bounded durable implementation and runs
candidate-write/previous-reopen checks for library/media/playback, monitor state,
settings and credentials. It also reopens an isolated copy of the current data.
Unknown compatibility refuses before stop. This is deliberately narrower than a
promise to migrate arbitrary future formats automatically.

An exclusive operation lock and durable intent prevent concurrent switches and
blind replay. Admission temporarily removes search permission only from verified
Pixoo program roots. It retains inode, mode and inventory evidence, stops the one
named unit, waits for supported Node server/CLI entrypoints to exit and acquires
the existing library, monitor and device ownership locks. Permission-bypass
capabilities, foreign running copies, unknown unit effects or undrained writers
refuse. Supported installed entrypoints resolve through the selected closure;
historical copies and development launchers must not be used against live data.
Manual delivery uses the shared claim described in `AGENTS.md`.

Backup composes the existing verified library backup with all named monitor,
playback, settings and credential records, including the retained operator token.
The backup also retains exact external environment and original unit bytes in
owner-only files. Its manifest binds those hashes, the full state digest and
the library backup manifest; the operation receipt binds that manifest. First
adoption retains the original SHA-named tree, a complete hash-identified legacy
copy and original unit bytes before changing `current` and only the unit's
`ExecStart`. Unrelated history, environment values, settings and external Node
remain unchanged. Fully inventoried internal npm hardlinks are supported; an
alias outside the selected program refuses.

After the atomic selection, fresh PID/start-time/executable/listener evidence,
running build, served UI, health and enabled controller reads establish success.
The updater sends no extra device probe. Candidate failure can select only the
qualified previous code over the **latest** durable state; it never restores the
pre-upgrade database. For an explicit rollback:

```bash
node apps/server/dist/runtime-cli.js plan previous --rollback --config <config.json> --output <rollback-plan.json>
node apps/server/dist/runtime-cli.js rollback previous --config <config.json> --plan <rollback-plan.json>
```

A retained legacy target has unknown source revision and tree provenance. Its
rollback plan says so and provides no fabricated commit comparison; the trusted
source checkout's revision does not identify legacy program bytes.

`previous` is the preceding identity recorded by the latest successful operation;
an explicit retained full revision is also supported. Successful receipt
finalization precedes pruning of verified owned releases. Keep current plus
three prior successful releases; legacy copies, unresolved recovery targets,
backups, receipts and unrelated history are protected.

An interrupted adoption, failed recovery or uncertain final receipt retains
`records/active.json` and blocks another operation. Do not delete the barrier,
locks or old copies, or restore a stale backup to make the command pass. Preserve
the plan, original unit, fence record and receipt for qualified recovery. A
read-only status or reconciliation cannot clear an uncertain result.

The fixed supervisor bridge uses
`node apps/server/dist/runtime-cli.js adapter --config <config.json>`. It accepts
one strict JSON request on stdin with `schemaVersion: 1`, `operation: install`
or `reconcile`, repository, issue, exact merge, named owner, an epoch-seconds
deadline and a private evidence directory beneath `evidenceRoot`. It calls this
same native plan and upgrade path. Reconcile only inspects; it never switches,
retries, removes barriers or declares physical/client acceptance. Full semantic
receipts and fresh readback distinguish installed success, a known healthy
refusal/rollback, and unresolved state. Deadline reserve is checked before stop;
once admitted, the native recovery path runs to a recorded result rather than
being killed mid-switch. A host or storage stall can still leave uncertainty.

Delivery is complete only after the reviewed source is merged, main CI passes,
and the exact installation has a durable valid receipt plus healthy running
identity. An explicit source-only exception needs narrower user scope or an
accepted issue with a reason and linked installation obligation. Report the
remaining installed and physical acceptance separately.

### Stop or remove

`systemctl --user stop pixoo-playlist-controller.service` performs the same
graceful stop as Ctrl+C. To return to a manual launcher, disable the service:

```bash
systemctl --user disable --now pixoo-playlist-controller.service
rm ~/.config/systemd/user/pixoo-playlist-controller.service
systemctl --user daemon-reload
```

Keep `service.env` until the manual launcher is confirmed. Removal leaves the
data directory, device settings, credentials and shared hooks untouched.

## Diagnostics

### Running build

Settings shows the running backend's source revision, with a short value and a
copyable full value. `/api/health` and `/api/diagnostics` return the same
`build: {sourceRevision, version}`. Version `0.0.0` is informational.

`npm run build` stamps the full commit only when the source checkout is clean
at the same revision before and after the build. Dirty builds, unpacked sources
without qualified provenance, and missing or malformed metadata report
`sourceRevision: "unknown"`. Compiler-only commands invalidate any older stamp.
The process loads this metadata once at startup; rebuilding files on disk does
not change an already running process's identity. These reads contact no device.

Build identity is one input to the [owning upgrade procedure](#upgrade-and-roll-back).
It does not by itself prove that an archive was verified or an installation
succeeded. Consult current private receipts and live readback for installed state.

### Read diagnostics

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
Choose a private existing parent, then run:

```bash
npm run backup -- "$PIXOO_DATA_DIR" "$HOME/pixoo-backup-2026-09-06"
npm run restore -- "$HOME/pixoo-backup-2026-09-06" "$HOME/pixoo-restored-2026-09-06"
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
Do not add forwarding, firewall or router rules as a workaround. Native Windows
is not a supported fallback; leave the WSL networking problem to the host owner.
Never open the WSL data directory from Windows or share a live SQLite directory
between hosts.
Transfer only an offline verified bundle if moving data.

Phone/LAN access with authentication and HTTPS remains separate work. Docker,
ARM64 and Raspberry Pi deployment are unverified. Ubuntu automated source checks
and emulated phone viewports do not establish those deployment claims.
