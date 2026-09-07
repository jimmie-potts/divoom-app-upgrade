## Context

See proposal.md for the outcome. This design was inspected against delivered #24, f81cce6ee00ec3865d0c04f19da42c9cb9e9674f. ControlService shares display commands, while playerRoutes still owns ['player', body] admission. Commands retains the original promise and 256 completed receipts. MCP extensions use strict schemas and the shared gateway, with owner work independent of delivery cancellation.

Player.start currently retires the generation before capture. Capture replaces a checkpoint and references in one SQLite transaction, but does not check expected revision. Profile validation and policy arithmetic happen later during load. Checkpoint snapshots are strict playlist-shaped records; the browser assumes every session has a saved revision. Cross-layer concurrency, persistence and recovery make this design mandatory.

## Goals / Non-Goals

Keep one request ledger, player context queue and device writer. Selection errors must leave the preceding session usable. Agent results must be bounded and distinguish source, immutable context, loading and uncertain effects.

No new scheduler, media renderer, transport dependency, device target, upload/edit tool or installation is introduced. No hardware result is inferred from fake-device tests.

## Decisions

### Shared application admission

Extend ControlService with the existing Library owner and canonical player operations. Move playerRoutes' exact ['player', body] admission there, preserving current HTTP schemas, payload ordering and snapshot projection. Existing pause/resume/stop/next/previous MCP calls canonicalize to those same commands. Add shared commands for expected-revision start and single-media start; expose them through the existing HTTP command route as strict additional variants so both callers can exercise the same operation. Preserve ordinary start without revision for existing browser clients. A revised start requires its revision in the canonical payload, distinguishing it from an unchecked start.

Validate schemas before reserving request identity. Reserve once before asynchronous domain work; duplicate calls join the retained result, and failures remain replayable. Deep-copy retained data before caller projections. Known library/media/playback failures become typed MCP results with bounded allowlisted details. Unexpected errors after dispatch use the existing conservative uncertainty path. A context-admission receipt acknowledges backend context work, not completed upload; adapter operation timing is null when no direct operation was awaited.

### Fixed tools and bounded selection

list_media accepts q up to 120 characters, offset as a nonnegative safe integer and limit 1-100, default 25. Return one rendition per row, including asset_id, rendition_id, name, format, effective frame count/duration and compatible boolean for the active profile. list_playlists uses the same query bounds and returns ID, name, revision, item count, repeat and shuffle. Stable ordering is created time plus stable IDs. Totals count matching rows. Library query methods perform count/page selection together in its existing queue and avoid loading every full playlist or manifest into response memory.

show_media requires rendition_id and request_id, plus optional strict duration/plays policy. Its asset is resolved from that rendition; callers cannot provide mismatched asset/rendition pairs. play_playlist requires playlist_id, revision and request_id. control_playback requires action from pause,resume,stop,next,previous and request_id. Unknown fields fail. Read annotations are read-only and idempotent; writes are destructive and replay-idempotent with explicit identity. Register extensions in the existing registry so default local bindings and device-ID bindings reach identical service methods. Do not widen the shared controller API contract.

Extend safe result projections with source, session ID, saved playlist ID/revision when applicable, current item and rendition, playback state/intent, estimated timing, request identity and possible prior effects. Do not return full 1000-item sessions through MCP; HTTP keeps its existing full snapshot. Include bounded expected/actual revision details for conflicts. Extend the existing local-mcp-controls fixed-tool requirement to exactly eight tools. Its privacy exception applies only to approved metadata in list_media/list_playlists results. Keep discovery, status, display outcomes and logs free of catalog metadata; media mutation projections contain identity/state, not catalog names or descriptive metadata. Catalog names are untrusted data, not instructions. Shared output byte limits remain the final delivery bound.

### Admission before cancellation

Use a single guarded capture protocol inside the current player context queue. Validate the chosen snapshot and all referenced rendition metadata before retiring the current writer or replacing references. The library transaction checks expected revision and retained ownership at capture, so a separate lookup is never the final revision gate. Extract policy/profile validation shared with load, including effective still delays, frame/timing profile bounds and safe total-plays multiplication.

A pending start carries an admission identity that later explicit context controls can supersede without first stopping the old session merely to validate the new selection. Immediate pause/stop/close cancellation remains effective while admission awaits library work. At the actual queued commit boundary, check that admission still owns the request. Reject cancelled admission before any checkpoint/reference replacement. Execute synchronous post-commit record adoption before yielding so a newer stop cannot persist the previous record against the newly committed checkpoint. Prepare fallible traversal and validation before commit; adoption must not throw. A store API can accept narrow synchronous guard/adoption callbacks, but never expose SQLite or allow async work inside its transaction.

Retain the player context queue around replacement so older queued saves drain first and later saves see the adopted record. Validation and revision errors bypass dispatch's fatal handler, preserving current intent, generation and timers. New accepted content retires previous work through the established generation mechanism. Later filesystem corruption or transport failures follow existing item-error and uncertainty behavior; validation cannot promise immutable files will never be externally damaged.

### Temporary context and recovery

Keep the existing traversal representation internally with an immutable source discriminator. Old version-1 checkpoints without source mean saved playlist; new media checkpoints identify the actual asset and rendition. Internal generated snapshot IDs are never presented as saved playlist IDs. Temporary media uses one immutable item, repeat on, shuffle off, 30000 ms for stills and three total plays for multi-frame animation unless a valid explicit policy is supplied. Single-frame GIFs use still policy validation.

Temporary capture inserts checkpoint/session references only, without saved playlist or item rows. Checkpoint save rejects source mutation as well as snapshot mutation. Pause, stop and process close retain references; replacement or clear releases them. Reopen restores paused without device writes. restart-with-changes on media returns unsupported-operation before retirement; it never looks up a generated playlist ID. Saved playlist behavior remains unchanged.

### Existing player panel

When source is media, retain the asset name heading, show 'Temporary media session' instead of 'Session revision ...', and disable 'Restart with changes'. The other controls retain their actions and labels. Saved sessions retain the current revision display. This is the only visible UI change. Prepare simulator screenshots of temporary and saved sessions for review alongside browser regression evidence.

## Risks / Trade-offs

- Capture/adoption races can strand checkpoint ownership. Deterministic deferred-store tests must cover stop, close, newer start and old queued saves around the exact commit boundary.
- Query paging under concurrent edits can change later pages. Each response is a coherent bounded page; stable ordering does not imply a multi-request frozen catalog.
- Adding source metadata changes persisted payloads. Preserve old reads, reject unknown source shapes, and test backup verification plus paused recovery.
- Profile validation can drift from upload preparation. Use the same effective-timing/profile helper in admission and load.
- Existing shared MCP result schemas omit full sessions. Extend explicit projections and error allowlists; never spread raw LibraryError details or manifests into responses.

## Migration Plan

Implement in an isolated branch from delivered #24. No live database or private media is migrated during source delivery. Existing checkpoints open as saved sources; new source metadata is written only by normal runtime use. An older binary may reject a media checkpoint, so downgrade requires the current version to clear temporary context first or restore a compatible offline backup. Do not silently delete context on parse failure. Local application/workflow/browser checks replace hosted Actions under the user's existing exception; independent review and guarded merge still apply.
