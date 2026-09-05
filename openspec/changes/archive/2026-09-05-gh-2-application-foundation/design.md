## Context

The repository has Node 24/npm workflow tooling and no application code. See the
proposal for motivation. The issue authorizes source delivery, not deployment or
physical-device access. A design is required for the new cross-package structure
and runtime storage boundary.

## Goals / Non-Goals

Use a small compiled ESM workspace graph and one backend process with no hardware
transport. No database, renderer, player, LAN binding, or authentication is built
here. Those remain the explicitly scoped later issues.

## Decisions

- npm workspaces and TypeScript project references build core, device, media,
  server and web in dependency order. Each package exports built modules. This
  avoids a custom loader or bundling backend dependencies into a single file.
- Core owns a shared Zod health schema. Device owns the disconnected simulator
  descriptor, and media owns the 64x64 canvas dimensions. Both are small genuine
  foundation exports; interfaces and decoding belong to #3/#5. Neither imports
  network/native libraries. The server composes them and the UI validates health.
- Fastify serves Vite production assets and the read-only health endpoint from
  one origin. `npm run simulator` builds then starts it; `npm start` runs an
  existing build. No separate Vite development server is required for M0.
- Environment-only configuration uses PIXOO_DATA_DIR, PIXOO_PORT and PIXOO_MODE.
  Replace the obsolete illustrative JSON file with shell/PowerShell examples.
  Default data is LOCALAPPDATA/PixooPlaylistController on Windows or
  ~/.local/share/pixoo-playlist-controller elsewhere. Only simulator is accepted;
  binding is fixed to 127.0.0.1. Port 0 supports isolated test listeners.
- Resolve existing path ancestors before creating storage; reject paths under the
  current source root or any Git checkout, including symlink aliases. Create the
  directory and check writability with a temporary probe directory/file that is
  removed afterward. Failure precedes listening. The runtime data directory is
  never mounted as a static root or returned in health JSON.
- Vitest tests configuration and Fastify injection. Playwright verifies the built
  same-origin page at desktop/mobile sizes, health-failure retry and actual
  listener behavior using isolated runtime data. No physical phone claim follows.
- Record direct dependency licenses from installed metadata and pin exact
  versions. SQLite, sharp and a GIF decoder remain future dependencies because
  their implementations and fixture-backed selection are outside this issue.

## Risks / Trade-offs

- The simulator is a foundation status page, not a fake player. UI text must state
  that limitation and offer no pretend playback controls.
- Storage validation does not defend against another local process changing
  symlinks during startup. It prevents accidental source-directory use; this is
  not a multi-user hostile filesystem design.
- Production builds require a rebuild to see edits. Hot reload is optional later.
- Node native and browser tooling differ by host. CI covers Ubuntu/Windows, with
  browser checks on Ubuntu and no claim of physical device/network validation.

## Migration Plan

No database or installed application exists to migrate. The source PR introduces
commands and configuration examples. Reverting it returns to workflow-only
bootstrap. Startup and shutdown preserve any external runtime files.
