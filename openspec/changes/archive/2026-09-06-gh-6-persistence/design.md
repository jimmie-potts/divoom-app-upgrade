## Context

The media package already publishes hashed originals and immutable rendition directories with validated manifests. It has no catalog or deletion policy. The startup process only serves readiness; issue #6 adds a backend library and does not wire an API or playback engine.

## Goals / Non-Goals

Provide durable catalog/playlist operations and explicit session retention. Playback checkpoints, authentication, UI, backup/restore, device state and a general garbage collector remain later work.

## Decisions

- Use Node 24's bundled `node:sqlite` API with foreign keys, WAL, full synchronization and bounded busy timeout. It is release-candidate API in this runtime, not an independently versioned npm driver. An isolated `@pixoo/library` workspace keeps SQLite out of browser/core imports. SQL operations are short synchronous metadata transactions; decoding stays in media child processes.
- An independent SQLite owner database holds an exclusive transaction for the library lifetime. The OS releases its lock on process exit. This avoids stale PID lockfiles and competing filesystem writers. Public library operations serialize in the owning process. Direct MediaStore access to library-managed storage is unsupported; standalone stores must use another directory.
- Apply ordered checksummed migrations. Reject unknown/newer schemas and checksum mismatch. Use UUID asset/playlist/item/session identities; hashes deduplicate source content and immutable rendition manifests record renderer/profile/transform identity. Named playlists need not have unique names.
- Require expected revisions for playlist edits/deletion/duplication. Replacing items preserves supplied IDs belonging to that playlist and generates IDs for new entries. Reorder requires the exact item-ID set. Validate policies at every insertion/update against immutable effective frame count; single-frame GIFs count as stills for plays validation.
- Persist session-to-rendition references until explicit release, including across restart. They are retention records, not playback state or expiring leases. Duplicating/editing playlists does not mutate the referenced media or existing sessions.
- For asset deletion, a transaction checks playlist/session references, removes unreferenced catalog rows, and inserts a durable cleanup job containing validated hashes rather than arbitrary paths. Physical deletion follows. Failure retains the job, and imports first drain pending deletions so identical content cannot race cleanup. Reopen retries jobs and cleans only owned request staging under the dedicated library media directory.
- A failed metadata commit can leave complete unregistered renderer output. Preserve it and any original it may still need for safe reuse; do not sweep unknown complete files. When an unregistered manifest cannot be interpreted, retain the original conservatively. Normal failed decode paths remove staging, and restart removes abandoned request staging after ownership is acquired. File errors never justify deleting referenced or unrelated files.

## Risks / Trade-offs

- SQLite metadata calls are synchronous: keep transactions small, cap playlist entries, and retain separate background media decoding. Worker-based database access can be evaluated if measured latency requires it.
- Filesystem/SQLite cannot commit together: the durable deletion journal supports idempotent retry, while complete unregistered outputs are preserved.
- Active sessions can retain files indefinitely after a crash: explicit release by the future playback/recovery owner is safer than guessing that they expired.
- One owner excludes multiple backend processes sharing a directory; a second owner receives a typed busy error. Readiness startup remains unchanged.

## Migration Plan

Create version 1 catalog/cleanup tables and version 2 playlists/items/session references. Migrations retain earlier committed rows and roll back each failed step. No downgrade or automatic database reset is offered. Existing standalone media directories remain untouched; the library owns a dedicated subdirectory of configured data storage.
