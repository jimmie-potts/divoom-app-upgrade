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
  checkout's build. A later build in the same checkout, including another
  run's `start`, replaces what a running preview serves. `doctor` reports the
  served page's digest as `changed`; use `restart` for a new candidate.
- launches `apps/server/dist/main.js` on `127.0.0.1:0` with
  `PIXOO_MODE=simulator`, monitoring enabled and a private `PIXOO_DATA_DIR`
  under `~/.local/state/app-verify/<run-id>/data`. Inherited Pixoo settings
  never decide the mode, data directory or port.
- preloads `scripts/verify/transport-guard.ts`. It refuses to start the server
  unless the simulator is selected. It blocks and records every outbound HTTP
  request, UDP socket and Unix socket connection, and every TCP connection
  except to the run's own port, so installed services such as the Hub on 8788
  are refused like a device. `start` runs the
  `simulator-mode` and `no-physical-transport` checks and `doctor` repeats
  them. Every capture step ends by asserting that the run has recorded no
  attempt. A failed start names known causes, such as
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
seeds no media, playlists or sessions.

| Feature | Entry | Capture step | Deterministic action | Expected observation |
| --- | --- | --- | --- | --- |
| Library | Library tab | `library-selection` | Select each synthetic medium | Its heading, `64 × 64 · N frames` and preview pixels equal to the fixture; saves `library-quadrants` |
| Playlist | Playlists, then Player | `playlist-progression` | Open the playlist, then Play playlist, Next, Next, Previous | A new session shows items 1, 2, 3 and 2 with their exact first frames, and the server is on item 2; saves `player-item-2` |
| Playback | Player | `playback-controls` | Play playlist, Pause, Resume, Stop, reload | Intent paused, active, then stopped on item 1; the stopped session survives the reload |
| 64×64 rendering | Library and Player previews, Monitor canvas | `library-selection`, `playlist-progression`, `monitor-media` | Read the 64×64 pixels the page draws | Fixture pixels, or the server's exact monitor picture; a PNG, an 8× copy and a simulator label |
| Monitor/Media | Monitor tab | `monitor-media` | Play playlist, Show monitor, Select Media, then Resume in Player | Monitor active with playback paused and the canvas equal to the server picture; Media leaves playback paused; Resume continues item 1 in Media; saves `monitor` |
| Recovery | Player | `lost-response-recovery` | Drop the Next response after the server applied it, then Retry command | Uncertain notice; the retry reuses the request identity; item 2 once with the generation unchanged |
| Device boundary | Settings | `device-boundary` | Probe simulator | Simulator labels; health and device settings report the simulator; no transport attempt |

Each negative control runs a step with a known-wrong behavior injected between
the page and the server, and must report failed:

| Control | Wrong behavior | Detected by |
| --- | --- | --- |
| `control-wrong-frame` | Every rendition frame is served as the stripes fixture | `library-selection` preview pixels |
| `control-duplicate-next` | Every Next is applied twice under a fresh identity | `playlist-progression` item 2 |
| `control-select-media-resumes` | Select Media also resumes playback | `monitor-media` paused check |
| `control-retry-new-identity` | A retried Next is resent under a fresh identity | `lost-response-recovery` single effect |

Steps that change state, and every control, are marked `fresh`: the core
reseeds and relaunches the run on its port before driving them. For proof a
delivery cites, capture only the reference steps before `handoff`; the Hub's
delivery preflight rejects a verified set holding a capture that did not
pass. Run the controls after `handoff`, where they land in `after-handoff/`
and still report failed.

`npm run test:browser` runs every step and control through the core's
unsupervised `runCaptureStep` against the actual server. `npm test` covers the
launch environment, data directory guard, transport guard, concurrent runs
and reseeding. Neither needs `systemd --user`. The supervisor, lease, handoff
and restart are tested in the core's own suite. Adapter changes that affect
them need a local run against real units, recorded in the PR.

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
