# Shared controller API

[Issue #37](https://github.com/jimmie-potts/divoom-app-upgrade/issues/37) adds an
opt-in native API for hub clients. It uses the existing player, command ledger
and serialized device adapter. Browser and MCP routes keep their existing
contracts. The pinned shared contract is `@jimmie-potts/device-contracts` 1.0.0,
API `1.0`, from the [controller release](https://github.com/jimmie-potts/agent-device-hub/releases/tag/controller-contracts-v1.0.0).
The archive checksum and immutable source receipt are under `vendor/`.

## Configuration and credentials

Set `PIXOO_CONTROLLER_ENABLED=1` to expose the endpoint. Omit it to disable the
endpoint. The listener remains IPv4 loopback and startup defaults to simulator.
This flag does not activate hardware or enable MCP. Source delivery does not
install configuration or operate a device.

The following optional startup values define neutral, stable identity. Keep them
stable across ordinary restarts and unique among registered controllers:

| Variable | Default |
| --- | --- |
| `PIXOO_CONTROLLER_DEVICE_ID` | `pixoo-local` |
| `PIXOO_CONTROLLER_ID` | `pixoo-controller` |
| `PIXOO_CONTROLLER_SOURCE_ID` | `pixoo` |

IDs use 1–128 ASCII letters, digits, underscores, hyphens or periods. They contain
no IPs, URLs, credentials or paths. The configured destination stays in the
existing private device settings and cannot be changed through this API.

The API shares the backend's private `mcp-credentials.json` store. Provision a
separate principal with the existing `npm run mcp:credentials -- add` command
from [local MCP setup](local-mcp.md). A principal grants `read` and/or `control`
for this one backend, including its configured native identity and fixed local
MCP alias. It grants no access to another backend. The native routes require
`Authorization: Bearer <token>` on every request. Browser headers and Origin
absence are not credentials. Host, Origin and cross-site fetch-metadata checks
still apply. Native credentials do not bypass `/api` browser mutation checks.

Rotate by provisioning a new principal, updating the client and revoking the
old principal. Overlap is explicit and lasts until revocation; the store admits
at most 32 principals. Revocation blocks cached receipts and new requests.
Existing streams reauthorize before delivery and every second. Revocation does
not undo already admitted work. Do not log or commit bearer tokens.

## Routes

| Method and route | Contract |
| --- | --- |
| `GET /controller/v1/snapshot` | A full shared v1 snapshot |
| `POST /controller/v1/commands` | A strict shared v1 request and retained receipt |
| `GET /controller/v1/events` | SSE carrying shared v1 change/resync envelopes |

A request uses `identity.controllerId`, `identity.deviceId`, `nextRequestId`,
`configurationRevision` and `generation` from a fresh snapshot. The body is:

```json
{
  "apiVersion": "1.0",
  "controllerId": "pixoo-controller",
  "deviceId": "pixoo-local",
  "requestId": {"epoch": "<snapshot epoch>", "sequence": 1},
  "expectedConfigurationRevision": 0,
  "expectedGeneration": {"epoch": "<snapshot epoch>", "sequence": 0},
  "command": {"kind": "brightness.set", "percent": 25}
}
```

Use actual snapshot values; the example is not a reusable command identity.
Power maps to screen power. Screen-off pauses; screen-on does not resume.
Brightness accepts integer 0–100. Media supports saved playlist selection and
pause, resume, stop, next, previous and clear. Discovery exposes up to the first
100 saved playlist IDs in stable catalog order, without names. A changed ID or
saved revision advances the configuration revision. Selection passes the
discovered playlist revision into the existing atomic capture operation.

Wire v1 has no direct rendition-selection command or saved playlist revision
field. Local browser/MCP rendition selection remains available. Native rendition
IDs are empty; restart-with-changes, scenes, zones, preview and Monitor/Media
modes are unavailable. Issue #33 owns the future mode extension. Clients must
consult capabilities, not infer them from local API features.

## Replay, concurrency and evidence

Native, browser and MCP commands reserve one shared epoch/sequence. The last
256 completed outcomes are retained. Identical native requests, including
reordered object keys, join or replay the original outcome. Changed payloads
conflict. Native guards are part of the fingerprint, so reusing an identity
through a different envelope also conflicts. Existing browser/MCP cross-route
replay remains unchanged. Old epochs or evicted IDs expire; future IDs fail.

Schema/target/capacity failures before reservation consume no identity.
Revision, generation and unsupported-capability failures after reservation are
retained. Accepted intent advances configuration revision. Browser/MCP intent
also advances it. The player and adapter enforce their existing generation and
cancellation rules. A historical receipt cannot restore retired output.

`sent` means a successful adapter operation, never optical proof. Media command
receipts initially acknowledge context work as `queued`; uploads happen through
the existing player. Current snapshots separate desired values, pending native
and representable local commands, last successful transmission and last outcome.
Upload observers retain pending preparation and writes until they settle, including after
generation retirement. Request context follows browser, MCP and native playback
through retries and automatic traversal. Completion events carry the original
request and generation; pause and stop cannot acquire an older upload. The
original queued receipt remains immutable, while snapshots and feeds report
the later transport outcome. Local rendition-only tools have no command form
in contract v1, so their sends have request evidence but no shared pending
command entry. A later failure preserves the last successful send. Possible prior effects stay
explicit as `uncertain`. Physical observations are always unknown in simulator
mode. External ownership remains unknown without a qualified observation.
Reads and heartbeat messages never probe or refresh physical evidence.

On disconnect or uncertain outcome, reconcile with a fresh snapshot. Reuse an
old identity only for its exact original request. Never manufacture a fresh
identity to retry an ambiguous write automatically. Restart changes request,
clock and feed epochs and restores the existing player context paused.

Active playback keeps one request slot between uploads, so automatic traversal
and retries share the same bound as foreground commands. Completed or cancelled
media work releases its slot; active playback releases its reservation when its
intent stops or pauses.

## Feed and admission bounds

SSE uses `id: <cursor epoch>:<sequence>`, `event: change` or `event: resync`, and a
JSON shared feed envelope containing a full snapshot. Send `Last-Event-ID` to
resume. Retained cursors replay later snapshots. Invalid, expired, future or
unknown-epoch cursors receive full resync. Reconnect produces no commands.
Snapshot clocks describe the controller process; do not subtract them from a
client process clock. Replayed snapshots retain historical evidence times.

Bounds are 64 KiB JSON bodies, 32 total HTTP requests, 32 pending request slots,
256 command receipts, 32 feed events and 16 native stream clients. Authentication
waits time out after one second. Stream delivery queues hold at most 32 messages;
a stalled writer is disconnected, with a five-second drain ceiling. Streams
send liveness comments every 15 seconds and close during backend shutdown.
Browser streams share the overall HTTP admission limit.

Failures use shared codes: 400 invalid request, 401 unauthenticated, 403 forbidden,
404 unknown configured device, 409 revision/generation/request conflict,
410 expired identity, 422 unsupported capability, 429 capacity and 503 uncertain
or failed transport. Pre-admission failures use the existing sanitized error
envelope. Reserved semantic or operation failures return the shared receipt.
No response includes native exception text, credentials or private destinations.

## Verification

Run `npm ci` and `npm run test:controller` with Node 24. This checks the archive
and installed manifest hashes, all 220 shared schema/semantic fixtures, and
owning HTTP/MCP/browser-service tests using synthetic credentials and injected
transports. `npm run check` also includes these tests. Run browser checks for
API/startup regression coverage. These checks establish source compatibility;
installed hub clients, host routing and physical output need separate evidence.
