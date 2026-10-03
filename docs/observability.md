# Operational diagnostics

Pixoo uses the shared B.U.N.N.Y. observability 1.1.0 package. Diagnostics are
optional and the simulator remains the default. This source integration does
not install a Collector or change a running application.

For a separately chosen application launch, set `PIXOO_OBSERVABILITY_ENABLED=1`
to write canonical INFO-and-above diagnostics to stderr. The existing stdout
startup marker is unchanged. Remove the flag or set it to `0` to disable the
runtime. Libraries remain inert unless their host injects diagnostics.

Optional `PIXOO_OBSERVABILITY_COLLECTOR` names a numeric loopback HTTP Collector
origin, for example `http://127.0.0.1:4318`. Set
`PIXOO_OBSERVABILITY_TRACING=1` to enable traces; this requires the Collector.
`PIXOO_OBSERVABILITY_SAMPLE_RATIO` defaults to `0.1` and accepts 0 through 1.
Use 1 for a small synthetic investigation. No exporter credentials, automatic
instrumentation or device/vendor trace headers are added.

The shared contract limits records to 8 KiB and each signal queue to 1,024
records or 4 MiB, dropping newest when full. Shutdown flush is bounded by the
shared one-second deadline. Output failure cannot retry a command. A media child emits at most one 8 KiB canonical record through its dedicated
diagnostic pipe. The parent queues local/Collector delivery; child completion
never waits for Collector flushing. Cancellation still kills and reaps the child
before the slot is released.

## Coverage

| Boundary | Current records |
| --- | --- |
| Server | Process ready, startup failure and shutdown |
| Selected HTTP handlers | Canonical operation result and duration; no URL/body capture |
| Native controller commands | Authenticated request outcome, preserving uncertainty |
| MCP tools | Outcome after gateway authentication; a fresh root per invocation |
| Media imports/renditions | Request, owned queue handoff and correlated child render record |
| Player and monitor API operations | Registered playback/state operation summaries |

Browser instrumentation, provider hooks, operational helper CLIs, background
monitor ticks, individual frames, SSE lifetimes and custom dashboards are
deferred. MCP transport parent propagation is deferred; tool traces start fresh.
The normal browser API has no bearer authentication, so its incoming traceparent
is ignored unless the host supplies its existing authentication hook. Native
controller commands accept validated traceparent after their credential check.
Only the private owned worker request carries captured context onward.

Query `service.name=pixoo` and `pixoo-media-worker`, then the canonical scope,
`bunny.operation`, `bunny.outcome`, `trace_id` and `span_id`. The parent writes worker diagnostics to stderr and the optional Collector,
separate from the child’s unchanged IPC result messages. Worker logs refer to
the owned queue span; there is no separate child SDK or child exporter. Names, media,
paths, request bodies and raw exception text are not diagnostic fields.

## Validation boundary

Application tests check installed manifest/archive hashes, schema conformance,
concurrent authenticated request-to-worker traces and unavailable/stalled
collection. Existing simulator, controller and browser checks remain required.
Numerical performance qualification is deferred. Source and synthetic evidence
do not establish installation, live Collector readiness or physical acceptance.
