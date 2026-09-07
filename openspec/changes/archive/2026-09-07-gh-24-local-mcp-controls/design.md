## Context

See proposal.md for the outcome. The merged application creates one Player and Commands in `api.ts`. Display routes validate and reserve commands, but currently discard adapter timing when returning a snapshot. Player records screen intent and availability, but not dated brightness or probe telemetry. Background reconnects bypass route handlers. The shared MCP module provides fixed service extensions, per-request authentication, bounded transport and delivery cancellation independent of owner work.

Design is required because this change crosses HTTP, playback and transport ownership, introduces a dependency and changes authentication and evidence handling.

## Goals / Non-Goals

Expose existing controls through fixed local bindings while retaining command identity and immutable outcomes across transports. Keep ordinary HTTP response shapes compatible. Keep observations in their owning player and expose a smaller projection to agents.

Media tools, native hub controller API v1 adoption, another writer, personal configuration changes and physical acceptance are outside this design.

## Decisions

### One display application service

Extract display admission and snapshots into a framework-independent server service constructed once with the current Player and Commands. Both entry points canonicalize through the existing display schema before using the exact `['display', body]` fingerprint. The admitted result retains its snapshot and operation result. HTTP projects the same snapshot/error shape as today; MCP projects bounded identity, timing and effect details. Do not add a second ledger or proxy through HTTP because either would complicate replay or couple native authentication to browser access.

Preserve reservation before execution, same-payload promise joining, conflict/expired/order decisions and retention of 256 completed results. Failed admitted operations remain replayable failures. Known application failures become structured extension data with `isError`; an unexpected post-dispatch exception remains the shared gateway's conservative uncertainty result. No lost-response path generates a new command identity automatically.

### Evidence belongs to Player

Keep a separate in-memory evidence getter rather than altering the full browser session schema. Capture validated requested brightness, screen intent, acknowledged controls and probe telemetry. Record source and monotonic completion time only when a current operation establishes that evidence. Wire direct controls and the background upload/reconnect paths. Successful writes do not populate probe-observed values; simulator evidence is never physical observation. Failed writes retain possible effects without advancing acknowledgment.

Expose unknown values and timestamps as null. Status supplies the current sample plus original evidence times or ages; it does not invent a freshness threshold or send probes. New processes discard volatile observation/acknowledgment times while preserving existing paused checkpoint behavior. Evidence updates follow the same generation guards as playback so retired results cannot overwrite newer intent.

### Shared module and exact local binding

Consume the immutable private release tarball and receipt from hub #7. Bind three service extensions with strict input/output schemas to one fixed neutral controller/device identity. Preserve `request_id` as the native identity string supported by the shared extension boundary. Do not widen API v1 or expose generic hub operations that this slice does not implement. Keep the compatible SDK/license record with the package pin and prove imports from the built consumer.

### Explicit credentials with current-request verification

Use `PIXOO_MCP_ENABLED=1` for explicit activation; absence disables MCP. Proposed credential state is `mcp-credentials.json` beneath the already validated external runtime directory. Use strict version 1 JSON with at most 32 principals and a 64 KiB read limit. A principal has a bounded neutral identifier, enabled state, SHA-256 bearer digest and a nonempty unique subset of read/control scopes. Bind authorization to the fixed local target in code. An explicit provisioning CLI generates 32 random bytes and emits the token once for the user to store; the private file keeps only its digest. Revocation disables or removes the principal through atomic file replacement. Startup never creates a default credential.

Read and validate current bounded state on every authenticated HTTP request. Missing, malformed or oversize state fails closed without logging contents. Use timing-safe digest comparison and the shared module's authentication deadline. Changes take effect for subsequent requests on existing sessions; already admitted owner work continues under the existing command contract. Credentials do not activate a physical adapter or authorize browser API access. A separate token service or account system is unnecessary for this local slice.

### Raw HTTP lifecycle inside Fastify

Mount the exact enabled `/mcp` path in an onRequest hook before body parsing and pass the original Node request/response to the shared handler using Fastify's hijack mechanism. Preserve existing Host, supplied Origin and cross-site checks. The browser request-header exception applies only to that path. Do not accept forwarded authorities. Resolve shared allowed authorities from the actual listener port, including ephemeral ports in tests.

Raw response finish/close must release existing request accounting even for hijacked or streaming responses. Shared limits own MCP body/session/in-flight bounds; add no unbounded waiting queue outside them. During preClose, release the MCP handler's sessions/delivery before closing the player and library. Disconnecting a client releases its delivery without closing the backend or cancelling admitted device work. Tests must prove this lifecycle with real sockets because injection alone does not establish streaming behavior.

## Risks / Trade-offs

- Different caller projections could corrupt replay semantics. Retain one immutable service result and test HTTP-first and MCP-first joining, success and failure.
- Hijacked responses could bypass Fastify cleanup. Assert capacity returns after close, cancellation and ordinary completion while the backend remains usable.
- Partial transport telemetry could look like physical state. Separate requested, acknowledged and observed fields and test missing probe fields, uncertainty and stale generations.
- Private credential replacement could race requests. Use atomic replacement and validate each complete bounded read; any failure denies access. Revocation applies at subsequent request authentication rather than undoing admitted work.
- Volatile evidence resets on restart. Report it unknown rather than persisting process-monotonic clocks or guessing display state.

## Migration Plan

Deliver the source with MCP disabled by default and no data migration. Supply templates and commands for later explicit local provisioning, same-machine Codex configuration and Windows/WSL reachability diagnosis. Root runs source validation against synthetic credentials and fake transport only. Turning off the startup setting and restarting removes the endpoint; ordinary browser playback remains available. Installed-client and physical acceptance remain issue #26.
