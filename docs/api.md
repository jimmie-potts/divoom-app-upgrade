# Controller HTTP API

The local Fastify server opens the private library and one player at startup,
using the explicitly selected mode and immutable device configuration. Existing sessions restore paused. All routes are under `/api`; the [browser UI](controller-ui.md) uses these routes for media, playlists, player and settings.
No route activates or retargets a physical adapter. Device mode requires an
explicit backend restart with valid private settings.
Startup disables fake-adapter frame/operation recording so repeated playback
does not retain an ever-growing test history.

## Request security and errors

The listener binds `127.0.0.1`. Host must be `127.0.0.1` or `localhost` at the
actual listener port. An Origin, when present, must equal the HTTP origin of that
Host. Cross-site fetch metadata is rejected. Originless mutations, including
command-line clients, must send `X-Pixoo-Request: 1`. JSON mutations use
`Content-Type: application/json`. Browser calls from the served page use its
same origin. There is no wildcard CORS, proxy-header trust or LAN mode.

An optional `createApp({ authenticate })` hook can require authentication for
API reads, writes and streams. It receives the Fastify request and returns a
boolean or promise. Denial returns 401; exceptions return a sanitized 500.
This is an integration hook, not a session/login implementation or proof of
secure LAN deployment. The secure deployment issue owns that work.

Errors have `{ error: { code, message, details? } }`. Invalid fields return 400,
missing entries 404, revision/reference/request conflicts 409, expired command
identities 410, unsupported media 415, media conversion limits/failures 422,
capacity limits 503, and internal storage failures 500. Oversized uploads or
bodies return 413. Multipart shape errors can return 400. Native errors and
filesystem paths are never returned. Reference errors identify blocking playlist
and session IDs; revision errors include expected and actual revisions.

Shared strict request schemas and the error envelope live in `@pixoo/core`.
Unknown fields fail validation. Library validation remains the final domain gate.
No generic filesystem, raw device command or remote-URL import route exists.

## Media and playlists

| Method and route | Body or result |
| --- | --- |
| `GET /health` | Server readiness, selected mode and observed nullable device connectivity |
| `POST /assets` | Multipart with exactly one file part named `file`; returns `{asset,rendition}` with 201 |
| `GET /assets?offset=0&limit=25&q=` | `{items,total,offset,limit}`; name search, limit 1-100 |
| `GET /assets/:id` | `{asset,renditions}` |
| `POST /assets/:id/renditions` | `{transform?: {fit,scaling,background}}`; returns `{status:"complete",asset,rendition}` after worker completion |
| `DELETE /assets/:id` | 204, or reference error preserving the asset |
| `GET /renditions/:id` | Validated immutable manifest |
| `GET /renditions/:id/frames/:index.png` | Effective PNG frame by validated hash/index |
| `GET /playlists` | Playlist array with ordered items and revisions |
| `POST /playlists` | `{name,repeat?,shuffle?}`; 201 |
| `GET /playlists/:id` | Current playlist |
| `PATCH /playlists/:id` | `{revision,name}` |
| `PATCH /playlists/:id/options` | `{revision,repeat?,shuffle?}`, at least one option |
| `PUT /playlists/:id/items` | `{revision,items}`; each item has `renditionId`, optional existing `id` and `playback` |
| `PUT /playlists/:id/order` | `{revision,itemIds}` containing the exact current ID set |
| `POST /playlists/:id/duplicate` | `{revision,name}`; 201 with a new playlist and item IDs |
| `DELETE /playlists/:id` | `{revision}`; 204 |

Successful edits return the new playlist and revision. A multi-field editor
submits the dedicated operations with each returned revision; these routes do
not pretend multiple requests form one transaction. Saved edits affect the next
session until an explicit restart-with-changes command. Still defaults are
30000 ms; animation defaults are three total plays. See [library contracts](library-persistence.md).

Uploads are limited to 10 MiB and validated by signatures, source pixel budget
and the renderer profile. The whole bounded multipart body is validated before
import, so an extra part cannot fail after catalog publication. Filenames are
display metadata, never paths. Originals and referenced renditions are preserved.
The API admits at most four concurrent media requests and 32 requests overall,
including authentication waits. JSON bodies are capped at 64 KiB. The HTTP
request timeout is 30 seconds; renderer timeout and queue timing remain separate.

## Player commands and replay

`GET /player` returns:

```ts
{
  sampledAtMs: number, // server monotonic clock sample
  serverId: string,
  nextRequestId: string,
  player: PlayerState,
  session: null | { id: string, playlist: Playlist }
}
```

