## Context

Issue #8 composes the existing Fastify server, strict library contracts, fake adapter and player. The handoff permits consistent route-name adjustments. Startup remains loopback-only; secure LAN deployment is separate. Security, new dependency and cross-package state observation require this design.

## Goals / Non-Goals

Make backend behavior accessible to future clients without weakening library ownership or physical evidence. No player UI, LAN mode, credentials workflow or real-adapter activation is added.

## Decisions

- Shared browser-safe Zod request schemas live in core. HTTP maps existing library/media/player errors to stable codes and sanitized messages. Dedicated revisioned playlist operation routes preserve existing atomic library methods instead of composing partial updates.
- Use pinned @fastify/multipart 10.1.1, MIT, for a single file part. Validate the whole bounded upload before import so extra parts cannot fail after publication. Maximum four concurrent expensive media requests; 10 MiB per file, 64 KiB JSON, 32 ordinary in-flight requests. A bounded buffer is simpler to verify than partial publication with streaming parser errors; rendering remains in the existing worker.
- Command identity is `<server UUID>:<positive sequence>`. GET player returns nextRequestId. Reserve identities synchronously before asynchronous execution; matching replays share promises and results. Keep 256 completed receipts, reject older sequences rather than replaying them, and reject other server epochs after restart. Concurrent clients using one sequence with different payloads must reload and retry with a new identity. This avoids an unbounded durable UUID receipt table and never silently evicts the replay watermark.
- SSE uses a separate epoch/sequence, a 32-event ring and at most 16 clients. Each event carries a full authoritative player/session snapshot. Reconnect replays retained events or sends a full resync. Slow clients are disconnected on backpressure and can resync; 15-second heartbeats keep idle streams visible. Player subscriptions publish transitions without polling device telemetry.
- Host validation matches localhost or 127.0.0.1 at the actual listener port. Origins must exactly match the request authority; cross-site fetch metadata is rejected. Originless mutations need X-Pixoo-Request: 1, so simple form requests cannot mutate. No wildcard CORS or forwarded-host trust. An injected asynchronous authentication hook runs before API effects; no LAN enablement option is introduced.
- Device configuration is a versioned private JSON document written atomically under the resolved runtime directory. Accept only validated private IPv4 and a shipped capability profile. Probe/display use the same fake adapter/player writer as playback. Saving an IP never activates hardware. Existing opt-in transport tests prove fixed destination and redirect rejection separately.
- Startup owns Library then Player, and closes Player before Library. Pre-close ends SSE clients before listener shutdown. Settings, media and checkpoint survive restart; command/event epochs do not.

## Risks / Trade-offs

- Full snapshots can contain 1000 items; event history and client count are capped, and slow clients disconnect.
- One global command sequence makes competing clients retry conflicts; this is explicit and testable before a UI exists.
- Queued library rendering can delay persistence; API admission bounds submissions, while health remains independent of device availability.
- Local origin checks are not user authentication. An authentication hook supports later deployment work without claiming authenticated LAN access now.

## Migration Plan

Startup opens the existing library migrations and paused checkpoint. No SQL migration is required. A new settings file is created only by a device configuration request. Source rollback preserves runtime data; do not remove the library or downgrade its schema.
