# ADR 0008: Local controller API and replay identity

Status: accepted for issue #8 source delivery, September 6, 2026.

The server now connects the delivered library/player to HTTP clients. It remains
simulator-only on loopback. [API contracts](../api.md) define routes, bounds and
security behavior; [the OpenSpec change](../../openspec/changes/archive/2026-09-06-gh-8-http-api/design.md)
records the implementation design.

Use browser-safe shared strict schemas, dedicated revisioned playlist operations,
and sanitized typed errors. Keep mutations behind host/origin checks and a
non-simple header for originless clients. Provide an authentication hook without
adding a LAN listener or claiming an authenticated session implementation.

Player/display request IDs combine a server lifetime UUID with a sequence. Reserve
before awaiting work. Retain 256 completed receipts and reject older sequences;
never evict the watermark. Restart rejects all old epochs. Concurrent clients may
need to reload the next ID after a conflict. This avoids a durable unbounded UUID
receipt table while preventing silent duplicate execution.

SSE retains 32 complete state snapshots with its own epoch and sequence. Replay
when possible and resync when history is missing. Bounded client queues and
shutdown hooks keep connections from owning the player lifetime. State observation
uses player subscriptions, not device polling or firmware assumptions.

Use @fastify/multipart 10.1.1 with one 10 MiB file part. Buffer at most four admitted
uploads before rendering to reject malformed trailing parts before publication.
The existing renderer worker owns conversion limits. Device settings are private,
validated and atomically replaced; saving them never activates physical transport.

No SQL migration is needed. Startup opens existing private data and restores
playback paused. Deployment, LAN authentication and physical verification remain
separate issues.
