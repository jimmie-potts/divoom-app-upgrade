# Pixoo playlists

A local application foundation for image and GIF playlists on a Divoom Pixoo-64.
The current build serves a responsive media library, playlist editor, player and
settings UI. It defaults to the simulator and supports explicit device startup
with a validated private configuration and the dated Pixoo64 smoke profile.
The media package renders bounded PNG/JPEG/GIF uploads into immutable frames and
previews. The library package persists media metadata and revisioned playlists
with reference-safe deletion. The playback package runs playlists and restores paused sessions. The [HTTP API](docs/api.md) exposes media, playlists, player commands and SSE. See [UI usage](docs/controller-ui.md) for uploads, editing, playback and recovery. The
[Pixoo64 smoke test](docs/hardware-validation.md) passed its narrow profile.
[Opt-in protocol tools](docs/protocol-spike.md) are separate from normal startup.

The optional [local MCP endpoint](docs/local-mcp.md) exposes status, brightness and
screen controls to authenticated local clients. It is disabled by default and
uses the same application writer as the browser. Source delivery does not
configure Codex or establish physical acceptance.

## Run the simulator

Use Node 24.5 or later in the 24.x line and npm. With nvm, run `nvm install` and
`nvm use` from the root. The minimum includes Node's built-in HTTP proxy support.

```bash
npm ci
npm run simulator
```

Open the printed URL, normally [http://127.0.0.1:8787](http://127.0.0.1:8787).
This command builds the workspaces and browser assets, then starts one Fastify
process serving the page and controller API, including `GET /api/health`. After a build, `npm start`
starts without rebuilding. Stop with Ctrl+C. Closing the page does not stop
the server. There is no hot reload in this foundation.

Set `PIXOO_MODE=simulator` explicitly if your shell previously selected device
mode. The listener is fixed to IPv4 loopback;
LAN/phone access is not enabled. Phone viewport tests do not establish actual
phone connectivity. In simulator mode, playback and display commands send no
physical requests. See [device startup and acceptance](docs/device-application.md)
for private configuration, explicit activation, smoke limits and simulator rollback.

## Runtime data

The default directory is `~/.local/share/pixoo-playlist-controller` on Linux/WSL
and `%LOCALAPPDATA%\PixooPlaylistController` on Windows. Override with an absolute
`PIXOO_DATA_DIR` outside source control. Startup creates missing directories,
checks writability, and preserves existing files. It rejects relative/blank paths,
paths within this checkout or another Git checkout, and symlink aliases into them.
Private directories are never served directly or included in health responses. Validated preview routes serve effective PNG frames by rendition ID.

`PIXOO_PORT` defaults to `8787`; `0` requests an available port. `PIXOO_MODE`
defaults to `simulator`; `device` requires valid private settings at startup. See [shell](examples/config.sh)
and [PowerShell](examples/config.ps1) examples. Startup configuration is environment-only; no .env loader is used.
The settings API persists validated `device.json`. The backend captures settings
once at startup; later saves require restart to affect the active device. Existing
app data is never deleted at shutdown.

See [local operations](docs/local-operations.md) for persistent native startup,
diagnostics, offline backup/restore, host wakefulness and Windows/WSL checks.

## Validate and develop

```bash
npm run check
npx playwright install chromium
npm run test:browser
```

`check` runs lint, typecheck, a full build, unit/integration tests, and workflow
checks. Browser tests cover desktop/mobile uploads, transforms, editing, player controls, reconnect, command retry and readiness failure/retry. All tests use isolated data without a device. See
[development](docs/development.md) for individual commands and platform details,
[dependency licenses](docs/dependencies.md), and [the SDLC](docs/sdlc.md) for delivery.

The seven npm workspaces are web and server applications plus core, device,
media, library and playback packages. Core owns readiness validation. The device package includes a
[deterministic fake adapter](docs/device-adapter.md) for complete RGB uploads,
serialized controls, cancellation and failure tests. The media package provides [bounded rendering and immutable previews](docs/media-rendering.md). The library package provides [SQLite playlists and media retention](docs/library-persistence.md);
[playback](docs/playback.md) adds the backend player and recovery contract. The fake is a
test adapter used by the backend player. Device mode uses the existing HTTP
adapter through the same player, API command identities and serialized writer.

Open the repository root as a WSL project in Codex. The canonical checkout is
`/home/jimmie/projects/divoom-app-upgrade`; work on issue branches in isolated
worktrees. Root [AGENTS.md](AGENTS.md) defines instruction routing and validation.

[GitHub issues](https://github.com/jimmie-potts/divoom-app-upgrade/issues) own scope
and status. [Product direction](docs/product.md) links the preserved handoff,
[reviewed foundation requirements](openspec/specs/application-foundation/spec.md),
and future work. [Decisions](docs/decisions.md) records accepted architecture.
Source delivery, app installation, and physical acceptance remain separate.

[Shared monitoring direction](docs/hub-integration.md) records the planned hub integration and its GitHub dependencies. It changes no current simulator behavior.

## Cross-project work guide

The [hub work guide](https://github.com/jimmie-potts/agent-device-hub/blob/main/docs/work-guide/README.md) contains the shared remaining-work
map, delivery history and architecture diagrams. This project maintains its
portion through a linked hub PR under the SDLC completion gate.
