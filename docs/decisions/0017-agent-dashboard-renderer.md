# ADR 0017: Exact pixels from shared monitoring snapshots

Status: Accepted for issue #32 implementation.

## Context

Pixoo needs a deterministic 64x64 projection while the Hub owns provider
interpretation and shared state. A preview must be valid before selecting a
physical transport, and slow rendering must not restore old state.

## Decision

Consume the selected SessionSource through a pure layout and bitmap renderer.
Use explicit symbols, ordinal identity ordering and an injectable ten-second
pager. Keep one active render and one latest replacement. New layout evidence
retires the previous generation, and only a matching open generation publishes.
Read-only source timestamps do not invalidate unchanged pixels.

Return RGB888 pixels and the exact layout together. Paint browser previews from
those pixels. A native font or transport optimization must preserve this
contract. The renderer has no device sink; #33 owns mode and writer integration.

The host refreshes the selected source each second and on relevant requests.
The service cadence is independently configurable from 1 to 60000 ms through
host construction, defaulting to an experimental 3000 ms. Actual publication
requires a host tick and may occur later than the minimum cadence; a cadence
longer than the page interval can omit intermediate pages. This is no physical
cadence qualification.

## Consequences

No new state store or provider reducer is needed. Shared consumer policy owns
notice retention across restart and new turns. A slow or failed renderer returns
pending/error without obsolete pixels. No speculative success or device effect
is inferred. The bundled font and synthetic examples are reproducible on both
supported hosts; physical readability and timing need separate acceptance.
