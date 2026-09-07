# ADR 0009: Browser state and command recovery

Accepted for issue #9.

The browser uses the existing same-origin HTTP API and native EventSource. React owns transient form drafts; the server owns saved media, playlists, settings and playback. No additional UI dependency or browser database is introduced. Type-only workspace imports share domain interfaces without bundling server code.

Playlist mutations carry the loaded revision. Conflicts preserve the local draft and offer an explicit reload. Saved playlist changes are separate from the player's immutable session. Move-up/down buttons support both keyboard and touch without requiring drag gestures.

Player and display controls share one browser submission lock. A lost response retains the original payload and identity. Retry uses that same identity. The user can instead reconcile current state and discard the uncertain intent. The browser never silently substitutes a fresh identity for an uncertain command. A completed command receipt triggers a fresh state read; it is not authoritative current playback state.

EventSource reconnects using its event identity. The browser ignores old or duplicate event sequences and fetches a fresh snapshot on accepted events. Disconnection is visible and disables commands until state has been reconciled. Reconnecting does not replay user intent.

Snapshots include a monotonic server sample beside playback deadlines. Remaining-time estimates use their difference and elapsed browser time. Network and rendering latency make these estimates, not device observations. Effective previews use immutable PNG frames and manifest delays, with independent illustrative animation.

Device settings remain explicit saved configuration. Neither the UI nor its tests enable physical transport or LAN access. No data migration is needed; rolling source/assets back preserves existing catalog and checkpoints.
