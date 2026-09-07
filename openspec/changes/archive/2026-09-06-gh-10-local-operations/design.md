## Context

See proposal.md for motivation. The existing native entrypoint serves a production
Vite build through Fastify on loopback. Library ownership uses a lifetime SQLite
exclusive lock; the catalog is WAL-backed. Media files are immutable and verified
by their renderer manifests. Player recovery already restores saved context paused.
Design is required for persistence, concurrency and recovery.

## Goals / Non-Goals

Provide recoverable private data and local diagnostics using the existing Node 24
stack. No OS service or hook installer, live-data migration, LAN exposure, physical
transport or shared-hub dependency is introduced.

## Decisions

- Offline commands acquire the same library owner lock as startup. This includes
  ordinary migration/staging recovery before export. Online backup was considered
  but would need a second protocol for freezing catalog and media mutations.
- Use SQLite VACUUM INTO with a bound destination to include committed WAL state.
  Copying only catalog.sqlite loses WAL commits. Verify integrity, foreign keys,
  checkpoint retention and every cataloged rendition before exporting.
- A versioned directory bundle uses an allowlisted relative inventory and streamed
  SHA-256 hashes. Include optional validated device.json; omit staging, locks,
  unknown files and logs. No archive library or executable restore script.
- Require a new destination with an incomplete marker before copying. Keep failed
  outputs for inspection; never recursively remove a destination after failure.
  Startup rejects incomplete output. Remove the marker only after verification;
  restore performs validation on the new copy, never opens the source bundle as
  a mutable library. Existing targets are always rejected, including empty ones.
- Reuse the existing cache/request bounds and disabled per-request logging.
  Diagnostics return a small fixed response with runtime state and documented
  bounds. No disk scans or new persistent logging on the health path.

## Risks / Trade-offs

- Backup requires downtime and extra disk space. Failed or interrupted directories
  must be inspected and removed by their owner before reusing the name.
- Hashes detect accidental damage, not malicious replacement of both data and
  manifest. Keep bundles private and accept only trusted local backups.
- Filesystems and power failures can defeat durability despite completed writes.
  Sync copied files, verify each restore, retain the original data until acceptance,
  and avoid network shares. No hardware timing or installation claim follows.

## Migration Plan

No catalog migration. Build and run against isolated data for source acceptance.
An operator later stops their backend, backs up, restores into a separate path,
sets PIXOO_DATA_DIR and starts the same native command. Rollback selects the
preserved original directory with the backend stopped. Never run two owners.
