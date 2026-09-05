# Development setup

## Local checkout and worktrees

The canonical source is the WSL checkout. Use Node 24 with npm, then from each
fresh checkout or assigned worktree root:

```bash
npm ci
npm run check:workflow
npm run test:workflow
```

With nvm, `nvm install` and `nvm use` read .nvmrc. In a sandbox with a read-only npm
cache, use `npm ci --cache /tmp/pixoo-npm-cache`. On native Windows, run the same
npm commands in a Node 24 shell. No application startup, media processing, or
device credentials are required by these checks.

GitHub Actions runs both workflow commands on Ubuntu and Windows for pushes and
PRs. There are no application lint/typecheck/build/browser commands yet. The M0
foundation issue adds them with real checks, not placeholder successful scripts.

Use the repository root as the Codex project and worktree starting directory.
AGENTS.md is the project instruction entrypoint. Optional local actions are the
two workflow commands above, after dependency setup. Do not alter host-managed
.agents or .codex directories, models, permissions, trust, or hooks. A later task
can add app actions once the application exists.

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

Setup-host status: both `/home/jimmie/.agents/skills` and
`/mnt/c/Users/onesh/.codex/skills` returned `Read-only file system` during manager
installation, including an escalated attempt. No missing skill was installed.
The pinned sources can be read for this task, but that is not central discovery.
The bootstrap issue remains open until installation and fresh-task discovery
are verified. Preserve the unrelated dirty catalog at
`/home/jimmie/projects/agent-skills`.

## OpenSpec

Use `npm run openspec -- <arguments>` rather than a global CLI. OpenSpec 1.12.0
and its lockfile are repository-local. The installed package declares an MIT license.
Application dependency/license decisions remain in M0. The wrapper preserves the caller's cwd,
disables telemetry and prompts, and isolates the child configuration and Codex
home in a temporary directory removed after execution. This avoids CLI migration
changing personal settings or legacy prompts.

Initialize only specification storage:

```bash
npm run openspec -- init --tools none --profile core --no-animation
```

The bootstrap inventory contains zero specs and changes. Shared integrations
remain central. `check:workflow` runs strict noninteractive validation for both
current inventory and archived tasks, even if the first fails. These syntax and
task-marker checks do not replace artifact completeness, acceptance tests, or
independent review. `test:workflow` exercises empty/valid/invalid inventories,
incomplete archives, CLI errors, and preservation of personal configuration.

## Future runtime

The application foundation will establish an actual configuration loader and
startup command. config.example.json is currently illustrative only. Runtime
state belongs outside source under PIXOO_DATA_DIR; simulator is the default.
The planned app uses one local backend and a serialized device queue. Review
handoff sections 6-8 before implementing timing, persistence, or LAN security.
