## Context

Issue #96 extends the strict integration snapshot consumed by Hub #353. Pixoo owns the private catalog and immutable renditions. Persistent state and concurrent reads require a design artifact.

## Goals / Non-Goals

Expose existing names, rendition identities, playlists and exact PNG frames. Preserve native authorization, device queue ownership and legacy 1.0 behavior. Do not import assets, select media, change device profiles or expose private storage.

## Decisions

Snapshot query `apiVersion=pixoo-integration/1.1` selects 1.1; omission selects 1.0. Commands and event streams stay 1.0. Consumers poll the negotiated snapshot for catalog changes. Monitoring remains required for this extension.

A transactional SQLite revision counter advances on catalog changes. Each list/detail reads its revision and payload in one serialized operation; clients refresh when revisions disagree across requests. Retention/checkpoint changes do not advance the catalog revision. The current-media object describes the player's captured selection, including captured playlist revision and zero-based saved-item position. It is never physical observation.

Preview reads use the immutable catalog manifest, verify the cached manifest and requested PNG hash, and never decode the source. They do not reread every frame for each frame request. Native read admission bounds active/queued reads and applies a deadline including the Library queue. Aborted queued work checks cancellation before touching storage. Requested PNG data is verified fully before response delivery.

Strong ETags hash the actual bytes. Authorized preview responses use private long-lived immutable caching. Authorization and catalog membership are checked even for conditional 304; catalog JSON remains no-store. A deleted rendition returns 404.

## Risks / Trade-offs

An application-owned catalog manifest is trusted only after identity validation against its cache manifest. Individual-frame verification guarantees requested bytes; other frames may fail independently. Consumers must not present an incomplete frame load as a complete animation. Existing 1.0 events do not carry catalog revisions, so consumer polling is required.

## Migration Plan

Migration 4 adds the revision record without rewriting media or playlists. Existing migration checksum checks and transactional rollback remain intact. Downgrade after migration is unsupported, as with existing migrations. No installed database is migrated by source tests.

## Open Questions

None for source implementation. Broader physical playback qualification remains #55.
