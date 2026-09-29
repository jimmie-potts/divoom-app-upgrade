# Development setup

## Local checkout and worktrees

Use Node 24.5 or later in the 24.x line with npm. With nvm, `nvm install` and
`nvm use` read .nvmrc. In noninteractive or agent shells, where nvm's shell
setup is usually not loaded, prefix each command with
`fnm exec --using=.nvmrc --` instead, for example
`fnm exec --using=.nvmrc -- npm ci`; it reads .nvmrc from the worktree root and
needs no shell setup. Reuse one shared Node 24 installation instead of
installing Node for each task. If neither fnm nor an active Node 24.5 or later
is available, report the missing prerequisite. Node 24.5 adds the HTTP proxy
support used by device requests in environments that require it. From each fresh
assigned worktree root:

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run simulator
```

On Linux, Playwright may require browser system dependencies; hosted CI uses
`npx playwright install --with-deps chromium`. Develop on Linux or WSL; native
Windows is not supported ([ADR 0021](decisions/0021-linux-wsl-only-host.md)).
Use npm's default cache and Playwright's default browser cache, `~/.npm` and
`~/.cache/ms-playwright`, not directories under `/tmp`, which can be a small
RAM-backed filesystem shared by every session. If a sandbox makes either cache
read-only, report that instead of redirecting it.

| Command | Evidence |
| --- | --- |
| `npm run lint` | ESLint checks app, test, and workflow source |
| `npm run typecheck` | TypeScript checks all packages, tests and tool configs |
| `npm run build` | Compiles workspace ESM/declarations and Vite production assets |
| `npm test` | Builds then runs isolated Vitest configuration, API, static and process checks |
| `npm run test:browser` | Builds then tests the actual page and error/retry at desktop/mobile sizes |
| `npm run check:workflow` | Validates current specs/changes and archived tasks |
| `npm run test:workflow` | Exercises workflow CLI safeguards in temporary fixtures |
| `npm run check` | Lint, typecheck, build/tests and both workflow checks |
| `npm run simulator` | Builds then starts one loopback backend and UI |
| `npm start` | Starts a previously built application |

GitHub Actions requires Workflow checks, Application checks and Simulator
browser checks, all on Ubuntu. The application
job includes a production build through `npm test`. Browser artifacts are
ignored under test-results. Emulated phone sizes are not actual LAN verification.

Use the root as the Codex project and worktree starting directory. AGENTS.md is
the entrypoint. Claude Code reads CLAUDE.md, which imports @AGENTS.md, so both
hosts follow the same rules. Optional local actions can use the check, browser and simulator
commands after their prerequisites. Preserve host-managed .agents/.codex, model,
permission, trust and hook settings. The shell examples are optional environment
assignments, not configuration files loaded by the app.

## Shared skills

Reusable methods belong to [agent-skills](https://github.com/jimmie-potts/agent-skills).
The guide checkpoints use reviewed catalog revision
`ff80d247ea96a5d4c461d30a2c24148376197c7b`. Use a separate checkout at that
revision for new provisioning and retain it while installed links use it.
The local setup checkout is ignored at `.local/agent-skills` in the canonical
repository, outside the tracked source and outside disposable worktrees.
Do not clean that directory while installed skills depend on it.

Required methods are plan-work, deliver-work, grill-with-docs, grilling, tdd, code-review,
domain-modeling, writing-for-agents, unslop, and the OpenSpec integrations:
openspec-propose, openspec-explore, openspec-apply-change, openspec-update-change,
openspec-sync-specs, openspec-archive-change. Existing central skills are preserved.
A fresh host must inspect its catalog and, when authorized, install missing
methods through the catalog manager without replacing conflicts. WSL links do not
prove native Windows or cloud discovery; provision each host through its supported skill root.

Check the installed methods before provisioning. When installation is authorized,
run the manager from the separate catalog checkout in a writable host session:

```bash
./scripts/manage-skills.sh install --agent codex plan-work deliver-work openspec-propose openspec-explore openspec-apply-change openspec-update-change openspec-sync-specs openspec-archive-change
./scripts/manage-skills.sh status --agent codex
```

The manager preserves conflicts. Do not use `--all` on an existing installation.
Use its `CODEX_SKILLS_DIR` option only for the actual skill directory of the target
host. Restart Codex if its skill catalog needs refresh and verify loaded source
paths in a new task. A link created from WSL must not be assumed readable by a
native Windows process. Do not generate repository-local copies as a fallback.

The earlier setup at `139ba8567a8b74d188850f83bff6d4687610c786` verified
installation of seven then-missing delivery/OpenSpec skills after
the user ran the manager from a writable WSL session. All seven were discovered
in that Codex setup and linked to its pinned isolated catalog; this is historical
evidence, not verification of the current planning/delivery skills. Other required
skills remained in the original catalog. The manager calls those links foreign because they
point at a different checkout; that is not a broken-link diagnosis. Keep both
catalog checkouts available. Setup issue #1 is closed.

## OpenSpec

Use `npm run openspec -- <arguments>` rather than a global CLI. OpenSpec 1.12.0
and its lockfile are repository-local. The installed package declares an MIT license.
Foundation dependencies and licenses are recorded in dependencies.md; media dependencies are pinned there; the library uses Node 24 bundled SQLite. The wrapper preserves the caller's cwd,
disables telemetry and prompts, and isolates the child configuration and Codex
home in a temporary directory removed after execution. This avoids CLI migration
changing personal settings or legacy prompts.

Initialize only specification storage:

```bash
npm run openspec -- init --tools none --profile core --no-animation
```

The synchronized specification inventory includes application-foundation, controller-api, controller-ui, device-adapter, device-http-spike, library-persistence, local-mcp-controls, local-operations, mcp-media-playback, media-rendering, playlist-playback and shared-monitor-contract.
Shared integrations remain central. `check:workflow` runs strict noninteractive validation for both
current inventory and archived tasks, even if the first fails. These syntax and
task-marker checks do not replace artifact completeness, acceptance tests, or
independent review. `test:workflow` exercises empty/valid/invalid inventories,
incomplete archives, CLI errors, and preservation of personal configuration.

## Runtime and scope

Read README.md for environment defaults and startup. Paths are resolved relative
to compiled module locations, so `npm start` does not rely on the shell cwd for
web assets. Data directory errors or missing build output fail before listening.
The process handles SIGINT/SIGTERM and preserves external files at shutdown.

The library package supplies [SQLite persistence](library-persistence.md) for
media, playlists and session retention. Startup opens the private library and [player](playback.md), restoring saved context paused. The [HTTP API](api.md) integrates both; LAN mode remains future work. The media package supplies
[bounded decoding, immutable frames and previews](media-rendering.md). The device package
provides the [fake adapter](device-adapter.md) with deterministic frame, timing,
failure and cancellation tests. The independently written [HTTP spike](protocol-spike.md) uses Node HTTP and
separate opt-in commands. Application startup defaults to simulator mode; explicit
validated device composition is documented in [device operations](device-application.md). The API admits bounded multipart uploads to the library. Read the handoff and exact issue before extending them.
Do not claim physical behavior from the readiness API or simulator page.

[Local operations](local-operations.md) documents the built backup, restore and
diagnostics commands. Run application checks and browser checks sequentially in
one worktree because both rebuild the production web assets.

## Simulator verification runs

`npm run verify -- <operation>` starts a disposable copy of this application,
drives it, keeps proof and leaves a preview under a lease, for an agent or the
owner. The shared core `@jimmie-potts/app-verify` is vendored from the Hub. It
implements the operations, receipt, supervisor unit, lease, proof directories
and capture harness of the Hub's
[app verification contract](https://github.com/jimmie-potts/agent-device-hub/blob/main/docs/app-verification.md).
`scripts/verify/` supplies only the Pixoo plug-in. The vendored release and
its pins are described in [dependencies](dependencies.md#shared-verification-core).

Runs need Linux with a `systemd --user` manager and Node 24.5 or later in the
24.x line. The wrapper exits with status 3 under any other Node. `capture` also
needs Chromium from `npx playwright install chromium`. From the worktree root:

```bash
fnm exec --using=.nvmrc -- npm run verify -- help
fnm exec --using=.nvmrc -- npm run verify -- start
fnm exec --using=.nvmrc -- npm run verify -- capture <run-id> playlist-progression
fnm exec --using=.nvmrc -- npm run verify -- handoff <run-id> --reset library-playlist
fnm exec --using=.nvmrc -- npm run verify -- stop <run-id>
```

Proof goes to the canonical checkout's `.local/evidence/verify/<run-id>/` and
runtime state to `~/.local/state/app-verify/<run-id>/`. `stop` removes only
the runtime state.

Each run:

- builds with `npm run build` on `start` and `restart`, then serves this
  checkout's build. `help`, `doctor` and `stop` need no build.
- shares the served build with every other run from the same checkout. A
  later build there, including another run's `start`, replaces what a running
  preview serves. `doctor` reports the served page's digest as `changed`;
  `capture` does not check it, so run `doctor` before citing captures from a
  checkout that was rebuilt, and use `restart` for a new candidate.
- launches `apps/server/dist/main.js` on `127.0.0.1:0` with
  `PIXOO_MODE=simulator`, monitoring enabled and a private `PIXOO_DATA_DIR`
  under `~/.local/state/app-verify/<run-id>/data`. Inherited Pixoo settings
  never decide the mode, data directory or port, and the guard removes any
  other inherited `PIXOO_*` setting, such as MCP or controller flags, before
  the server reads its configuration. Only a `hub-paired` launch enables the
  native controller API, as described under [Hub-paired runs](#hub-paired-runs).
  `NODE_OPTIONS` is emptied, so no inherited preload runs before the guard.
- preloads `scripts/verify/transport-guard.ts`. It refuses to start the server
  unless the simulator is selected. Through the public Node.js APIs it blocks
  and records every outbound HTTP request, UDP socket and Unix socket
  connection, every TCP connection except to the run's own port (and, in
  `hub-paired`, the declared Hub port on `127.0.0.1`), and every
  other process start (`spawn`, `exec`, `execFile` and their Sync forms,
  `ChildProcess#spawn` and `process.execve`). Installed services such as the
  Hub on 8788 are refused like a device. A fork of Node, such as the media
  worker, and every file-based worker thread run under the same guard, even
  when their caller replaces `execArgv` or `env`; a fork of another program
  and an eval worker are refused. The guard observes and refuses public API
  use by the app and its dependencies. It is not a sandbox against
  deliberately hostile code already running in the server process, such as
  values with a side-effecting `toString`, internal bindings
  (`process.binding`) or native addons. `start` and every reseed run the
  `simulator-mode`, `no-physical-transport` and `hub-feed` checks, and
  `doctor` repeats them. Every capture step ends by asserting that the run has
  recorded no attempt. A failed start names known causes, such as
  `pixoo-transport-guard: simulator mode required` or
  `pixoo-start-failed: port in use`, without copying server output.
