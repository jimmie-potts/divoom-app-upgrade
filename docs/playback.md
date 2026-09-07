# Playlist playback

`@pixoo/playback` orchestrates immutable playlist sessions through one device
adapter. `LibraryPlaybackStore` persists context and retains media in the existing
private SQLite catalog. This is a backend library. Startup connects it through the [HTTP API](api.md).
The [browser UI](controller-ui.md) exposes the controls and labels timing as estimated.

## Create a player

Build with Node 24 and `npm run build`. Supply the application's resolved private
library directory and one adapter. Use `FakeDeviceAdapter` for software work.

```ts
import { Library } from '@pixoo/library';
import { FakeDeviceAdapter } from '@pixoo/device';
import { Player, LibraryPlaybackStore } from '@pixoo/playback';

const library = await Library.open({ directory: libraryDataDirectory });
const player = await Player.open({
  store: new LibraryPlaybackStore(library),
  device: new FakeDeviceAdapter(),
});
await player.start(playlistId);
console.log(player.getState());
```

The owner must retain these objects for the backend lifetime. During shutdown,
close the player before the library:

```ts
await player.close();
await library.close();
```

Opening an existing checkpoint restores paused context and sends no device
requests. Starting or resuming is explicit. One player may claim a library and
adapter at a time; duplicates fail with `PlaybackError('busy')`. The library's
SQLite owner also excludes another process using that storage directory. The
installation owner must still supply only one adapter/backend for its configured
device. Separate installations cannot establish exclusive physical ownership
through this in-process lease.

## State and commands

`getState()` returns a defensive copy with state, intent, adapter availability,
session ID, captured playlist ID/revision, current item ID, generation, last
error, requested screen state and optional timing estimates. States are `idle`,
`loading`, `playing`, `paused`, `reconnecting` and `error`. Intent is independently
`active`, `paused` or `stopped`. Availability describes adapter responses, so an
available fake does not mean a connected physical display.

| Method | Behavior |
| --- | --- |
| `start(playlistId)` | Atomically capture a fresh nonempty playlist snapshot and start its first item |
| `restartWithChanges()` | Start a new session from the current saved revision of the captured playlist |
| `pause()` | Cancel advancement and pending work; preserve current context |
| `resume()` | Reupload current context and restart its full policy |
| `stop()` | Cancel future transitions and leave content; retain context |
| `next()` / `previous()` | Retire pending work before navigation; paused/stopped navigation sends no artwork |
| `probe()` | Check adapter availability through the writer and publish observed state |
| `setBrightness(percent)` | Submit a 0-100 integer control through the adapter FIFO |
| `setScreen(on)` | Off pauses and cancels transitions; on does not resume |
| `offline()` | Report observed connectivity loss and suspend active orchestration |
| `takeover()` | Report external control, pause, and require explicit resume |
| `clear()` | Stop and explicitly release the checkpoint and its retained media references |
| `close()` | Cancel work, persist paused context, and release the player lease |

Playback command promises settle after context work, without waiting for the
item's dwell. Callers should await or handle rejected promises. Display controls
return the adapter result. A screen command superseded before writer submission
returns `undefined`; the API layer must report it as cancelled. Simultaneous
screen requests preserve the latest requested state. `requestedScreenOn` is a
request record, not telemetry proving that the display changed.

Saved playlist edits never change an active snapshot. Pause stops playlist
advancement; the device GIF may keep looping. Resume uploads the same immutable
rendition from the beginning. Stop and repeat-off completion leave the last
content displayed. None of these commands claims frame-level device pause.

## Timing and traversal

Pass the same monotonic `Clock` to the player and adapter when testing. The
default is `systemClock`. Clock callbacks must be asynchronous, including zero
delay. `random` can also be injected for deterministic shuffle.

Loading includes complete frame upload and the adapter's estimated ready delay.
Only then does dwell begin. A duration can interrupt a GIF. A plays policy uses
`totalPlays * sum(effective uploaded frame delays)`; three plays means three total
executions. Embedded GIF repeat metadata is irrelevant. Overflowing or invalid
computed dwell rejects the item before upload. A still uses a positive 100 ms
transport placeholder, while its duration policy exclusively determines dwell.
This placeholder has no physical timing claim.

