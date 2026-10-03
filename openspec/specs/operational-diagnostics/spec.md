# operational-diagnostics Specification

## Purpose
Provide optional canonical operational diagnostics across the Pixoo server and its owned media worker without changing domain behavior.

## Requirements

### Requirement: Explicit canonical host diagnostics
The normal server SHALL initialize the pinned shared runtime only through explicit host enablement, preserve stdout startup/result formats, and use canonical registered metadata for process and selected HTTP/controller/MCP/media/player/monitor outcomes. Library defaults SHALL remain inert.

#### Scenario: Enable and disable
- **WHEN** the server starts with or without explicit enablement
- **THEN** enabled diagnostics use the shared schema on stderr and disabled operation creates no exporter
- **AND** simulator defaults and domain outcomes are unchanged

### Requirement: Owned context handoff
Authenticated owned requests SHALL accept only validated traceparent and carry context into the selected media worker operation. Unauthenticated input SHALL NOT supply parent context. Concurrent requests SHALL retain separate contexts. Device/vendor calls SHALL receive no diagnostic propagation.

#### Scenario: Concurrent worker operations
- **WHEN** two authenticated synthetic uploads reach the owned workers
- **THEN** each worker record correlates with its own request and no context crosses requests
- **AND** existing IPC results, cancellation and publication rules remain unchanged

### Requirement: Bounded best-effort behavior
Diagnostics SHALL preserve action results, uncertainty, error identity and single execution under operation failure or absent/slow output. The shared queue/drop and bounded flush rules SHALL apply without durable command retry or spool.

#### Scenario: Collector failure
- **WHEN** collection is unavailable or slow during synthetic operations
- **THEN** commands retain their original outcomes and execute once
- **AND** diagnostic queues and shutdown remain bounded
