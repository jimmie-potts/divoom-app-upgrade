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
modes are unavailable. The Pixoo-specific extension below supplies monitor operations. Clients must
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
through retries and automatic traversal. Recovery triggered by a health probe
uses the retained playback owner when no command callback is active.
Completion events carry the original
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


## Pixoo integration extension

With both monitor and native-controller options enabled, the finite routes
`GET /controller/pixoo-integration/v1/snapshot`,
`POST /controller/pixoo-integration/v1/commands` and
`GET /controller/pixoo-integration/v1/events` expose `pixoo-integration/1.0`.
They use the same scoped bearer credentials, Host/Origin checks and target
identity as controller v1. Read scope is required for reads, control for writes.
Streams recheck credentials before delivery and at least once per second while
idle; revocation closes them. History retains 32 snapshots and the existing
shared admission limit is 16 streams. Slow clients are disconnected.

The snapshot advertises finite mode/filter capabilities, selected and pending
mode, effective participation, cadence, revisions and generation-tagged upload
outcomes. It includes the configured controller/device/source identity and no
credential, source endpoint or private filesystem path. Shared controller v1
continues to advertise modes unsupported; its released schemas are untouched.

Commands add `controllerId` and `deviceId` to the strict
[browser integration envelope](agent-monitoring.md#browser-and-native-integration-api).
Mismatched targets reject before admission. Browser and native requests with the
same normalized envelope share receipts and conflicts. Mode/view changes do not
add generic device commands or new MCP tools. Hub #6 can consume the exported
`@pixoo/core` contracts and frontend adapter; its own overview remains separate.

## Negotiated media catalog (integration 1.1)

A native reader requests `GET /controller/pixoo-integration/v1/snapshot?apiVersion=pixoo-integration%2F1.1`
to receive the catalog extension. Omission or explicit 1.0 retains the existing
snapshot. Unsupported versions fail with `invalid-request`. Commands and event
streams remain 1.0; poll the negotiated snapshot for catalog revision changes.
The existing monitor and native-controller prerequisites remain in force.

The 1.1 snapshot adds `catalogRevision`, the catalog capability
`{supported:true,preview:"png-frames",maximumPageSize:100}`, and nullable
`currentMedia`. That object contains rendition/item identity, nullable saved
playlist identity/revision, zero-based item position and item count from the
captured playlist, player state/intent/generation and transport uncertainty.
It describes the player's selected item, including paused or loading context;
it does not claim the display currently shows those pixels. Shuffling does not
change an item's captured playlist position. A direct-media selection has null
saved playlist fields. The selected rendition can differ from the last physical
output during loading, failure, stopping or Monitor mode.

All routes below share the `/controller/pixoo-integration/v1` prefix and require
read scope, including conditional requests. A control-only credential cannot
read them. They allocate no command ticket and make no device calls.

| GET route | Response |
| --- | --- |
| `/catalog/renditions` | Paged asset/rendition IDs, name, format, effective frame count/duration and configured-profile compatibility |
| `/catalog/playlists` | Paged saved playlist IDs, names, revisions, item counts and repeat/shuffle |
| `/catalog/playlists/:id` | One playlist with its ordered item IDs, rendition IDs and duration/plays policies |
| `/renditions/:id/preview.json` | Immutable 64x64 dimensions, frame count, ordered indexes/delays, effective duration and timing warnings |
| `/renditions/:id/preview.png` | First cached effective PNG frame |
| `/renditions/:id/frames/:index.png` | The selected cached effective PNG frame |

List queries accept `limit` 1–100 (default 25) and nonnegative safe-integer
`offset` (default 0), returning `items`, `total`, `limit`, `offset`, `apiVersion`
and `catalogRevision`. Details return `apiVersion`, `catalogRevision` and
`playlist`. Existing names retain their 120 UTF-16-code-unit validation and
owner-chosen stored labels; imports use filenames when no other label exists.
No private paths, originals, credentials or arbitrary URLs are exposed.

A persistent catalog revision changes with media membership and playlist/name/item
edits. Compare revisions across pages, details and snapshots, and refresh the
affected view when they differ. Multiple requests are not one atomic snapshot.
Immutable rendition IDs keep frame identity stable across unrelated edits.
Compatibility describes admission under the active playback profile; it does
not certify visible output and does not limit preview availability.

Preview JSON contains `apiVersion`, `renditionId`, `width`, `height`,
`frameCount`, nullable `durationMs`, `frames: [{index,delayMs}]` and the renderer's
`warnings`. Stills keep null delay/duration. GIF frames preserve their effective
delays, including repeated frames and the existing zero/missing-delay warnings.
Animate only after validating the complete manifest and loading all required
frames; a failed frame is not a complete animation. No GIF palette conversion
or original decode occurs on reads.

Preview ETags are quoted SHA-256 digests of actual representation bytes.
Successful previews and conditional 304 use
`Cache-Control: private, max-age=31536000, immutable`. Authorization and current
catalog membership are checked before 304; deleted/unknown renditions return
404. Catalog JSON, failures and ordinary snapshots stay `no-store`.

At most eight native catalog/preview requests may be outstanding. Their five-second
deadline includes time waiting for the library owner; expired work does not free
admission until the underlying operation settles. Saturation returns 429
`capacity`; deadline expiry returns 504 `timeout`. Cancellation prevents queued
work from starting, and response bytes are fully verified before sending.
The default 500-frame application allowance remains independent of the physical
device profile. Existing custom simulator profiles can admit up to 1,000 frames;
this interface previews those persisted renditions too. Preview JSON is bounded
to 128 KiB and cached PNG frames to 64 KiB. Playlist detail consumers should allow
at least 256 KiB for the existing 1,000-item bound. This interface adds no lower
frame cap.