The session contains the captured immutable playlist, including its revision and
items. Player state separates intent, adapter availability and estimated timing.
Physical connectivity remains false in simulator mode. `sampledAtMs` shares the player deadline clock domain. Clients estimate remaining time from the deadline minus this sample, then subtract elapsed browser time. Replayed event timestamps are historical; fetch a current snapshot for a fresh estimate. Health does not become
unready when playback is paused, in error or reconnecting.

Send `POST /player/commands` with `requestId` from a fresh player snapshot and
`command`: `start`, `pause`, `resume`, `stop`, `next`, `previous`,
`restart-with-changes` or `clear`. Only `start` also requires `playlistId`.
Responses are snapshots after command context work; upload/dwell can still be
loading. The [playback guide](playback.md) defines each control's semantics.

Request IDs are `<server UUID>:<positive sequence>`. The server reserves the next
identity before execution. Retrying the same payload and ID shares the original
promise and returns its original result, including failures. Reusing an ID with
another payload returns `request-conflict`. If two clients race with different
commands, the loser reloads state and submits its intended action with the new
identity. Never automatically replace an ID merely because a response was lost.

The last 256 completed results are retained. Earlier sequence numbers return
`request-expired`; future sequences return `request-order`. A restarted server
has a new UUID and rejects every old identity. Clients must reconcile current
state before issuing fresh intent after a restart. This prevents retries from
silently executing twice without retaining an unbounded command journal.

## Device settings and controls

`GET /device` returns saved `configuration` or null, selected `mode`,
`connected`, observed adapter `availability`, `activeConfiguration`,
`restartRequired`, `activeProfile` and supported `profiles`. Simulator connectivity
is false and active configuration is null. Device connectivity starts null;
observed available/offline transport maps to true/false without visual claims. `PUT /device` accepts `{ip,profile,model?,firmware?}`.
IP must be canonical RFC1918 IPv4. Profile is `simulator-v1` or
`pixoo64-smoke-2026-09-06`. Port/path/URL overrides and unknown fields are rejected.
Saving never changes the running adapter or active render profile. In device mode,
`restartRequired` reports when saved settings differ from the active snapshot.
Device startup requires the smoke profile; saving simulator settings during a
device session is valid for storage but requires changing mode or profile before
that next startup.

Settings are stored in versioned `device.json` under the private data directory.
Replacement is atomic and writes are serialized. Invalid existing settings fail
startup without resetting them. Concurrent setting writes complete in submission
order. No credentials are accepted or needed.

`POST /device/probe` takes an empty object or no body and probes the selected
adapter through the player-owned writer. It reports mode and adapter availability;
simulator connectivity stays false. Device success reports transport connectivity
and only the telemetry returned by the probe. Ordinary status reads do not probe. `PATCH /device/display` takes `requestId` plus exactly one of
`brightness` from 0-100 or boolean `screenOn`. It uses the same replay sequence as
player commands and returns a player snapshot. Off pauses orchestration; on does
not resume. Device writes with possible prior effects pause playback and retain
the uncertainty marker until fresh explicit intent.

Device composition reuses the validated private IPv4 transport on port 80 and
`/post`, with no redirects. The separately invoked spike remains outside these
routes; reset-ID and raw protocol commands are not exposed.
[Protocol documentation](protocol-spike.md) defines its separate authorization.

## State events

`GET /events` is an SSE stream. Events have `id: <stream UUID>:<sequence>`,
`event: state` or `event: resync`, and a JSON snapshot matching `GET /player`.
A new connection receives a full resync. Event identities use their own sequence,
independent of command IDs.

Reconnect with `Last-Event-ID`. A retained identity replays later events; an
unknown epoch, invalid/future ID or expired history sends a full resync instead.
Clients replace their state on resync and ignore already processed event IDs.
A stream disconnect does not stop playback. Command responses remain receipts;
use a fresh snapshot or state event for the current state.

The server keeps 32 events, permits 16 stream clients and sends comment heartbeats
every 15 seconds. A backpressured client gets up to five seconds to drain; another
event while it remains blocked disconnects it. Reconnect then uses replay/resync.
Shutdown ends streams before closing the player and library. These tests use local
HTTP and fake-device state; they do not establish authenticated phone access or
observed display timing.

## Runtime diagnostics

`GET /api/diagnostics` reports uptime, mode, library readiness, adapter availability,
player state/intent and fixed transient bounds. It uses the same host/origin and
authentication boundary as other API reads. It excludes paths, IPs, media names
and raw errors. Readiness is not a disk integrity scan or a hardware claim. See
[local operations](local-operations.md) for CLI diagnostics and offline verification.
