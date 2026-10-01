## Why

[Pixoo #96](https://github.com/jimmie-potts/divoom-app-upgrade/issues/96) lets B.U.N.N.Y. inspect the owning media catalog and exact rendered frames without issuing display commands.

## What Changes

- Negotiate read-only integration 1.1 while retaining 1.0 snapshots, commands and events.
- Serve paged media/playlists and immutable PNG previews with bounded authorized reads.
- Persist catalog revisions and expose the player selected item without claiming observed output.

## Capabilities

### New Capabilities

- `integration-catalog`: Native catalog consistency, current selection and frame preview reads.

### Modified Capabilities

None. Existing browser and command contracts remain unchanged.

## Impact

Native controller routes, Library migration and bounded preview reads, media verification and Hub consumer fixtures. No device profile changes or runtime installation.