`estimatedReadyAtMs` and `dwellDeadlineMs` exist only in the current clock domain.
The state labels timing `estimated`. A late callback advances one item and starts
its new loading/dwell normally; it never bursts through missed intervals. These
software estimates cannot establish observed finite plays on hardware.

Shuffle uses a permutation per forward cycle. It avoids matching the prior item
at a cycle boundary when there is another item. History contains only items that
reached estimated readiness, so failed or superseded loading attempts do not
become invented playback history. Previous follows that history; next can walk
forward through it before extending the current cycle. The last 10000 visits are
retained. Reaching the earliest retained visit restarts that item rather than
inventing an earlier selection.

The player caches at most two complete renditions and prepares a known upcoming
item while the current one plays. A new shuffle cycle can require loading when
its order is selected. Preparation reads backend storage only; it never uploads
an inactive animation to the display. Media byte/frame/profile limits still
apply. Cancelled reads may finish bounded filesystem work, but their generations
cannot produce output.

## Writer and failure handling

All device effects pass through the adapter's existing serialized queue. Explicit
stop, pause, navigation, session changes and reconnect cancellation retire old
adapter work. Automatic dwell advancement retires player callbacks while letting
already queued brightness/screen controls finish before the next upload. The
player's generation is distinct from the adapter's writer generation.

Connectivity errors from upload or display controls suspend dwell. Recovery
probes default to delays of 250, 500 and 1000 ms, with a 5000 ms operation timeout.
Options allow `retryBaseMs` 1-1000, `maxRetries` 1-8 and `operationTimeoutMs`
1-120000. The retry budget covers successful probes followed by failed uploads;
only an item reaching estimated readiness resets it. Exhaustion enters error
with paused intent. Explicit resume starts a new bounded attempt.

Invalid media and rejected uploads retain a visible item error and can skip to
the next item. If every item fails before another successful start, attempts end
in error. Stop/pause supersede reconnect results; a successful stale probe cannot
restart playback. Persistence errors cancel orchestration before an uncommitted
transition can upload. `lastError` records a code and, when applicable, item ID.

`takeover()` is an integration-owned observation. This package does not invent
firmware/channel detection or periodically reclaim the display. An adapter
reporting an externally retired generation also pauses the player. Using the
official Divoom app simultaneously can replace content; automatic takeover
detection needs separate verified telemetry. Cancellation cannot undo an
in-flight device request that already applied.

## Checkpoint storage and verification

Migration 3 adds one versioned checkpoint tied to retained session references.
It stores the immutable playlist snapshot, forward order/cursor, selected item,
played frontier, bounded history/cursor, state/intent context, requested screen
state and last error. It stores no process-monotonic timestamps. Reads validate
both the payload and its retained session/rendition ownership. Snapshot mutation
and stale session saves fail. Replacement and reference changes commit together.

The library exposes `createPlaybackCheckpoint`, `getPlaybackCheckpoint`,
`savePlaybackCheckpoint` and `clearPlaybackCheckpoint` for the store adapter.
When a player owns the library, use its commands for these operations. Releasing
its session directly fails with `checkpoint-owned`. Stopped and paused contexts
continue retaining media until replacement or explicit clear. A player close
preserves recovery context; it does not delete user data.

Fake-clock tests cover timing, late callbacks, history/shuffle, commands during
loading, display races, retry exhaustion and takeover. SQLite integration tests
cover immutable snapshots, stale writes, corrupt ownership, rollback and recovery
after killing a child process. No test contacts hardware. The
[playback specification](../openspec/specs/playlist-playback/spec.md) and
[ADR 0007](decisions/0007-playback.md) record the behavior and design.

`getSession()` returns a defensive copy of session ID and captured playlist.
`subscribe(listener)` returns an unsubscribe function; listeners read state on
notifications. Observer failures do not interrupt playback. The HTTP layer uses
these notifications for SSE and keeps command/event sequences separate.
