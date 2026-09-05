# Pixoo-64 playlist controller

A planned local application for named image and GIF playlists on one Divoom
Pixoo-64. Each image has its own duration; each GIF has a duration or total-play count.

This repository currently contains development tooling and the MVP backlog.
There is no runnable application, device adapter, or verified hardware integration.
The initial OpenSpec capability inventory is empty.

## Development

Use Node 24 and npm. If using nvm, run `nvm install` and `nvm use` from the root.

```bash
npm ci
npm run check:workflow
npm run test:workflow
npm run openspec -- --help
```

These checks run without a display, private media, or credentials. GitHub Actions
runs both workflow commands on Ubuntu and Windows. Application lint, typecheck,
test, build, and startup commands will be introduced by the foundation issue.

Open this repository root as a WSL project in Codex. See [development setup](docs/development.md)
for fresh worktrees and shared skills, and [the SDLC](docs/sdlc.md) for delivery.
The canonical checkout is `/home/jimmie/projects/divoom-app-upgrade`.

## Product and work tracking

[Product direction](docs/product.md) identifies accepted defaults, evidence limits,
and the preserved [September 5 handoff](docs/reference/2026-09-05-agent-handoff.md).
[GitHub issues](https://github.com/jimmie-potts/divoom-app-upgrade/issues) own work
status and acceptance criteria; [milestones](https://github.com/jimmie-potts/divoom-app-upgrade/milestones)
organize M0-M6. [Decisions](docs/decisions.md) records lasting choices.

Normal source delivery uses an issue, an isolated worktree, tests, a PR, independent
reviews, and a verified merge. Application installation and physical testing stay
separate. The playback service will run on a LAN-connected host; a cloud agent or
browser alone cannot control the home display.

`PIXOO_DATA_DIR` will hold runtime data outside source. [Example configuration](config.example.json)
uses placeholders and is illustrative until the foundation establishes its loader.
Private media, credentials, device details, and databases must never be committed.
