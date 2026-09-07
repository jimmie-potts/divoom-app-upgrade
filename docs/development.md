# Development setup

## Local checkout and worktrees

Use Node 24/npm. With nvm, `nvm install` and `nvm use` read .nvmrc. From each
fresh assigned worktree root:

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run simulator
```

On Linux, Playwright may require browser system dependencies; hosted CI uses
`npx playwright install --with-deps chromium`. Native Windows uses the same npm
commands in a Node 24 shell. Use `npm ci --cache /tmp/pixoo-npm-cache` if the WSL
npm cache is read-only. In a sandbox, an explicitly set PLAYWRIGHT_BROWSERS_PATH
can place browser binaries in a writable external cache.

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
the entrypoint. Optional local actions can use the check, browser and simulator
commands after their prerequisites. Preserve host-managed .agents/.codex, model,
permission, trust and hook settings. The shell examples are optional environment
assignments, not configuration files loaded by the app.

## Shared skills

Reusable methods belong to [agent-skills](https://github.com/jimmie-potts/agent-skills).
The setup evaluated catalog revision `139ba8567a8b74d188850f83bff6d4687610c786`.
Use a separate checkout at that revision and retain it while installed links use it.
The local setup checkout is ignored at `.local/agent-skills` in the canonical
repository, outside the tracked source and outside disposable worktrees.
Do not clean that directory while installed skills depend on it.

Required methods are github-delivery, grill-with-docs, grilling, tdd, code-review,
domain-modeling, writing-for-agents, unslop, and the OpenSpec integrations:
openspec-propose, openspec-explore, openspec-apply-change, openspec-update-change,
openspec-sync-specs, openspec-archive-change. Existing central skills are preserved.
A fresh host must inspect its catalog and install missing methods through the
catalog manager without replacing conflicts. WSL links do not prove native
Windows or cloud discovery; provision each host through its supported skill root.

On this setup host, the seven delivery/OpenSpec methods were missing. From the
separate catalog checkout, run the manager in a writable host session:

```bash
./scripts/manage-skills.sh install --agent codex github-delivery openspec-propose openspec-explore openspec-apply-change openspec-update-change openspec-sync-specs openspec-archive-change
./scripts/manage-skills.sh status --agent codex
```

The manager preserves conflicts. Do not use `--all` on an existing installation.
Use its `CODEX_SKILLS_DIR` option only for the actual skill directory of the target
host. Restart Codex if its skill catalog needs refresh and verify loaded source
paths in a new task. A link created from WSL must not be assumed readable by a
native Windows process. Do not generate repository-local copies as a fallback.

Installation of the seven missing delivery/OpenSpec skills was verified after
the user ran the manager from a writable WSL session. All seven are discovered
in Codex and link to the pinned isolated catalog. Existing required skills remain
in the original catalog. The manager calls those links foreign because they
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

The current inventory includes application-foundation, device-adapter, device-http-spike, media-rendering, library-persistence, playlist-playback and controller-api and controller-ui.
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
separate opt-in commands; application startup still uses simulator mode. The API admits bounded multipart uploads to the library. Read the handoff and exact issue before extending them.
Do not claim physical behavior from the readiness API or simulator page.
