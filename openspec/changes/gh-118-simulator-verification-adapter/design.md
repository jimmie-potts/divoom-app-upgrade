## Context

The Hub's [app verification contract](https://github.com/jimmie-potts/agent-device-hub/blob/main/docs/app-verification.md) and ADR 0009 define runs, receipts, the supervisor unit, the lease, proof and capture. The shared core implements them once. Its plug-in supplies scenarios, build identity, launch, readiness, components, boundary checks and capture steps. The Pixoo server already defaults to the simulator and rejects data directories in Git checkouts, but an inherited `PIXOO_MODE=device` together with a saved `device.json` would select the physical adapter on a restart.

## Goals / Non-Goals

**Goals:** a run can never select the physical adapter or touch the owner's normal state; the absence of physical requests is observed, not assumed; a known-wrong transition or rendering makes a capture fail.

**Non-Goals:** lifecycle mechanics owned by the core, product UI or route changes, physical display evidence, catalog previews ([#96](https://github.com/jimmie-potts/divoom-app-upgrade/issues/96)), Windows-host access.

## Decisions

- **Explicit launch environment plus a fail-closed guard.** The launch spec sets `PIXOO_MODE=simulator`, `PIXOO_DATA_DIR`, `PIXOO_PORT` and `PIXOO_MONITOR_ENABLED=1`. The unit's environment can still contain other inherited values, so `node --import scripts/verify/transport-guard.ts` refuses to start unless the final process environment selects the simulator. Alternative: an `env -i` wrapper; rejected because the core already owns `PATH`, `HOME` and `TMPDIR`.
- **Observed transport boundary.** The guard replaces `http.request`/`get` and `https.request`/`get`, and wraps `Socket#connect`, which fetch and TLS also use. It blocks each outbound attempt before a packet leaves and appends it to `<runtimeDir>/pixoo-transport.jsonl` with the serving port. The log sits outside `data/`, so reseeds keep one record per run. Alternative: an HTTP proxy trap; rejected because it needs a second process and catches only proxied HTTP.
- **Seeding through application code.** Scenarios generate exact 64×64 RGB fixtures with sharp, import them through `@pixoo/library`, and post one synthetic lifecycle event through an in-process simulator app with a run-generated credential that is revoked afterwards. Seeding requires an empty real directory that is outside checkouts and apart from the owner's data and lock directories.
- **Independent oracles.** Pixel assertions compare the page's drawn pixels with the fixture definitions. State assertions read the backend. Negative controls inject real failure classes between the page and the server, such as stale replay, a wrong frame and a forbidden resume.
- **Readiness.** The ready line must be `Pixoo simulator listening on http://127.0.0.1:<port>`. The probe requires health mode `simulator` with `device.connected` false. Start checks repeat that against `/api/device` and require a guard record for the serving port with no attempts.

## Risks / Trade-offs

- A run serves the checkout's build. Rebuilding that checkout changes what a live preview serves. The receipt's digest of `/` exposes the change, and `restart` makes a new candidate.
- The guard covers the server process. The media worker is forked without it and makes no network calls.
- Monitor pictures depend on observation age, so the step compares the canvas with the server's current picture rather than with a fixed image.
