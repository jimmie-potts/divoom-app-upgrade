## Why

[Issue #25](https://github.com/jimmie-potts/divoom-app-upgrade/issues/25) lets local agents choose existing media and control its playback through the application. Delivered #24 supplies authenticated MCP access and shared display admission; media selection needs the same replay identity plus safe immutable session capture.

## What Changes

- Add bounded list_media and list_playlists queries and explicit show_media, play_playlist and control_playback tools.
- Share player command admission across HTTP and MCP through the delivered ControlService and Commands instance.
- Validate selection, revision, policy and active profile before replacing playback context, including concurrent cancellation and edits.
- Retain temporary single-media sessions without creating saved playlists, and restore them paused after restart.
- Show temporary-media context accurately in the existing player panel and disable its saved-playlist restart action.

## Capabilities

### New Capabilities

- `mcp-media-playback`: Bounded catalog selection and authenticated media/playback tools.

### Modified Capabilities

- `local-mcp-controls`: Extend the fixed tool set and permit bounded catalog metadata only in catalog-tool results.
- `library-persistence`: Atomic guarded capture and temporary-session retention.
- `playlist-playback`: Validated admission before cancellation, temporary context and recovery.
- `controller-api`: Shared player command replay across transports.
- `controller-ui`: Accurate temporary-media labels and available actions.

## Impact

Library checkpoint/query contracts, playback admission, ControlService, MCP extensions and the existing player panel change. Shared MCP transport, credentials, device ownership and the physical profile stay under their delivered contracts. No dependency upgrade, upload/import tool, playlist editing tool, personal installation or physical operation is part of this change. Issue #26 owns actual local Codex/device acceptance. The small visible player-panel change receives browser validation and normal independent review.
