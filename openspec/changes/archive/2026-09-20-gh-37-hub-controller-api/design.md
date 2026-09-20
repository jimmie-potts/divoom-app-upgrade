## Context

See proposal.md. ControlService already shares the Commands ledger between HTTP and MCP. Player owns cancellation and the adapter FIFO. Hub contract 1.0.0 is released at revision 589846bcbe6a4a06ef6aaec9d2952c9f9d58dac3. A design is required for authentication, concurrent admission, async media capture and stream lifetime.

## Goals / Non-Goals

Provide a native contract boundary in the existing server. Keep the browser/MCP shapes and operation semantics. Do not add a writer, database, renderer, mode implementation, raw command, device activation route or general-control UI.

## Decisions

- Enable `/controller/v1/snapshot`, `/controller/v1/commands` and `/controller/v1/events` explicitly. Use neutral startup identity, fixed for the process lifetime. Reuse the existing private machine credential store and read/control scopes for this single backend; it remains distinct from browser authorization. Do not introduce another credential database.
- Reuse the Commands epoch, sequence and 256-result retention. Native envelopes have their own canonical fingerprint because revision and generation are part of their intent. An ID already used through another envelope conflicts rather than silently dropping guards. Browser/MCP replay remains unchanged.
- Separate command reservation from execution helpers in ControlService. Track a configuration revision for accepted intent and the advertised bounded playlist ID/revision set. Capture media using the discovered saved revision. Use the Player generation with the shared server epoch. Let the existing adapter enforce its generation again when queued operations begin.
- Bound discovery to 100 saved playlists. Contract 1.0 has `media.start` but no rendition selection operation or playlist revision field. Advertise only implemented actions, use the snapshot configuration revision to guard the advertised catalog, and pass the selected playlist revision into existing atomic capture. Keep local rendition selection available through existing MCP/browser routes.
- Use a separate bounded native feed with full contract snapshots. Reauthorize before stream deliveries and on bounded heartbeat intervals. Disconnect slow clients. Preserve immutable receipt timestamps; reads never probe.
- Report simulator physical observations and external ownership as unknown. Direct successful controls mean successful adapter transmission only. Playback receipts acknowledge queued/context work, never completed optical effects.

## Risks / Trade-offs

- Concurrent catalog edits can invalidate selection. Refresh the bounded catalog before admission and pass its revision into atomic capture.
- A disconnect can hide a completed effect. Retain the original outcome and forbid automatic fresh-ID retries.
- Revocation cannot undo an admitted operation. Reauthorize reads/replay and terminate streams within the documented heartbeat interval.
- Contract 1.0 cannot express every existing media operation. Leave those operations on their delivered local APIs; do not invent wire extensions.

## Migration Plan

Source-only delivery. Operators can provision a separate principal in the existing private credential store and explicitly enable the endpoint after installation is separately authorized. Removing the enable flag and restarting disables it. No persistent application data migration is required. Restart changes replay, feed and clock epochs; old identities expire.

## Assessment and verification

Complexity high: shared async admission, catalog capture, generation cancellation and streams. Impact high: machine authorization and device writes. Uncertainty medium: owning-service integration requires executable negative cases. Cover each specification scenario with fake-backed controller tests, plus shared fixtures, npm run check and browser checks. Independent Standards and Specification reviews must inspect authorization and concurrency failure cases. Physical acceptance is outside this source-only task.
