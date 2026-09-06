## Why

Issue [#6](https://github.com/jimmie-potts/divoom-app-upgrade/issues/6) needs durable metadata and reference protection before playlist playback and editing APIs can use the immutable media outputs from #5. Today those outputs have no playlist or session ownership records.

## What Changes

- Add SQLite migrations, validated asset/rendition metadata, stable playlist item identities and optimistic playlist revisions.
- Support named playlist operations, repeated assets and per-item duration/total-play policies.
- Retain session references across restart and reject referenced-asset deletion with actionable errors.
- Coordinate filesystem deletion with durable cleanup records and recover owned partial files without sweeping unrelated data.

## Capabilities

### New Capabilities
- `library-persistence`: private media catalog, revisioned playlists and session-aware file lifecycle.

### Modified Capabilities
None. The renderer keeps its existing immutable output contract; a metadata read method exposes its existing validation.

## Impact

Add a backend `@pixoo/library` workspace using Node 24 SQLite and the media package. Extend media metadata access without changing rendering. No HTTP endpoints, UI, playback engine, device operations or application installation are included.
