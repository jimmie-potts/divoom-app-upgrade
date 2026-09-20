# Shared agent monitoring

Issue [#31](https://github.com/jimmie-potts/divoom-app-upgrade/issues/31) composes
`@jimmie-potts/agent-state` 1.0.0 inside the existing backend. The vendored release
archive has SHA-256 `ae589d311e282c3356579c85507a3aa973ab7990e06e062143aeb08d8d2dcc99`.
The source receipt identifies Hub PR #105 and its immutable source. Pixoo supplies
storage and authenticated transport; the package supplies provider normalization,
reduction, deduplication, child rollup, freshness, retention and migration validation.

Monitoring is disabled by default. Enabling it does not activate hardware.
Simulator remains the default; existing explicit device mode remains available.
There is no monitor renderer or mode switch in this change. Monitoring never calls
the player, device adapter or writer, and does not depend on a browser being open.

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
| `GET /sessions?q=label&provider=codex` | Optional bounded label/neutral-session-ID substring and provider filter |
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

SSE events contain owner ID, revision, connection status, collector status and
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
