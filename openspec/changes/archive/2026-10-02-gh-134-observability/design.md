## Context

See proposal.md. The server owns initialization; media decoding already runs in an owned child process with a private IPC request and separate result messages.

## Goals / Non-Goals

Provide useful process, request and selected operation diagnostics without changing command admission, persistent state or visible UI. No new collector service, dashboards, per-frame records or performance campaign.

## Decisions

Use the accepted immutable host package instead of copying pilot internals. Inject optional diagnostics through application/library composition; imports and library defaults remain inert. Output canonical records on stderr, preserving stdout startup and IPC results.

Wrap selected existing handlers after authentication. Unauthenticated local requests begin fresh traces; only authenticated owned boundaries accept validated traceparent. No baggage, raw paths, payloads or vendor propagation. Preserve returned uncertainty and thrown error identity in diagnostic summaries.

Pass a small host configuration and current traceparent to the owned media child. Its explicit runtime exports directly to the same optional loopback Collector and writes canonical stderr. This avoids inventing a second diagnostic IPC protocol. Parent cancellation still kills/reaps the child before slot release. Child flush uses the shared bounded shutdown and does not extend the existing domain timeout.

## Risks / Trade-offs

- Child startup/flush adds work → retain the current deadline, fake-test missing/slow collection and record performance qualification as deferred.
- Context can cross concurrent requests → prove distinct authenticated traces through the real owned worker.
- Some long-lived background paths remain uninstrumented → publish a coverage/deferral inventory; no per-frame flood.

## Migration Plan

Source-only opt-in environment configuration. Disabled remains the default; removing the enable flag returns to existing behavior. No data migration or installation.
