# ADR 0013: Local MCP bindings share Pixoo command ownership

Status: Accepted for source implementation in issue #24.

## Context

[Issue #24](https://github.com/jimmie-potts/divoom-app-upgrade/issues/24) introduces local status, brightness and screen tools. The application already owns one Player, adapter queue and bounded Commands receipt history. The shared module from [hub #7](https://github.com/jimmie-potts/agent-device-hub/issues/7) owns MCP transport, authorization schemas and registration. Route handlers currently discard display timing, and player state does not retain dated display telemetry.

## Decision

Embed the immutable shared MCP module at the optional loopback `/mcp` endpoint. Register fixed service extensions for the existing app target. Keep native Pixoo request identities rather than widening the separate controller API v1 contract.

Extract one display application service used by HTTP and MCP. Canonical input and the existing command fingerprint reserve one operation and retained outcome across callers. HTTP keeps its response projection; MCP adds structured request identity, operation timing and prior effects from that same outcome. Neither transport owns another ledger or writer.

Keep requested, acknowledged and probe-observed display evidence inside Player, including background results. Status selects bounded safe fields and dates observations without probing. Transport acknowledgment does not establish visual state. Volatile evidence resets to unknown on restart.

Enable MCP only through explicit startup configuration and a bounded credential file in private runtime storage. Provision random bearer credentials through an explicit local command and retain digests. Verify current credential state on every request. Revocation affects subsequent requests, while admitted work follows the existing owner lifetime. Native Originless access applies only to the authenticated MCP route and does not relax HTTP API browser checks.

Use raw HTTP handling before Fastify body parsing, and verify response accounting and shutdown with real protocol clients. Client cancellation releases delivery without creating an automatic retry or stopping the backend.

## Alternatives considered

A separate MCP server with its own device adapter would violate one-writer ownership. Calling browser HTTP routes from a bridge would couple native authentication to browser policy and make receipt projection less direct. A second command ledger would permit duplicates across transports. Generic controller API v1 bindings would require unrelated contract adoption from #37. Recording observations only at routes would miss background playback and recovery.

## Consequences

The backend gains an opt-in agent entry point with the same command and uncertainty behavior as browser control. It depends on the pinned shared release and must preserve its compatibility receipt. Credentials and observations require bounded validation but no database migration. Source delivery leaves installation, actual Codex use and physical-device acceptance to #26; media controls remain #25.
