# ADR 0011: Offline local recovery

Status: Accepted for [issue #10](https://github.com/jimmie-potts/divoom-app-upgrade/issues/10).

The catalog and immutable files must be recovered together. Existing library
ownership already excludes another backend while the owner is open. Backup uses
that lock for the entire snapshot and copy. An online export would need additional
coordination with uploads, deletion and device settings; it is not needed here.

SQLite [VACUUM INTO](https://www.sqlite.org/lang_vacuum.html#vacuum_with_an_into_clause)
produces a consistent snapshot that includes committed WAL state. Copying only the
main database file does not. The library checks integrity, foreign keys, checkpoint
retention and cataloged media before export. A versioned manifest records the exact
file inventory and hashes. No archive dependency or arbitrary filesystem API is
introduced.

Restore requires a new private directory. It verifies the copied database and media
before clearing an incomplete marker. Failed outputs remain for inspection and
cannot be used as application data. This costs downtime and extra disk space, but
keeps the original available for rollback. Bundles are private trusted local data;
hashes provide damage detection, not authentication or encryption.

Native startup remains one manually started loopback simulator process. It owns
playback independently of the browser and needs an awake host. Shared hub hooks
and collection remain owned by agent-device-hub#8 and optional for ordinary media
operation. See [operations](../local-operations.md) for commands and failure handling.
