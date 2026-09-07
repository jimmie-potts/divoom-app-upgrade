# Media and playlist persistence

`@pixoo/library` stores a media catalog, revisioned playlists and session retention
records in SQLite. It uses `@pixoo/media` for original files and immutable frames.
This is a backend library. Startup serves the [controller UI](controller-ui.md);
the [playback package](playback.md) integrates through its library store.
The [HTTP API](api.md) exposes uploads and revisioned edits. The browser library and editor use those routes.

## Open and close

Build with Node 24 and `npm run build`. Pass a dedicated absolute directory
outside Git, normally `join(config.dataDirectory, 'library')`. The library does
not read environment variables. The caller supplies the resolved application
configuration and owns the library lifetime.

```ts
import { createReadStream } from 'node:fs';
import { Library } from '@pixoo/library';

const library = await Library.open({ directory: libraryDataDirectory });
try {
  const { asset, rendition } = await library.importMedia(
    createReadStream(uploadPath), 'photo.png',
  );
  const playlist = await library.createPlaylist('Evening');
  const edited = await library.replaceItems(playlist.id, playlist.revision, [
    { renditionId: rendition.id, playback: { mode: 'duration', durationMs: 30000 } },
  ]);
  const preview = await library.readFrame(rendition.id, 0, 'png');
  // Keep edited.revision for the next edit; asset.id identifies the original.
} finally {
  await library.close();
}
```

One owner holds an exclusive SQLite transaction in `owner.sqlite` until close or
process exit. A second owner receives `LibraryError` with code `busy`. Do not
remove or replace an open owner file. Local filesystem locking is required;
shared network filesystems are unsupported. Use another directory for a standalone
`MediaStore`; direct writes into library-managed media storage are unsupported.

Operations serialize, including rendering and deletion. `close()` stops new
requests, drains submitted operations, and releases both database connections.
It is idempotent. The caller must bound submissions; this library is not an HTTP
admission controller. Renderer byte/pixel/decode limits still apply, but time
waiting in the library queue precedes the renderer's own timeout.

## Catalog and immutable renditions

`importMedia(stream, name, options?)` accepts the renderer's transform, profile
and abort signal. Content hashes deduplicate originals. Reimporting identical
bytes retains the first asset UUID, name and creation timestamp. Display names
are trimmed, 1-120 characters, without control characters. Names are metadata,
never filesystem paths. `getAsset` and `listAssets` return source format,
dimensions, frame count, delays and duration alongside the hash and identity.

`renderAsset(assetId, options?)` creates or reuses an immutable rendition for an
existing original. Its ID includes content, transform, profile and renderer
version. Existing playlist/session references keep their exact rendition ID.
There is no mutable current-rendition pointer. `listRenditions(assetId)` lists
cataloged manifests, including after restart. `getRendition(id)` verifies the
stored manifest, original and cached output. `readFrame(id, index, 'rgb'|'png')`
returns a fresh validated frame buffer. `readRendition(id, signal?)` loads all
RGB frames and the verified manifest together for bounded player preparation. Read failures do not repair or replace
media. See [rendering](media-rendering.md) for decoding and timing behavior.

Storage contains `catalog.sqlite` and its SQLite sidecars, `owner.sqlite`, and:

- `media/originals/<content-hash>` for byte-identical uploads.
- `media/renditions/<rendition-id>/` for manifests, RGB frames and PNG previews.
- `media/staging/request-<six characters>/` for incomplete render jobs.

Keep the entire directory private and outside Git. Future backup work must account
for SQLite WAL and in-flight operations; copying an open database file alone is
not a supported backup procedure.

## Playlist editing

`createPlaylist(name, { repeat?, shuffle? }?)` starts at revision 1, repeat on,
shuffle off. Names need not be unique. `getPlaylist(id)` and `listPlaylists()`
return ordered items with stable UUIDs. The editing operations are:

| Method | Behavior |
| --- | --- |
| `renamePlaylist(id, revision, name)` | Rename and increment revision |
| `setPlaylistOptions(id, revision, options)` | Edit repeat/shuffle and increment revision |
| `replaceItems(id, revision, items)` | Atomically replace entries and increment revision |
| `reorderItems(id, revision, itemIds)` | Require the exact current ID set, reorder and increment revision |
| `duplicatePlaylist(id, revision, name)` | Copy policies/references into a new revision-1 playlist with new item IDs |
| `deletePlaylist(id, revision)` | Remove the playlist and its entries |

