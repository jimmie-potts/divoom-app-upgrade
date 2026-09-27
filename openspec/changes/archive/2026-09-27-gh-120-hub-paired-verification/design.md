## Context

The Hub is the only agent-state owner in the integrated preview. Pixoo's remote monitor source already polls `GET <endpoint>/sessions?snapshotVersion=1.2` with a bearer token and refuses a feed from another owner. The native controller API already serves `/controller/v1` and `/controller/pixoo-integration/v1` on the main port when `PIXOO_CONTROLLER_ENABLED=1`, authenticated against the backend's digest-only credential store. The #118 plug-in launches through a transport guard that removes inherited `PIXOO_*` settings and refuses every connection but the run's own port. It reserved `APP_VERIFY_PAIRED_PORTS` for this scenario. Core 1.1 adds run inputs, `Scenario.requiredInputs`, `ReadyLine.endpoints` held across relaunches, and a convention for credentials: the caller writes a 0600 file into the run directory after `start`, and the plug-in reads it.

The Hub orchestrator starts Pixoo standalone, then starts the Hub. It writes the token files, reseeds Pixoo `hub-paired`, and last reseeds the Hub `integrated`. So Pixoo is paired before the Hub accepts its feed token.

## Goals / Non-Goals

**Goals:** the Hub's controller calls reach Pixoo's real controller API. The Monitor shows Hub-fed sessions. Only the declared Hub port is reachable, and a connection to an installed port or a device request still fails the boundary check. Tokens never enter a receipt, event, log or error. Standalone behavior and proof stay as they are.

**Non-Goals:** Hub-side orchestration and integrated evidence (Hub #495). Media and playback commands from the Hub beyond one representative command. Moments and interludes (#92). Restarting one consumer while paired. Physical evidence.

## Decisions

- **Owner id is fixed, not learned.** The remote source requires `ownerId` in its configuration and rejects a feed from any other owner; that check is the one-owner protection. The Hub run's owner is `verify-owner`, so the seed writes it. Learning it from the feed would remove the check. Alternative: an input; rejected because the convention fixes the Hub run's owner.
- **Tokens as files, input as origin.** `hub-feed` is exactly `http://127.0.0.1:<port>/`, not an installed port and not the run's own port. Token files must be regular, non-link files that only their owner can read, holding one 43-character base64url token. Failures are fixed lines that name only the file. The feed token goes where the existing remote source reads it, the private 0600 remote configuration. The controller token is stored only as a SHA-256 digest through `registerCredential`, which reuses the store's lock and schema.
- **Pairing decided at launch, enforced by the guard.** `launchSpec` sets `APP_VERIFY_PAIRED_PORTS` on every launch, empty unless `hub-paired`. The guard admits a paired port only on `127.0.0.1`, the `hub-feed` origin's host, and refuses it on any other loopback name or address. The guard keeps `PIXOO_CONTROLLER_ENABLED` only when that list is non-empty, and still removes inherited controller identity settings. So the controller keeps its default identity, `pixoo-controller`/`pixoo-local`/`pixoo`, which the orchestrator reads back. Guarded children inherit exactly the parent's pairing.
- **Endpoint announcement.** `readiness.line` sees only the line, so `launch` records whether the ready line announces `controller`: in `hub-paired`, or whenever the core passes a recorded `controller` endpoint port. The core calls `launch` and reads the ready line in the same process. The endpoint equals the main origin. After a reseed to a standalone scenario it stays announced, because the core requires that, while the controller routes answer 404.
- **Per-process pairing in the transport check.** The log spans the run across reseeds. A paired connection is accepted only when it went to `127.0.0.1` and the connecting process's own `armed` record declared that port, which only a paired launch does. The serving process's declaration must equal `[hub-feed port]` in `hub-paired` and be empty otherwise. A literal rule ("paired connections pass only while the scenario is `hub-paired`") would fail every check after a reseed to a standalone scenario. It would stop such a reseed and fail every later standalone capture on that run.
- **Freshness check tolerant of pairing order, never of a broken pairing.** `hub-feed` reads Pixoo's feed view, which refreshes from the Hub, then the Hub's feed with the feed token, and retries briefly while either side catches up. Start and reseed fail on a failed check, and the Hub accepts the token only after Pixoo's reseed. So while this launch has had no current feed, the check is `skipped` only when the Hub refuses the token (401 or 403) or cannot be reached (connection refused or reset), and only for 60 s after the launch, read from the server's uptime. Otherwise it fails with what it saw:
  - another owner in the Hub's envelope;
  - a feed the Hub serves that Pixoo still refuses;
  - an error status;
  - a pairing still not established after the grace period.

  A current feed that turns stale fails; when the Hub now serves a revision below Pixoo's last one, the reason says to reseed Pixoo `hub-paired`. A revision that does not settle within the retries also fails. The core gives a check no operation phase, so an elapsed grace period stands in for "doctor after pairing".
- **Writer counts on the fake adapter.** The orchestrator asserts that exactly one command reached Pixoo's writer. The server disables fake history, so the adapter keeps bounded per-kind counters of admitted and successful operations, and `GET /api/device/simulator` returns them in simulator mode. The route answers 404 in device mode. Alternative: a file under the run directory; rejected because the server does not know it, and a route is scriptable.

## Risks / Trade-offs

- For the first 60 s after a launch, `hub-feed` reports a Hub that refuses the token or cannot be reached as `skipped`, with that cause. Only after the grace period does such a pairing fail.
- The `controller` endpoint stays announced after a reseed to a standalone scenario, while the controller routes answer 404. The Hub then reports the controller unavailable, which is accurate.
- A Hub reseed after pairing restarts the Hub's revisions below Pixoo's, and Pixoo refuses the regression, so Pixoo must be reseeded `hub-paired` again. The guide says so, and the check's reason names it.
- The `hub-sessions` step sends one `brightness.set` and asserts a writer delta of exactly one, so it assumes no concurrent command on the run.
- `GET /api/integration/v1/sessions` refreshes from the Hub before answering, so the freshness read is one Hub poll.
