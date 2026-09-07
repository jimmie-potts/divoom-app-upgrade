## Context

The catalog and adapter already provide immutable renditions, session retention, serialized device operations and injectable clocks. They have no orchestration or checkpoint. See proposal.md for issue scope. Startup currently serves readiness only.

## Goals / Non-Goals

Keep orchestration independent of HTTP/UI and use simulator fixtures for acceptance. No playback endpoint, installer, hardware polling service or display action is part of this change. Retention remains owned by the library catalog.

## Decisions

- Add `@pixoo/playback`, with a storage port and a library-backed implementation. Keep checkpoint contracts in the persistence package so the dependency graph stays acyclic. Add migration 3 without changing prior migration checksums. SQLite checkpoint plus retained-session references avoids a separate file/database commit gap.
- Commands invalidate generations synchronously, then serialize short context/persistence changes. Uploads and preparation run outside that command queue and return only through generation-checked continuations. Stop/pause can retire a pending upload without waiting for it. Brightness uses the existing adapter FIFO and does not invalidate an upload. Automatic dwell advancement retires player callbacks without cancelling queued controls. Explicit controls retire both generations. Screen requests carry a separate submission sequence so an older off request cannot overtake a newer on request.
- Store one current checkpoint with immutable playlist snapshot and reference ownership. A new capture atomically replaces the old checkpoint and its owned session references. Manual release cannot discard checkpoint-owned retention. Closing the player pauses and persists context; clearing context is explicit. A lease prevents two players sharing a library/adapter.
- Keep forward cycle order/cursor and its played flag separate from selected item and history cursor. Append history only when an item reaches estimated playback readiness, so skipped/failed uploads are not invented playback history. Previous traverses recorded entries; next replays forward history before extending the current cycle. Fisher-Yates uses injected randomness and swaps the first entry if a new shuffle cycle would repeat its predecessor. Retain 10000 visits to bound durable context. Navigating while paused/stopped changes context without output.
- Validate computed total-play dwell as a positive safe integer. Use the effective uploaded frame delays. A still uploads one RGB frame with a positive transport placeholder delay; its duration policy owns dwell. Start from the later of observed upload completion and estimated ready time. A delayed callback starts one next item, never a catch-up loop.
- Prepare at most the current and next rendition in memory. Load complete effective RGB frames through a bounded media helper; never send a preload to hardware. Stale preparation can finish reading but cannot publish player state or device output.
- Default reconnect probes wait 250, 500 and 1000 ms, with a 5000 ms operation timeout. Bound the entire current-item recovery episode, including successful probes followed by failed uploads; only a successfully started item resets its budget. Offline/timeout/HTTP failures use recovery; invalid media and rejected uploads can skip with a visible item error. Distinct consecutive failed items are bounded by snapshot length. No periodic takeover detection is invented; an integration-owned takeover notification pauses and requires explicit user resume.
- Persistence failures cancel orchestration and produce error; they never permit output based on an uncommitted transition. Recovery always normalizes state/intent to paused and discards all runtime deadlines. Requested screen state is context, not a claim of observed hardware state.

## Risks / Trade-offs

Synchronous SQLite and bounded frame reads can delay metadata operations; cancellation/generation checks prevent delayed results from starting work. Native device requests may already have applied before cancellation; no undo claim is made. Hardware readiness and finite plays remain estimated. Unavailable takeover telemetry cannot prove exclusive real-device ownership; no background reclaim loop is added.

## Migration Plan

Migration 3 adds a single checkpoint tied to retained session ownership. Existing catalogs migrate transactionally; no schema downgrade/reset is provided. Startup does not open the player automatically. Future HTTP integration must construct one library, one player and one adapter, and close the player before its library.