Every operation on an existing playlist checks its expected revision. A stale
edit returns `revision-conflict` with `expectedRevision` and `actualRevision`.
Failed edits leave items, metadata and revision unchanged.

Each replacement entry has `renditionId`, optional `id`, and optional `playback`.
Preserve an existing item's ID when editing it; omit ID for a new entry. Supplied
IDs must belong to the playlist and occur once. Each playlist supports at most
1000 entries. Repeated renditions may have different policies.

Duration policies use `{ mode: 'duration', durationMs }`. Plays policies use
`{ mode: 'plays', totalPlays }`. Values must be finite positive safe integers.
Default still duration is 30000 ms; animations default to three total plays.
Only renditions with more than one effective frame accept plays. Single-frame
GIFs use still-item policy validation. The playback package executes these policies; this persistence package has no
clock or physical play-count claim.

## Retention and deletion

`retainSession(renditionIds)` creates a persisted UUID and unique rendition set.
`listSessions()` returns these records after restart. `releaseSession(id)` removes
a session's references and is idempotent. Sessions do not expire automatically.
The playback/recovery owner must release them deliberately. Standalone session
records remain retention records; the playback package uses a separate checkpoint
tied to a retained session. Direct release of that session fails with
`checkpoint-owned` until its checkpoint is replaced or cleared.

`deleteAsset(id)` checks every rendition for playlist and session references.
An `asset-referenced` error includes `assetId`, `playlistIds` and `sessionIds` so
the caller can identify blockers. Removing a playlist does not release a session.
Referenced assets and their files remain intact.

For an unreferenced asset, one transaction removes metadata and records a cleanup
job with validated hashes. File deletion follows. If it fails, `cleanup-pending`
identifies the asset; the asset is already absent from the catalog. Correct the
storage problem and call `retryCleanup()` or reopen. Reopen retries unfinished
jobs before returning, and imports drain them before accepting new content.

Normal failed imports clean their staging. After acquiring ownership, reopen
removes abandoned staging directories matching the renderer's request naming
pattern. It preserves unknown names, symlinks and complete outputs. A crash or
metadata failure after renderer publication may leave complete unregistered
files. Cleanup retains any original they still need. If an unregistered
manifest cannot be interpreted safely, cleanup conservatively retains the
original. Reimport can catalog complete outputs again; no broad garbage
collection runs.

## Migrations, errors and evidence

Migration 1 creates assets, immutable renditions and cleanup jobs. Migration 2
adds playlists, items and session references. Migration 3 adds the versioned
[playback checkpoint](playback.md#checkpoint-storage-and-verification). Each migration has a SHA-256 ledger
entry and commits atomically. Failure rolls back that migration while preserving
previous versions and data. Unknown application IDs, newer versions, altered
checksums and inconsistent unversioned catalogs fail without resetting data.
There is no automatic downgrade or destructive recovery.

`LibraryError.code` distinguishes invalid input, missing entries, revision
conflicts, references, ownership, closure, migrations, transactions, pending
cleanup, storage failures and catalog inconsistency. Renderer failures remain
`MediaError`. Messages omit native errors and private paths.

Isolated integration tests cover restart persistence, abrupt process exit,
policy validation, stale edits, item identity, immutable cache changes, reference
protection, cleanup retry and migration rollback. They do not contact hardware.
The [persistence spec](../openspec/specs/library-persistence/spec.md) defines the
capability; [ADR 0006](decisions/0006-library-persistence.md) records the design.

## Media selection and catalog pages

`queryMedia({q,offset,limit}, profile?, stillDelayMs?)` returns one bounded summary
per rendition, with asset/rendition identities and active-profile compatibility.
`queryPlaylists({q,offset,limit})` returns revisioned summaries and item counts.
Both cap pages at 100, order with stable ID tie-breakers and count/select within
one queued operation. Separate requests do not freeze the catalog between pages.

`createPlaybackCheckpoint` accepts an expected revision and guarded capture
options for its player owner. `createMediaCheckpoint` retains one existing
rendition and explicit media source without inserting saved playlists. Validation,
checkpoint replacement and reference changes share a transaction. Its synchronous
adoption callback runs after commit before the queue yields. Callers must use
nonthrowing adoption and must not perform async work in the transaction.

Checkpoint source metadata is immutable on save. Older source-less checkpoints
remain readable. A temporary session's generated internal traversal snapshot ID
is not a saved playlist identity. Reference checks, offline verification and
paused recovery preserve its actual asset and rendition until replacement/clear.
