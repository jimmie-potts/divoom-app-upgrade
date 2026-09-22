# Shared agent monitoring

Issue [#31](https://github.com/jimmie-potts/divoom-app-upgrade/issues/31) composes
`@jimmie-potts/agent-state` 1.0.0 inside the existing backend. The vendored release
archive has SHA-256 `ae589d311e282c3356579c85507a3aa973ab7990e06e062143aeb08d8d2dcc99`.
The source receipt identifies Hub PR #105 and its immutable source. Pixoo supplies
storage and authenticated transport; the package supplies provider normalization,
reduction, deduplication, child rollup, freshness, retention and migration validation.

Monitoring is disabled by default. Enabling it does not activate hardware.
Simulator remains the default; existing explicit device mode remains available.
The Monitor panel selects Monitor or Media through the existing player and
serialized adapter. Collection does not depend on the selected mode or an open
browser. Startup never activates monitor presentation.

## Required-client matrix

This dated summary uses Hub's 2026-09-08 source qualification. The
[pinned record](https://github.com/jimmie-potts/agent-device-hub/blob/855bd3787803dad7245f29e88c758659f6e4eda4/docs/provider-qualification.md)
owns artifact identities, primary documentation and limits. Versions below are
artifact evidence, not qualified live Pixoo installations.

| Required path | Inspected version evidence | Shared source contract | Installed-client coverage |
| --- | --- | --- | --- |
| Codex CLI in WSL Linux | npm `0.153.4`; executable version check passed | API `1.0`, client `cli` | Hook emission, bounds and end-to-end operation unverified |
| Codex CLI in native Windows | npm `0.153.4`; binary present | API `1.0`, client `cli` | Invocation and live hooks unverified |
| Codex Desktop in Windows, targeting Windows or WSL | Version and hook path inaccessible | API `1.0`, client `desktop` | Unqualified until version, route and required coverage are established |
| Claude Code in WSL Linux | Native artifact `2.1.236` | API `1.0`, client `code` | Live hooks and delivery bounds unverified |
| Claude Code in native Windows | Native artifact `2.1.237`, byte identity verified | API `1.0`, client `code` | Live hooks and delivery bounds unverified |

Pixoo consumes the shared translation; provider payload mapping belongs to Hub.

| Capability | Consumer requirement and evidence limit |
| --- | --- |
| Session/turn identity | Preserve the full selector and available turn identity. Codex has event-specific turn identity; Claude prompt identity has version/availability limits. Missing evidence remains unknown. |
| Continuing/blocking input | Require qualified operation semantics; do not classify question text or infer a blocked wait from silence. |
| Approval/resolution | Require correlation; an unrelated resolution cannot clear a wait. Monitoring never changes permissions. |
| Turn/runtime end | Preserve turn end, interruption and runtime end separately. Reviewed Claude evidence does not establish a Codex-equivalent Interrupt event. |
| Parent/child identity | Aggregate only attributable children. Unsupported relationships and counts remain unknown. |
| Native IDs/ordering | Common documented fields do not establish universal native event IDs or total ordering; retain shared deduplication and ordering limits. |
| Read/unread | Optional qualified Codex Desktop evidence only. Absence is neither read/unread nor monitor acknowledgment. |
| Delivery/freshness | Async settings alone do not prove bounded delivery. Lost/stale observations remain visible, and provider failure cannot hold agent execution. |

Qualify the required version, route and signal coverage before enabling a
producer path. A required gap needs an explicitly accepted degraded mode that
shows uncertainty. Leave a path disabled when identity, privacy or safe delivery
cannot be established. Optional read evidence may remain unknown. This source
delivery supplies no installed qualification or degraded-mode approval.

## Missing, invalid and stale evidence

The monitor rejects unsupported/missing versions with a fixed bounded
error and no payload echo. Rejection preserves fail-open agent execution and
media operation. Keep the last valid state subject to its freshness rules;
invalid input cannot refresh it, clear attention, mark a notice read or fabricate
successful synchronization. Bounded diagnostic counts must not retain input.

Validate and bound raw input before monitoring storage. API `1.0` allows at
most 8192 UTF-8 JSON bytes, depth 8 and 256 visited values including keys. These
are admission limits, not measured latency budgets. Hub #30 owns the measured
budgets; The released Hub #3 package owns shared producer and state enforcement; this host applies its stricter 2048-byte normalized-event limit.

## Browser and task requirements

The Codex-first browser must keep sessions/turns distinct, show activity and
attention independently, retain turn-ended notices, show freshness and allow
explicit user labels and monitor acknowledgment. Claude source compatibility
remains required. The browser consumes the issue #31 session-source boundary;
it interprets neither raw provider payloads nor another reducer. Issue #32 owns
64x64 rendering; issue #33 owns the monitor panel and Monitor/Media controls.

Acknowledgment targets the exact notice for the configured Pixoo consumer. It
claims neither readership nor another consumer's acknowledgment. An unavailable
feed cannot manufacture successful acknowledgment. Collection is independent
of display mode/device availability; unsolicited events must not take over Media.
Screen-on alone neither resumes playback nor requests monitor redraw. Preserve
playback recovery, originals and referenced renditions.

## Private configuration

Build under Node 24 with `npm ci` and `npm run build`. Create the `agent-monitor`
directory inside the backend's private `PIXOO_DATA_DIR`, outside every Git checkout.
Keep it on the owning OS's local filesystem. Linux refuses monitor stores below
`/mnt`; never open a mounted Windows database from WSL. Each host keeps a distinct
database and exchanges validated exports through an explicit handoff.

Create `agent-monitor/config.json` with a stable neutral owner ID and consumer
policies. Keep these values unchanged across ordinary restarts:

```json
{
  "version": 1,
  "mode": "embedded",
  "ownerId": "monitor-owner-1",
  "consumers": [
    {"id": "pixoo", "clearOnNewTurn": true},
    {"id": "nanoleaf", "clearOnNewTurn": false}
  ]
}
```

Provision a separate monitor credential explicitly. The command prints a random
bearer token once; keep it in private client configuration:

```sh
npm run monitor:manage -- add-control /absolute/private/pixoo-data producer-1
npm run monitor:manage -- add-read /absolute/private/pixoo-data consumer-1
PIXOO_DATA_DIR=/absolute/private/pixoo-data PIXOO_MONITOR_ENABLED=1 npm start
```

The monitor credential file uses the existing digest/rotation boundary in its own
private directory. Controller MCP tokens do not grant monitor access. `read`
credentials permit snapshots and streams; `control` also permits ingest, labels,
acknowledgment and quiesce. Do not share control credentials with read-only clients.
Remove a credential with `monitor:manage -- revoke <data-directory> <principal>`.
Revocation affects subsequent requests; disconnect existing streams when revoking
a reader. Removing `PIXOO_MONITOR_ENABLED` and restarting disables the routes.

## HTTP contract

All monitor routes begin `/api/monitor/v1`. Every request requires a bearer token
and the existing Host/Origin/fetch-metadata protections. Originless mutations
also require `X-Pixoo-Request: 1`. The listener remains numeric IPv4 loopback.
No route accepts a caller-selected device, URL, file path or command.

| Method and suffix | Contract |
| --- | --- |
| `GET /sessions` | Version 1.0 envelope with owner ID, connection status, shared snapshot and next request ID |
| `GET /sessions?q=label&provider=codex` | Full canonical snapshot plus matching identity list; optional bounded label/neutral-session-ID substring and provider filter |
| `POST /events` | One shared lifecycle envelope, at most 2048 bytes; returns the core's typed outcome |
| `POST /commands` | Strict label, acknowledgment or quiesce command with the selected owner's request ID |
| `GET /changes` | Existing SSE replay/resync transport with bounded revision/health notifications |

A command has `operation`, `requestId`, and operation-specific fields. `label`
takes `identity` and a user-chosen `label` or null. `acknowledge` takes `identity`,
`noticeId` and configured `consumerId`. Identity is the shared provider, client,
hostId, sourceId and sessionId tuple. Acknowledgment never marks a chat read,
approves work or implies successful completion. `quiesce` has no other fields
and returns the versioned durable export.

Obtain `requestId` from a fresh sessions response. Preserve it when retrying a
lost response. Matching retries return the retained result; conflicting payloads
return 409. Expired identities return 410 and require reconciliation and fresh
intent. The existing command ledger retains 256 completed outcomes. Producer
retries instead use the shared event identity and ordering evidence. Unknown
ordering remains uncertain; it is never filled in from arrival order.

SSE events contain owner ID, revision, connection status, collector status, shared loss count and
uncertain-session count. Fetch `/sessions` on `state` or `resync`; notifications
are not command effects. Reconnect uses `Last-Event-ID`. Unknown/expired cursors
resync, and consumers must replace current state rather than replay old effects.
Controller and monitor streams share 16 slots, 32 notifications per stream type,
15-second heartbeats and the existing five-second backpressure disconnect policy.
Their small notification history excludes full session snapshots. Streams leave
capacity within the 32-request HTTP admission bound. JSON command bodies retain
the existing 64 KiB limit and 30-second HTTP request timeout.

The response also reports `admissionRejected`, a bounded count of event requests
rejected by the HTTP capacity gate before authentication. It is separate from
the shared snapshot loss count and does not claim those requests were valid
observations. Remote facades include the selected owner's count.

The core limits pending admission to 128 entries/262144 event bytes, sessions to
128 and registered consumers to 16. The journal keeps the newest 10000 diagnostic
events within 24 hours. It does not delete current labels or undismissed notices.
Five minutes without session evidence marks that evidence uncertain independently
of collector health. Restart restores existing sessions as uncertain. A full
session/notice limit returns capacity; it does not silently drop durable state.

## Remote source

Use an explicit remote configuration to select an already running owner:

```json
{
  "version": 1,
  "mode": "remote",
  "ownerId": "monitor-owner-1",
  "endpoint": "http://127.0.0.1:8788/api/monitor/v1",
  "token": "REPLACE_WITH_PRIVATE_REMOTE_CONTROL_TOKEN"
}
```

The placeholder is deliberately invalid. The configured owner ID must match the
remote envelope. Remote mode starts no reducer and opens no local shared-state
database. Reads, filters, labels and acknowledgment use the selected source.
The host polls once per second with one coalesced in-flight refresh, a 2500 ms
abort limit, a 16 MiB response cap and no redirects. A malformed response,
revision regression or unavailable owner produces `stale` or `unavailable` with
no usable next request ID. Cached snapshots keep their original `asOfMs`; clients
must render the connection status and must not treat cached evidence as fresh.
There is no automatic second-owner fallback or mutation retry with a new identity.
Producers send to the actual owner; a remote facade rejects ingestion. Quiesce
must also target the actual owner. This protocol supplies Hub #5's later host
boundary; this change does not implement that standalone service.

## Quiesce, import and rollback

1. Submit `quiesce` directly to the active owner using its current request ID.
   It drains admitted work, returns a validated export and persists a restart
   fence. Save the response in a private file. Ingestion now rejects new work.
2. Stop that backend and verify its process has exited. The OS releases its
   exclusive monitor lease. Do not start the replacement before this release.
3. Configure the replacement with the same owner ID and consumer policies, then
   run `monitor:manage -- import <new-private-data-directory> <private-export-file>`.
   Import requires an empty destination and rejects unsupported data/versions.
4. Start the replacement and verify owner/session identities, revision, labels
   and notices. Explicitly switch producer and facade endpoints. Keep the old
   store quiesced. The two owners never share a live database.

If cutover fails before new writes, stop the replacement and verify its lease
release. Only after establishing that the old copy is current, use
`monitor:manage -- resume <old-data-directory> replacement-stopped-and-state-current`
and restart it. This is an explicit operator assertion, not cross-host fencing.
After new writes, export the replacement and import into a fresh rollback directory;
do not resume the stale old copy. Unknown ownership or uncertain completion means
stop and reconcile, not automatic retry. A leftover import file with an occupied
store requires inspection; startup refuses to overwrite it.

SQLite commits are atomic and revision-checked, with FULL synchronization. An
exclusive lease uses a separate SQLite lock held for the owner's lifetime. A
crash releases the OS lease; an explicit quiesce fence survives ordinary restart.
The library and device stores remain under their existing owners.

## Producer example and verification

`scripts/monitor-hook.mjs` is an explicit source example, not an installer.
It uses the released normalizer, bounded 64 KiB stdin and 8 KiB configuration,
authenticated loopback transport, no redirects/retries, and a 2.9-second process
deadline. Every outcome exits zero without stdout/stderr. Configuration contains
`enabled`, `qualified`, `source`, `endpoint` and `token`. Both enable flags must be
true only after the intended provider path is qualified. The source object uses
the shared provider/client/hostId/sourceId/hook contract; the endpoint ends in
`/api/monitor/v1/events`. Do not derive IDs from private paths or copy automatic
titles. Raw prompts/transcripts/tools never enter the normalized transport.
Hub #8 owns installation and real-client qualification.

Run `npm run check` and `npm run test:browser` for source acceptance. The monitor
integration tests cover credentials, replay, privacy, crash ownership, uncertainty,
remote loss, migration and SSE coexistence. `node scripts/measure-monitor.mjs`
runs three 1000-call repetitions for each 1/10/50-task profile with disposable
Linux state and no devices. It compares hook latency with Hub #30's frozen
63/82/377 ms p95 and 65/87/396 ms p99 ceilings. Read the resulting receipt and its
limits before making a performance claim; full integrated consumer/CPU/memory
qualification remains Hub #30. Source checks never prove installed hooks or
visible device behavior.

## Legacy compatibility

Preserve legacy Nanoleaf behavior until an explicitly selected, verified cutover,
including its collector, unread policy, Work/Quiet/Free behavior, preferences and
scenes. Source adoption installs no hooks, changes no personal settings, starts
no client sessions, migrates no live state and contacts no device. Hub #8 owns
shared installation/migration tooling; Pixoo #34 owns installed-provider and final
acceptance. Transport and visible-device evidence remain separate.

The private state database uses SQLite WAL with `synchronous=FULL` and automatic
checkpointing. The separate owner database retains its exclusive lifetime lock.
WAL reduces commit synchronization work while keeping durable commits; see the
[SQLite WAL documentation](https://sqlite.org/wal.html). Export/import remains the
only supported transfer boundary. Do not copy a live database without its WAL.

Performance qualification remains incomplete. The retained
[local performance receipts](performance/gh-31-embedded-host.json) fail the frozen
Linux percentile budgets. The owner moved measurement, diagnosis, optimization
and numeric acceptance to [hardening #61](https://github.com/jimmie-potts/divoom-app-upgrade/issues/61).
It follows #31 and does not block feature source delivery or dependent features.
Frozen limits and failed receipts remain unchanged. Correctness, security,
durability, bounded resources, failure isolation and hard fail-open deadlines
remain required. The measurement helper is partial diagnostic tooling, not a
complete qualification suite. Do not treat the hook example as qualified for
personal installation. Hub #30 still owns integrated qualification.

The source-only guide companion is
[Hub PR #112](https://github.com/jimmie-potts/agent-device-hub/pull/112).

## Dashboard rendition

Issue #32 adds a pure Pixoo renderer over the selected SessionSource. It neither
interprets provider payloads nor changes Media/Monitor ownership. The shared
browser belongs to Hub #6, and Pixoo #33 owns the monitor panel and device writer
integration. The renderer never sends a physical command.

`GET /api/monitor/v1/rendition` uses the same bearer read authorization and request
protections as sessions. It accepts no query parameters and uses `Cache-Control:
no-store`. The response contains `state`, `active`, `pending`, `cadenceMs`, and
`rendition`. State is `pending`, `current`, `error`, or `closed`; only `current`
contains pixels. A rendition has version 1, generation, width/height 64, format
`rgb888`, layout metadata and exactly 12288 row-major RGB bytes as a JSON array.
Consumers must discard their previous preview when state is not current and
fetch current state on SSE resync. The generation is scoped to this renderer's
process; it is not a shared-state revision or durable device generation.

The layout includes source owner/revision/as-of, connection, collector, matching
and total session counts, attention count, page and page count, and full row
details. Row details retain full labels, identities, exact observed/evidence
millisecond timestamps, shared freshness/unavailable evidence, child counts and
consumer-visible notice IDs. Reading this metadata does not acknowledge notices.
The endpoint shows the selected monitor projection. Provider, project ID, full
session identity and label/session search filters apply to both preview and
display. Filtering preserves the complete source snapshot and child rollup.

| Area | Pixels and meaning |
| --- | --- |
| Summary, y=1 | `S` matching top-level sessions, `!` total top-level sessions with approval/input/questions across all pages and filters, current/total pages |
| Four rows, y=14/24/34/44 | Provider at x=0; activity at 4; attention at 8; six-character label at 12; children at 40; uncertainty at 56; notice at 60 |
| Provider | `C` Codex, `L` Claude |
| Activity | `>` active, `=` idle, `X` interrupted, `]` runtime ended, `?` unknown |
| Attention | `A` approval, `!` blocking input, `?` continuing question, blank none; activity is separate |
| Children | `+0` through `+9`; `+9+` means more than nine; suffix `?` indicates incomplete/uncertain relationship or activity evidence; full count stays in metadata |
| Row flags | `?` uncertain/stale/unknown evidence; `T` retained turn-ended notice, never successful task completion |
| Footer, y=57 | `F` source: C current / S stale / ? unavailable. `C` collector: R running / Q quiesced / F faulted / X closed / ? unknown |

The original 3x5 font supports ASCII A-Z, digits, space and `._+!?/-`. Lowercase
ASCII becomes uppercase; each unsupported Unicode code point becomes `?`.
Labels longer than six code points become five display characters followed by
`+`. Full labels remain unchanged in layout metadata. Icons differ in shape as
well as color. Empty pages retain summary and health with `EMPTY` in the body.

Blocking approval/input comes first, then continuing questions, retained notices,
and other sessions. Full provider/client/host/source/session identity breaks ties
ordinally, so reversed input order cannot shuffle a priority group. Known children
are omitted from top-level rows; ambiguous parent evidence remains visible.
Unknown parent relationships make child counts explicitly incomplete.
Acknowledged notices disappear only for that consumer. New turns use the core's
consumer policy. Restart uncertainty remains visible independently of collector
health and source connection.

Pagination rotates at ten-second intervals using an injectable monotonic clock.
Membership/order/filter changes clamp the page and restart its interval. Evidence
refreshes with unchanged ordering preserve the deadline. Delayed ticks account
for complete elapsed intervals. Rendering coalesces to one active job and one
newest pending input; superseded and closed generations cannot publish. Failed
renders retry on a later eligible tick without exposing partial pixels.

The runtime renders at a minimum 1000 ms interval and refreshes its source every
second. `monitorRenderCadenceMs` is a rendering test/embedding option, independent
of the operator-selected upload cadence. The pure renderer retains its 3000 ms
standalone fallback. Upload starts use the selected 1000–10000 ms interval,
defaulting to 1000 ms under [ADR 0015](decisions/0015-dashboard-qualification.md).
Slower settings can omit intermediate pictures; the writer always takes the
latest completed rendition.

After `npm run build`, generate the standalone synthetic browser preview:

```sh
node scripts/dashboard-preview.mjs /tmp/agent-dashboard-preview.html
```

The [committed synthetic examples](examples/agent-dashboard.html) show native
64x64 and nearest-neighbor 4x previews with full row details. They include blocked
approval, a continuing question, a retained notice, overflow, unknown/unsupported
labels, stale source and empty state. The browser checks compare every canvas
byte to renderer RGB; fake-device tests verify the same frames. These tests do
not prove native-font fidelity, physical readability, installed hooks or timing.


## Monitor panel and display ownership

The Monitor tab shows full chosen labels, provider/activity/attention/freshness,
source and collector health, exact timestamps, observation age, children and
retained notices. Save label is an explicit owner command. No prompt, title,
tool output or private path is copied. Dismissal acknowledges only Pixoo's
retained notice; it cannot mark a chat read, approve work or change a tracker.
Projects use the shared optional neutral `projectId`; sessions use all five
identity fields. Unlabeled sessions retain their neutral ID.

Apply monitor view saves the provider/project/session/search selection and
cadence. Counts distinguish matching top-level rows from the total. Empty views
retain health and summary pixels. The 64×64 canvas uses the renderer's exact RGB
bytes, enlarged with nearest-neighbor scaling. The latest preview may lead a
pending upload. It is desired content, not evidence that a physical display
shows those pixels. Full labels remain visible beside the truncated glyphs.

Show monitor pauses playlist advancement while preserving its captured context,
persists Monitor mode and explicitly activates presentation. Select Media
retires monitor work and leaves playback paused. Start, show-media, restart and
resume select Media through the same service used by browser, native HTTP and
existing MCP tools. Editing filters in Media leaves playback running. Agent
questions, approvals, errors and turn ends keep updating the source and preview
but cannot select Monitor or send unsolicited display pictures.

`MonitorPresentation` owns mode/filter/cadence and a logical transition queue.
`Player.uploadDashboard` accepts complete RGB pictures only for its current
paused generation. Player owns the sole adapter; the adapter owns the serialized
operation queue. A mode switch, screen-off or shutdown retires pending work.
An already-started physical request can still have effects. Its late receipt
retains its original generation and cannot reactivate Monitor. There is at most
one dashboard upload in flight and one latest rendered picture to consider.
Failed or uncertain writes suspend presentation without automatic retries.
Screen-on alone never activates either monitor presentation or playback.

`agent-monitor/presentation.json` stores version 1 mode, filter and cadence in
the private data directory with atomic replacement. Invalid configuration fails
startup. Restart restores selection and paused playback context, marks prior
active sessions uncertain through the selected state owner, and waits for an
explicit Show monitor or media command before display writes. Changing the
selected owner preserves presentation configuration. Labels/notices follow the
owner's cutover/export/import/rollback procedure above; remote mode creates no
second reducer. Rollback must use current state, not a stale exported copy.

## Browser and native integration API

Browser routes under `/api/integration/v1` share the existing Host, Origin,
fetch-metadata and mutation-header rules. `GET /view` returns integration state,
selected-source state and the exact dashboard rendition. `/snapshot`, `/sessions`
and `/rendition` expose those parts; `/changes` provides bounded sequence-aware
SSE with replay or resync. `/commands` accepts only mode and view operations.
`/shared-actions` accepts only explicit label or Pixoo notice acknowledgment and
uses the selected owner's separate `nextRequestId`.

Mode/view commands carry `apiVersion: "pixoo-integration/1.0"`, `requestId`,
`expectedConfigurationRevision`, `expectedGeneration` and a strict `action`.
Mode actions are `{operation:"mode", mode:"monitor"|"media"}`. View actions are
`{operation:"view", filter:{q?,provider?,projectId?,session?}, cadenceMs}`.
Unknown fields, unsupported values and stale revisions/generations are rejected.
Duplicate request IDs replay the retained result; conflicting content rejects.
The common command ledger also serves existing media and display clients.

Snapshots distinguish persisted `configuration.mode`, `pendingMode`, effective
`participating`, `inFlight`, source revision/connection, rendition generation and
last upload outcome. Mode generation and source revision are separate. A
configuration receipt never proves physical presentation. Native clients use
the [protected finite extension](hub-controller-api.md#pixoo-integration-extension).
The released shared controller v1 schema remains unchanged.

The browser fetches current state after reconnect and ignores duplicate/stale
SSE IDs. It makes at most three consecutive reconnect attempts before requiring
Reconnect monitor. Interrupted commands retain their original request for an
explicit retry or reconciliation. Stale/conflicting commands refresh state and
require a new user action; no mode transition or missed picture is replayed.

[ADR 0018](decisions/0018-monitor-display-ownership.md) and the
[agent-monitor-controls specification](../openspec/specs/agent-monitor-controls/spec.md)
record these boundaries. Source fixtures cover simulator pixels, delayed/cancelled
work, owner migration and browser/native controls. Installed-client and integrated
physical acceptance remain [#34](https://github.com/jimmie-potts/divoom-app-upgrade/issues/34).

## Reversible setup package and rehearsal

Pixoo consumes Hub #8's shared setup SDK through the development dependency
`@jimmie-potts/hub` 0.1.0. [The source receipt](../vendor/hub-0.1.0-source-receipt.json)
pins the unchanged archive and source revision. `npm ci` installs it for source
rehearsal; ordinary Pixoo startup does not import it or install hooks. The
[upstream setup runbook](https://github.com/jimmie-potts/agent-device-hub/blob/f6bee907e06177c6dc8abde0075d73cc391784e9/apps/hub/SETUP.md)
owns setup, credential adapters and migration. This integration supplies no
second installer.

Use Linux Node 24.5 or later in the Node 24 line. From this checkout:

```sh
npm ci
npm run build
npx vitest run tests/integration/monitor-setup.test.ts
```

The fixture uses private temporary files and an ephemeral simulator listener.
It invokes the shared SDK and hook executable, preserves synthetic legacy
Nanoleaf and unrelated hooks, rejects a changed plan, checks idempotence,
leaves an unqualified source disabled, and confirms removal revokes access.
It does not invoke Codex, Claude or a physical worker. The test is explicitly
skipped on native Windows because this SDK is qualified only as Linux/WSL
source tooling. A green Windows job is not Windows setup acceptance.

### Prepare a concrete installation request

Before personal changes, record a named owner, the Pixoo and Hub source
revisions with successful CI, actual Node/client versions, execution OS and
client configuration layers. Inventory existing producers and Nanoleaf hooks.
Select exactly one state owner and one receipt per provider/source. Record
absolute Linux executable, package, client JSON, runtime and receipt paths
privately. Keep receipt directories and immediate configuration parents mode
0700 and regular, single-link files mode 0600, outside Git and `/mnt`.

Identify the actual client trust/approval process without changing permission
policies. Preserve managed-only hook restrictions. A client ignoring an
untrusted hook supplies no monitoring evidence; do not relax the restriction.
The historical version matrix above is not permission to set `qualified: true`.
Record missing signals and the exact accepted degraded mode, if any; otherwise
leave the producer disabled. Codex Desktop version and hook route remain a
required gap. Native Windows Claude setup is not provided by this package.

The owner reviews the full private before/after diff, credential principal,
backup location, intended service startup and rollback. Obtain explicit
installation and client-test authorization for that concrete plan. Never paste
full configuration diffs, bearer tokens, payloads or private paths into GitHub.

### Compose the shared SDK for an embedded Pixoo owner

The following is an API sequence for a separately authorized owner process,
not a script to run against discovered personal paths. Resolve imports from
this checkout's installed package. `input` names the explicit paths described
above; its `source` contains neutral `provider`, `client`, `hostId`, `sourceId`
and `hook: 'SessionStart'`. Use the provider/client pairs in the matrix.

```js
import {
  producerPrincipal, planSetup, applySetup, inspectSetup,
  planRemoval, removeSetup,
} from '@jimmie-potts/hub/setup';
import {pixooSetupAuthority} from '@jimmie-potts/hub/setup-authority';

const input = {
  directory: receiptDirectory, target: clientJson,
  source, endpoint: monitorEndpoint + '/events',
  node: absoluteLinuxNode, hook: installedSharedHook,
  owner: installationOwner, qualified: false, credentialFile,
};
const principal = producerPrincipal(input);
```

Provision that exact principal using Pixoo's built owning CLI before monitor
startup: `node <monitor-cli.js> add-control <private-data-directory> <principal>`.
Capture its one-time token privately in `credentialFile`, mode 0600. Embedded
Pixoo requires read/control scope; do not substitute an MCP/device credential
or claim an ingest-only scope. This credential grants monitor control as well
as ingestion. Use a separate read principal for status consumers. Configure
the private embedded owner as described above, then start it in simulator mode
for the initial trial with `PIXOO_MONITOR_ENABLED=1`, its explicit data directory
and loopback port. Stop through its named process owner using normal SIGINT or
SIGTERM; keep it running through removal so revocation can be confirmed.

```js
const authority = pixooSetupAuthority({
  dataDirectory, endpoint: monitorEndpoint,
  node: absoluteLinuxNode, managementEntrypoint: absoluteMonitorCli,
});
const plan = await planSetup(input);
// Review plan.before, plan.after and plan.digest privately before applying.
await applySetup(input, plan.digest, authority);
const status = await inspectSetup(input.directory);
// Review a fresh removal diff when removal is authorized.
const removal = await planRemoval(input.directory);
await removeSetup(input.directory, removal.digest, authority);
```

`monitorEndpoint` is the active owner's numeric IPv4 loopback URL ending
`/api/monitor/v1`. `installedSharedHook` is the absolute resolved
`@jimmie-potts/hub/monitor-hook` export, not Pixoo's earlier example hook.
Inspect is local status only; it does not prove client emission. Plan digests
bind the current configuration and receipt. Applying a stale plan fails.
Removal disables the producer, confirms credential revocation through the
owning CLI and HTTP, then removes only exact owned hook entries from the latest
configuration. Retain the private receipt and backup. Never restore the entire
backup over newer unrelated changes. Use a fresh receipt directory for a later
installation after confirmed removal.

For a standalone Hub owner, compose `hubSetupAuthority` with the exact running
host and its persisted configuration, following the pinned runbook. Do not use
Pixoo's remote facade as the ingestion target. Do not start a second owner or
share a database to make setup work.

### Host routing, trust and recovery

For WSL clients, the hook and owner use Linux loopback. For a Windows Codex
client, the shared `windowsDistribution` option constructs an explicit
`wsl.exe --distribution ... --exec ...` command using Linux paths. It assumes
no Windows-to-WSL TCP forwarding. Verify that client's actual command selection,
trust, distribution startup and bounded failure before qualification. Do not
silently move a Windows workflow to WSL. The option is unsupported for Claude;
its supplied setup path runs inside WSL. No router/firewall edits are part of
setup.

A silent hook exit is deliberate fail-open behavior, not evidence of delivery.
Inspect qualification/enabled state, exact executable availability, receipt
state, target ownership and owner reachability. The shared hook has a 2.9-second
process deadline once Node starts; distribution/executable startup is a separate
unqualified measurement. Inspect current authenticated snapshots and timestamps;
collector health cannot refresh a stale session.

On apply failure, retain the `applying` receipt and disabled producer, resolve
the conflict, and re-plan with the same input. On removal failure, retain
`removing` intent and restore access to the owner to verify revocation before
retrying. An edited or duplicated owned entry requires explicit reconciliation.
Never delete a receipt or restore a whole settings file to bypass the conflict.
For abandoned locks, establish that the recorded setup coordinator has exited
and no concurrent setup owns the target before the named owner removes only
the corresponding empty lock. See the upstream runbook for all three lock
locations and interrupted credential recovery.

Keep legacy Nanoleaf selected throughout packaging and initial Pixoo trials.
The earlier embedded example's Nanoleaf `clearOnNewTurn: false` policy is not
compatible with the released shared Nanoleaf consumer, which requires `true`.
If that policy exists in live state, stop for an explicit service-owned policy
migration; never edit an export or database to force cutover. Shared selection
can start Nanoleaf's physical worker and needs its own authorization.

Owner migration uses Hub's supervised quiesce/export/exit, fresh fenced import,
producer/consumer readiness and explicit activation. After accepted writes,
rollback exports the latest state into another empty host store. It does not
restart the occupied old embedded store. Preserve labels, notices, source
identities and consumer acknowledgment. Restore legacy Nanoleaf through its
owning `rollbackNanoleaf` operation when authorized, without resurrecting
unrelated deleted hooks. Mode restoration remains explicit and playback paused.

## Installed and physical acceptance sequence

[Issue #34](https://github.com/jimmie-potts/divoom-app-upgrade/issues/34) remains
the completion authority. Use the dated [hardware acceptance record](hardware-validation.md#issue-34-monitoring-acceptance)
for redacted results. For each case record pass/fail/blocked, timestamp, owner,
source revisions, actual client/device profile, expected/observed behavior and
limitations. Record Codex-first installed progress separately from required
Claude completion.

| Stage and issue criteria | Required observation and gate |
| --- | --- |
| Setup/removal, criteria 1–3 | Approved diff and private backup; repeated setup; unrelated hooks/trust intact; fresh removal after unrelated edits; exact credential revoked; ordinary app use continues. Source fixtures do not replace installed observations. |
| Each required client, criterion 4 | New turn, working, supported continuing-question/blocking-input/approval distinctions, turn-ended notice, new-turn clearing, explicit dismissal, interruption/runtime end and available child rollup. Preserve unknown/unsupported distinctions from the capability matrix. |
| Isolation and failure, criterion 5 | Two concurrent sessions in one project remain separate; collector outage, failed hook delivery, duplicate/delayed events, five-minute uncertainty and backend restart. Measure agent progress independently of monitor success; a healthy collector cannot refresh stale observations. |
| Durability and privacy, criterion 6 | Current labels/state/notices survive restart and 24-hour/10,000-event journal cleanup. Synthetic canaries for prompts, transcripts, tool arguments/output, copied titles and secrets are absent from transmitted payloads, state, logs and dashboard. Keep real payloads out of receipts. |
| Physical preflight, criterion 7 | Exact device IP, named test owner, model/firmware, approved sequence and display replacement, prior screen/brightness and restoration limits. Earlier rendering consent does not authorize this test. |
| Display, criterion 8 | Four rows, icons/short labels, attention total on every page, ten-second overflow, uncertainty/notices, native-size readability and exact preview. Record visible loading/timing separately from HTTP acknowledgment. |
| Mode/writer, criterion 9 | Monitor pauses advancement; hooks cannot select Monitor from Media; return leaves playback paused. Exercise mode changes during uploads, disconnect/reconnect and screen-off/on without stale replay or a second writer. |
| Nanoleaf/removal, criterion 10 | Legacy hooks work with monitor enabled, unavailable and removed. Only after separate cutover authorization verify shared input and rollback without duplicates. Revoke owned access, preserve other hooks and restore known display settings within limits. |
| Evidence, criterion 11 | Dated redacted receipt with exact profiles and separate source/CI, installation, real-client, transport and visible-device verdicts. Missing required observations keep the issue open. |
| Codex-first milestone, added criterion 1 | Qualified Desktop/CLI Windows/WSL routes and installation evidence; retain outstanding Claude gaps separately. |
| Shared frontend, added criterion 2 | Wait for Hub #6 and trial authorization; operate labels/filters, acknowledgment and Monitor/Media through that frontend. Observe the same task in Pixoo/Nanoleaf and independent behavior when either consumer is unavailable. |
| Physical latency, added criterion 3 | Measure event-to-visible timing separately from Hub #30 source/transport measurements; retain cadence/readability and restoration limits. |

Complete the source rehearsal before proposing personal installation. Complete
the authorized simulator/client sequence before the physical sequence. A failed
required case stays open with its owner and next action; do not convert source,
HTTP or preview results into visible-device passes.
