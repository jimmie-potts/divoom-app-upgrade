## Context

See proposal.md. Design is required because the producer/observer boundary crosses modules and carries concurrent command evidence. Characterization uses baseline `2e595cb437ddf0f45ef93536d442b37c5f222c2d`.

## Goals / Non-Goals

Make observation inputs and results statically correlated, while preserving the ledger and public contracts. Do not move pending-slot accounting, execution helpers, AsyncLocalStorage or shared-state ownership.

## Decisions

Use an operation map and tagged pending/success/failure events. The ledger receives typed metadata separately from its unchanged JSON fingerprint input. Producers and ControllerState migrate together. A generic map also lets the separate monitor ledger retain its own domain types without becoming a native controller producer. Exhaustive switches handle application operations; local-only operations have no invented native command.

Keep receipt reservation and pending notification synchronous, action execution deferred, and completion notification after retention/pruning but before awaiting callers continue. Matching replay returns the original promise and emits nothing. Observer isolation continues to catch synchronous exceptions only. The service remains responsible for cloned public receipts.

Keep native guard-sensitive fingerprints, command-generation sampling, upload attribution and early-media precedence intact. Preserve existing truthiness handling of rejection values in the native projection; changing that edge would require separate scope.

A callback registry or event bus would add machinery without another consumer. Parsing replay payloads would retain the coupling this issue removes. ADR 0022 records the chosen boundary.

## Risks / Trade-offs

- Correlated generic events require a narrow internal construction assertion because TypeScript cannot distribute an unresolved generic key. Keep it at construction, with typed producer arguments and no consumer result casts.
- Altered fingerprints or lifecycle ordering could duplicate or misattribute work. Baseline ledger tests and existing HTTP/MCP/native suites guard these contracts.
- Endpoint-dependent retained slots remain unchanged and explicitly deferred by #80.

## Migration Plan

Migrate all producers and the observer in one source candidate. Run focused tests and full application/controller/browser checks before review. No data migration or deployment occurs; source rollback restores the prior internal representation.
