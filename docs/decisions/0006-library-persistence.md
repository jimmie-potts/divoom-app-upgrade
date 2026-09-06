# ADR 0006: SQLite catalog and reference-safe media lifecycle

Accepted September 6, 2026 for [issue #6](https://github.com/jimmie-potts/divoom-app-upgrade/issues/6).

## Decision

Add a backend-only `@pixoo/library` workspace. Use Node 24's bundled `node:sqlite`
with foreign keys, WAL, full synchronization and a one-second busy timeout for
short metadata transactions. Keep browser/core imports free of SQLite. This
avoids an additional native npm driver. Node labels this API release candidate;
[its documented stability](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
and the Node 24 runtime requirement remain part of the dependency decision.

Use ordered, checksummed SQL migrations. Unknown/newer catalogs fail closed.
Assets deduplicate by content hash. Immutable rendition manifests retain exact
renderer/profile/transform identities, and playlists point directly to them.
Expected revisions reject lost updates. Item UUIDs survive edits and reorder;
duplication creates new UUIDs. Single-frame GIFs use still-item policy validation.

A separate SQLite owner connection holds an exclusive transaction for the
library lifetime. OS lock release permits restart after a process crash without
PID-file expiry guesses. Serialize public operations under this owner. Local
storage must support SQLite locking. Multiple owners and direct writes through
another MediaStore into the managed directory are unsupported.

Persist session references until explicit release. Before deleting an asset,
reject playlist/session references. For unreferenced assets, commit catalog
removal and a cleanup journal together, then remove files. Retry unfinished jobs
on reopen and before import. Hash-only journal entries limit cleanup to recorded
media paths. Never infer that a crashed session expired.

## Consequences

SQLite and filesystem changes cannot share a transaction. The journal permits
idempotent deletion retry; complete unregistered renderer output is retained
for reuse. Startup recovery removes only owned staging directories. Backup and
general garbage collection need separate designs.

Synchronous metadata work and serialized media operations can delay callers.
The future API must bound submissions. The renderer still uses child processes
and its existing input limits. Persisted session references are not playback
checkpoints; playback, HTTP/UI integration and deployment remain separate issues.
