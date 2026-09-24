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
`npx playwright install --with-deps chromium`. Native Windows uses the same npm
commands in a Node 24 shell. Use npm's default cache and Playwright's default
browser cache (on Linux and WSL, `~/.npm` and `~/.cache/ms-playwright`), not
directories under `/tmp`, which can be a small RAM-backed filesystem shared by
every session. If a sandbox makes either cache read-only, report that instead of
redirecting it.

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

GitHub Actions requires Application checks on Ubuntu and Windows, Workflow
checks on both hosts, and Simulator browser checks on Ubuntu. The application
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

## Shared lifecycle contract conformance

`npm test` and `npm run check` run the released lifecycle package consumer test
on the existing Linux/Windows application CI jobs. It checks the committed
archive/source receipt and installed manifest, then runs the original upstream
validation/deduplication corpus. No provider session or device is invoked.
This check establishes source contract compatibility only.

## Shared controller compatibility

`npm run test:controller` builds the application and runs the released contract
fixtures and fake-backed native controller compatibility suite. It is suitable
for hub CI after a Node 24 `npm ci`; it needs no device or installed credential.
The full `npm run check` includes the same tests. See [native API](hub-controller-api.md).
