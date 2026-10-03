## Context

See proposal.md. The server owns initialization; media decoding already runs in an owned child process with a private IPC request and separate result messages.

## Goals / Non-Goals

Provide useful process, request and selected operation diagnostics without changing command admission, persistent state or visible UI. No new collector service, dashboards, per-frame records or performance campaign.

## Decisions

Use the accepted immutable host package instead of copying pilot internals. Inject optional diagnostics through application/library composition; imports and library defaults remain inert. Output canonical records on stderr, preserving stdout startup and IPC results.

Wrap selected existing handlers after authentication. Unauthenticated local requests begin fresh traces; only authenticated owned boundaries accept validated traceparent. No baggage, raw paths, payloads or vendor propagation. Preserve returned uncertainty and thrown error identity in diagnostic summaries.

Pass captured traceparent to the owned media child. The child emits one canonical Pino record through a dedicated diagnostic pipe, bounded to 8 KiB. The parent validates it and submits it to the host's bounded local/export queues. The record refers to the queue span and identifies the worker resource. No child SDK or Collector flush can hold up its unchanged IPC result or process exit. Parent cancellation still kills/reaps the child before slot release. This replaces the initial direct-export design after review demonstrated that waiting for child flush could turn completed rendering into a timeout.

## Risks / Trade-offs

- Child instrumentation adds work → retain the current deadline, fake-test missing/slow collection and record performance qualification as deferred.
- Context can cross concurrent requests → prove distinct authenticated traces through the real owned worker.
- Some long-lived background paths remain uninstrumented → publish a coverage/deferral inventory; no per-frame flood.

## Migration Plan

Source-only opt-in environment configuration. Disabled remains the default; removing the enable flag returns to existing behavior. No data migration or installation.
