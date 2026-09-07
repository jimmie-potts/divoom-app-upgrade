## Why

[Issue #8](https://github.com/jimmie-potts/divoom-app-upgrade/issues/8) makes the delivered library and player usable by browser clients. The current server exposes readiness only.

## What Changes

- Add validated media, playlist, device configuration and player routes with typed errors.
- Connect simulator startup to private persistence and paused player recovery.
- Add command replay protection and sequence-aware SSE snapshots/resync.
- Enforce loopback host/origin checks, bounded uploads and authentication extension hooks.

## Capabilities

### New Capabilities

- `controller-api`: HTTP contracts, request admission, command identity, live state and simulator integration for issue #8 criteria 1-5.

### Modified Capabilities

None. Foundation readiness and simulator-only binding remain intact; new routes compose existing library and playback contracts.

## Impact

Server, shared core schemas, playback state subscriptions, tests and documentation. Add pinned MIT-licensed @fastify/multipart for bounded multipart parsing. Private settings are stored outside Git. No LAN listener, physical adapter activation, app installation or hardware verification.
