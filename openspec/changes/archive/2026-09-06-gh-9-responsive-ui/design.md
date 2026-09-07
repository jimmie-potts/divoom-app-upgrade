## Context

See proposal.md. The API already serializes device effects, captures immutable sessions and rejects stale revisions. The browser currently only fetches readiness. This change crosses editor state, asynchronous commands and live events, so design is applicable.

## Goals / Non-Goals

Use the server as the owner of catalog and playback state. Keep drafts local until an explicit save. Preserve loopback and simulator boundaries. No new dependencies, router, login, LAN listener, hardware activation or browser persistence of media/device details.

## Decisions

Use four native-button views in the existing React application, with a persistent player summary and semantic forms. Move-up/down buttons provide keyboard and touch reorder without a drag dependency. Keep the existing green palette and use a compact workspace layout.

Each editor mutation uses the last loaded revision. A conflict preserves the draft and offers explicit reload; never silently retry against a new revision. Successful dedicated operations replace their own saved state. Selection changes are explicit and discard only that view's unsaved draft.

Player/display mutations share a browser lock and server-issued request identity. A transport failure retains the exact URL/body for explicit retry. Reconciliation can discard uncertain intent after a fresh read, but never reissue it with a new ID. Server command receipts do not replace current state; fetch a fresh snapshot after completion.

Native EventSource handles reconnect and Last-Event-ID. Ignore duplicate/older IDs within an epoch. On a newer event, fetch current state rather than using replay payloads as fresh time samples. Show disconnected state and disable commands until reconciliation succeeds. A monotonic server sample accompanies player snapshots; estimate remaining time from its deadline delta and browser elapsed time, never from cross-process timestamps directly.

Effective previews use rendered PNG frames with their manifest delays. Browser preview timing is illustrative and independently labeled. Changing transforms creates immutable renditions and does not rewrite saved items. Render/import errors remain visible and retryable. Native input bounds supplement existing server validation.

## Risks / Trade-offs

- Lost command responses can be ambiguous. Retain identity and require retry or explicit reconciliation before further commands.
- Other tabs can edit simultaneously. Preserve stale drafts on conflict and explain reload.
- Background browser timers can be delayed. Recompute countdown from elapsed monotonic time and label all timing estimated.
- Animated previews can use memory. Load one selected rendition and release its timer on view or selection changes.

## Migration Plan

No storage migration or installation. Build the browser assets with the existing command. Rollback source/assets to the preceding revision; persisted catalog and checkpoints are unchanged.