- rejects a data directory inside a Git checkout, one reached through a
  symlink alias, or one that overlaps the owner's normal data and lock
  directories or an inherited `PIXOO_DATA_DIR`. It seeds only an empty
  directory.

Simulator pixels are the desired 64×64 content. They never establish what a
physical display shows, and saved results are labelled as simulator rendering.

### Feature map

The default scenario `library-playlist` seeds `verify-quadrants.png`,
`verify-blink.gif` (two frames, 500 ms each) and `verify-stripes.png`, the
playlist "Verification loop" in that order, and one synthetic agent session,
"Synthetic verification task" in project VERIFY-PIXOO. The `empty` scenario
seeds no media, playlists or sessions. The `hub-paired` scenario seeds the
same media and playlist, reads its sessions from a paired Hub run and seeds
none of its own; see [Hub-paired runs](#hub-paired-runs).

| Feature | Entry | Capture step | Deterministic action | Expected observation |
| --- | --- | --- | --- | --- |
| Library | Library tab | `library-selection` | Select each synthetic medium | Its heading, `64 × 64 · N frames` and preview pixels equal to the fixture; saves `library-quadrants` |
| Playlist | Playlists, then Player | `playlist-progression` | Open the playlist, then Play playlist, Next, Next, Previous | A new session shows items 1, 2, 3 and 2 with their exact first frames, and the server is on item 2; saves `player-item-2` |
| Playback | Player | `playback-controls` | Play playlist, Pause, Resume, Stop, reload | Intent paused, active, then stopped on item 1; the stopped session survives the reload |
| 64×64 rendering | Library and Player previews, Monitor canvas | `library-selection`, `playlist-progression`, `monitor-media` | Read the 64×64 pixels the page draws | Fixture pixels, or the server's exact monitor picture; a PNG, an 8× copy and a simulator label |
| Monitor/Media | Monitor tab | `monitor-media` | Play playlist, Show monitor, Select Media, then Resume in Player | Monitor active with playback paused and the canvas equal to the server picture; Media leaves playback paused; Resume continues item 1 in Media; saves `monitor` |
| Recovery | Player | `lost-response-recovery` | Drop the Next response after the server applied it, then Retry command | Uncertain notice; the retry reuses the request identity; item 2 once with the generation unchanged |
| Device boundary | Settings | `device-boundary` | Probe simulator | Simulator labels; health and device settings report the simulator; no transport attempt |
| Hub pairing | Monitor tab, controller API | `hub-sessions` | In `hub-paired`, compare the feeds, open Monitor, read the controller snapshots with the Hub's token, send one `brightness.set` and replay it, then try the feed token and a random one | A current feed from `verify-owner` at the Hub's revision; every Hub session and project listed; the canvas equal to the server picture; the default controller identity, and 401 without the token; the command reaches the writer once and its replay returns the same receipt; other tokens get 401 and reach no writer; only the run's port and the Hub port reached; saves `hub-monitor` |

Each negative control runs a step with a known-wrong behavior injected between
the page and the server, and must report failed:

| Control | Wrong behavior | Detected by |
| --- | --- | --- |
| `control-wrong-frame` | Every rendition frame is served as the stripes fixture | `library-selection` preview pixels |
| `control-duplicate-next` | Every Next is applied twice under a fresh identity | `playlist-progression` item 2 |
| `control-select-media-resumes` | Select Media also resumes playback | `monitor-media` paused check |
| `control-hub-feed-stale` | The page's monitor view reports the Hub feed stale and drops its sessions | `hub-sessions` Monitor list |
| `control-retry-new-identity` | A retried Next is resent under a fresh identity | `lost-response-recovery` single effect |

Steps that change state, and every control, are marked `fresh`: the core
reseeds and relaunches the run on its port before driving them. For proof a
delivery cites, capture only the reference steps before `handoff`; the Hub's
delivery preflight rejects a verified set holding a capture that did not
pass. Run the controls after `handoff`, where they land in `after-handoff/`
and still report failed.

`npm run test:browser` runs every step and control through the core's
unsupervised `runCaptureStep` against the actual server, the `hub-paired`
ones against a stand-in Hub feed. `npm test` covers the launch environment,
data directory guard, transport guard, concurrent runs and reseeding, and
runs a paired server against the stand-in feed with this test as the Hub's
controller caller. Neither needs `systemd --user`. The supervisor, lease,
handoff and restart are tested in the core's own suite. Adapter changes that
affect them need a local run against real units, recorded in the PR.

### Hub-paired runs

The Hub's integrated preview
([Hub #495](https://github.com/jimmie-potts/agent-device-hub/issues/495))
pairs one Pixoo run with one Hub run. The Hub is the only agent-state owner:
Pixoo reads its session feed as a remote consumer, and the Hub calls Pixoo's
controller API. The Hub orchestrator drives this sequence:

1. Start Pixoo standalone, then start the Hub run.
2. Write two files into Pixoo's run directory (the receipt's
   `owned.runtimeDir`, `~/.local/state/app-verify/<run-id>/` by default). Each
   holds one 43-character base64url token with no newline, mode 0600:
   - `hub-feed-token`: what Pixoo presents to the Hub's session feed. The Hub
     grants it read and control scopes.
   - `hub-controller-token`: what the Hub presents to Pixoo's controller API.
3. Reseed Pixoo with
   `npm run verify -- scenario <run-id> hub-paired --input hub-feed=http://127.0.0.1:<hub-port>/`.
4. Reseed the Hub `integrated`. Its Pixoo controller points at
   `<controller>controller/v1`, where `<controller>` is the endpoint that
   Pixoo's reseed returned.

A later reseed of the Hub, such as a `fresh` Hub step or `handoff --reset`,
restarts its owner's revisions below those Pixoo has applied. Pixoo refuses a
revision regression and stays stale, so reseed Pixoo `hub-paired` again after
any Hub reseed; the token files can stay.

`hub-feed` is the only input, optional for the plug-in and required by
`hub-paired`. It must be exactly `http://127.0.0.1:<port>/`, on a port that
is neither an installed service's nor the run's own. Tokens are never inputs.
They never appear in a receipt, event, log line or failure detail, and a
missing, readable-by-others or malformed token file fails the seed with a
fixed line that names only the file. `stop` deletes both files with the run
directory. The files exist only after `start`, so `hub-paired` cannot be a
run's first seed, and `restart` of a paired run stops it and then fails at
seed. Stop it instead, start a new standalone run, write the files and reseed.

The `hub-paired` seed:

- writes the existing remote monitor configuration: owner `verify-owner`,
  endpoint `<hub-feed>api/monitor/v1` and the feed token, mode 0600. Pixoo
  polls `GET /api/monitor/v1/sessions?snapshotVersion=1.2` and refuses a
  feed from any other owner. Acknowledgments use consumer `pixoo`.
- registers the controller token as principal `hub` with read and control
  scopes. The backend's credential store keeps only its SHA-256 digest.
- seeds no local sessions and starts no embedded owner.

The `hub-paired` launch adds `PIXOO_CONTROLLER_ENABLED=1` and
`APP_VERIFY_PAIRED_PORTS=<hub-port>`. Every other launch sets
`APP_VERIFY_PAIRED_PORTS` empty. The guard keeps `PIXOO_CONTROLLER_ENABLED`
only in a paired launch, so an inherited value never pairs a run or enables
the controller. The guard still removes the inherited identity settings, so
the controller keeps its defaults: controller `pixoo-controller`, device
`pixoo-local`, source `pixoo`.

The controller serves `/controller/v1` and `/controller/pixoo-integration/v1`
on the run's main origin. From the `hub-paired` launch on, the ready line
announces that origin as endpoint `controller`. The core holds a recorded
endpoint to its port, so every later reseed announces it again. Only a paired
launch serves the controller routes; after a reseed to a standalone scenario
they answer 404.

Checks:

- `no-physical-transport` still fails on any blocked attempt. It accepts a
  connection to a port other than the run's own only when it went to
  `127.0.0.1` and the connecting process's own launch declared that Hub port;
  the guard refuses the Hub port on any other loopback name or address. The process serving the run
  must be paired with exactly the `hub-feed` port in `hub-paired`, and with
  no port in any other scenario. The log spans the run, so feed reads from an
  earlier paired launch stay accepted after a reseed to a standalone scenario.
- `hub-feed` reads Pixoo's `GET /api/integration/v1/sessions`, which first
  refreshes from the Hub, and then the Hub's feed with the feed token. It
  passes when Pixoo's feed is current, from `verify-owner`, at the revision
  the Hub serves. Every other result names what it saw:
  - `skipped` while this launch has had no current feed and the Hub refuses
    the token (401 or 403) or cannot be reached (connection refused or
    reset), for up to 60 seconds after the launch. The reseed before the Hub
    is configured therefore succeeds. After that grace period the same
    result fails.
  - `failed` when the Hub serves a feed that Pixoo does not apply: another
    owner, a feed Pixoo refuses, or an error status.
  - `failed` when a current feed turns stale, naming a Hub whose revisions
    restarted below Pixoo's, and when Pixoo and the Hub do not settle on one
    revision within a few reads.
  - `skipped` in every other scenario.

The orchestrator reads Pixoo's state over loopback. Neither route returns a
token:

- `GET /api/integration/v1/sessions` returns `ownerId`, `connection`
  (`current`, `stale` or `unavailable`) and `snapshot.revision`, the revision
  last applied. The read refreshes from the Hub first.
- `GET /api/device/simulator` returns
  `{mode: "simulator", writer: {probe, uploadAnimation, setBrightness, setScreen}}`.
  Each kind reports `{admitted, succeeded}` counts of the operations that
  reached the simulator's serialized writer since startup. A controller
  `brightness.set` adds one `setBrightness`; replaying the same request adds
  none.

Source tests pair a run with `tests/helpers/stand-in-hub.ts`, the real
agent-state owner behind a stand-in Hub feed, and act as the Hub's controller
caller with one representative command, `brightness.set`. Hub #495 owns the
integrated evidence with the real Hub. Other media and playback commands from
the Hub, moments and interludes
([#92](https://github.com/jimmie-potts/divoom-app-upgrade/issues/92)), and
restarting one consumer while paired are not covered.

### Aggregate reset pause

An explicitly launched disposable `hub-paired` simulator can pause requests to its Hub owner while the owner resets. The verification preload supplies this control to the remote session source; ordinary startup ignores inherited pause variables. The existing private runtime directory holds `feed-pause.request` and `feed-pause.release`, each containing exactly `{version:1,runId,nonce}`. The nonce is 32 lowercase hexadecimal characters. Controls must be owned, private regular files of at most 4 KiB, with no links.

The source stops admitting both feed reads and forwarded commands, then waits for active response bodies to drain before atomically writing mode-0600 `feed-pause.ack` with the request fields and its positive integer `pid`. Timer, browser and command requests use that same admission check. Pages, health and inbound controller work remain available. The pause gates outbound Pixoo-to-Hub requests. Retained monitor state becomes stale when refresh is paused. Invalid requests block admission and withdraw an existing acknowledgment. Removing the request resumes the same process without replaying commands; a release file alone does not resume it.

After the Hub owner is ready, the coordinator writes a matching release and reseeds `hub-paired`. The core stops the old process before seed. Seed refuses an outstanding pause without matching authorization, or a change to another scenario. After fresh state succeeds, seed atomically claims and validates the matching controls, then deletes only the claimed files. A concurrent newer request stays in place; a changed claim is restored without overwriting another control. The replacement can accept the owner's lower new revision. Successful reseeding preserves token files and recorded ports. Seed refuses missing or changed authorization without resuming polling. The core cleans the runtime of an already stopped failed run, including retained private claims; the run remains stoppable and frozen proof stays unchanged.

The `hub-feed` diagnostic skips a valid pause and fails an invalid request or release before probing the Hub. A release must match the current request. Avoid concurrent individual `doctor`, capture or scenario commands during aggregate pause: the coordinator serializes aggregate mutations, and an already active independent diagnostic is outside the serving process's drain acknowledgment. Require a passed current-feed check after release. The paired seed does not configure playback polling. Installed Pixoo and physical devices are outside this protocol.

`npm run check` covers held reads, malformed controls, release refusal, lower revision recovery and ordinary-launch isolation with plain child processes. On the Linux owner host, run `APP_VERIFY_REQUIRE_SYSTEMD=1 fnm exec --using=.nvmrc -- npx vitest run tests/integration/verify-host-lifecycle.test.ts`. This opt-in test uses unique app, state and proof roots, captures real browser proof, checks the old unit is stopped inside the seed callback, and verifies unchanged frozen bytes after reset and failed release. It stops its run and removes its private test roots. Normal CI skips this host test; a skipped result is not systemd qualification.

## Shared lifecycle contract conformance

`npm test` and `npm run check` run the released lifecycle package consumer test
in the existing Application checks CI job. It checks the committed
archive/source receipt and installed manifest, then runs the original upstream
validation/deduplication corpus. No provider session or device is invoked.
This check establishes source contract compatibility only.

## Shared controller compatibility

`npm run test:controller` builds the application and runs the released contract
fixtures and fake-backed native controller compatibility suite. It is suitable
for hub CI after a Node 24 `npm ci`; it needs no device or installed credential.
The full `npm run check` includes the same tests. See [native API](hub-controller-api.md).
