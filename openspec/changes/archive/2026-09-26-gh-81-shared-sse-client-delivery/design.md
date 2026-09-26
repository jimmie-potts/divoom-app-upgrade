## Context

See proposal.md. Design is required because authentication, registration, timers and backpressure cross both feed implementations. At baseline `2e595cb437ddf0f45ef93536d442b37c5f222c2d`, 22 controlled lifecycle tests passed before extraction.

## Goals / Non-Goals

Share encoded-message delivery while retaining protocol ownership. Keep the security layer's global 16-stream GET/HEAD and 32-request limits, the existing browser shared pool, and native pre-authentication reservation. Do not unify wire formats, auth wiring or cursor behavior.

## Decisions

A private SseDelivery owns client queues, optional authentication, one feed-relative timer, five-second drain deadlines and cleanup. Feed classes reserve clients and activate them only after writing headers. Native registration still reserves before catalog/auth waits; its feed-level closed flag remains local. The browser feed still publishes before registration and has no new closed-feed admission rule.

An explicit blocked-write policy preserves observed differences:

- Browser delivery without a callback writes synchronously and has no credential timer. Authenticated browser delivery checks blocked state after authorization; empty rechecks write nothing. Drain during the next authorization can permit that message.
- Native delivery rejects any enqueue while blocked, including empty rechecks, and terminates immediately if a false write leaves queued messages.

Both authenticated paths count the current authentication wait within the 32-entry queue, recheck each second and heartbeat every 15 seconds. Authentication rejection, disconnect and shutdown discard queued data; successful late auth cannot write after removal. Publishing never awaits a client.

A single assumed-equivalent policy would change supported behavior. A cross-project transport package or protocol abstraction is unnecessary. ADR 0023 records the private boundary. Snapshot selection, signatures, history, cursor parsing and replay/resync stay in their existing feed owners.

## Risks / Trade-offs

- Authorization timing can disclose data or exhaust slots: controlled promises test queue rejection and shutdown; existing native revocation and mixed-feed HTTP tests retain security-layer coverage.
- The native one-second recheck can terminate a blocked stream before its five-second drain ceiling: preserve this rather than changing timing to make both feeds look alike.
- Native close-listener attachment remains at activation after registration awaits. This extraction does not redesign admission or introduce another owner.

## Migration Plan

Deliver #80 first, then refresh this worktree to its verified merged revision. Migrate both feeds together, preserving baseline lifecycle tests and existing protocol/client suites. No persistent format or deployment change occurs. Reverting the source restores the duplicate implementations without a data migration.
