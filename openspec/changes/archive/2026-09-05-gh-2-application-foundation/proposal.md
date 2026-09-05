## Why

[Issue #2](https://github.com/jimmie-potts/divoom-app-upgrade/issues/2) needs a runnable,
testable starting point before adapter and media work. The repository currently
has workflow tooling only.

## What Changes

- Add npm TypeScript workspaces for web, server, core, device, and media with explicit package boundaries.
- Serve a React simulator foundation page and a validated read-only health response from one loopback Fastify process.
- Establish safe environment configuration and external runtime storage, without device I/O.
- Add lint, typecheck, unit/integration/browser checks, build/start commands, CI, and dependency/license documentation.

## Capabilities

### New Capabilities

- `application-foundation`: Local simulator startup, safe configuration, health reporting, browser status and reproducible validation.

### Modified Capabilities

None. The preserved product handoff remains proposed context for future capabilities.

## Impact

Creates the five planned workspaces and GET /api/health. Introduces framework and
test dependencies, updates developer instructions and CI, and replaces the
illustrative JSON configuration with documented environment examples. No device
adapter, GIF decoder, media persistence, playlist engine, authentication, or LAN
mode is introduced. Issue #2 criteria remain authoritative; spec scenarios map
to their ordered criteria without duplicating issue status.
