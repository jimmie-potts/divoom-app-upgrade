## Context

The delivered SessionSource returns bounded shared snapshots for embedded and remote ownership. The monitor host refreshes once per second. Design is required because pagination, asynchronous rendering and shutdown interact. See proposal.md for scope.

## Goals / Non-Goals

Provide reusable layout and exact RGB rendition data, with authenticated reads and standalone synthetic browser examples. The shared Hub browser and #33's mode controls remain separate. No persistent renderer state, device scheduling, native font substitution or transport selection is introduced.

## Decisions

- Keep renderer modules in the server beside the consuming session-source facade, using type-only imports for the shared snapshot. Pure functions take snapshots, page and time; they never ingest provider events.
- Use ordinal full-identity tie-breaking, independent of arrival order. Hide children with a known parent identity; show unknown-parent sessions as top-level with unknown evidence retained. Prioritize blocked, continuing question, retained notice, other. Count attention across all top-level sessions even when filtered.
- Use a 3x5 bundled bitmap alphabet. Rows use separate provider, activity, attention, label, child-count and notice/freshness indicators; the footer separates connection from collector. Full row details stay in the layout contract. This avoids native font/platform differences.
- Pager uses an injected monotonic clock, clamps on membership/filter changes and resets its deadline on those changes. A delayed tick advances by elapsed ten-second intervals. Ordinary evidence refreshes do not reset rotation.
- Rendering retains one active job and one replacement input. New input invalidates the active generation immediately. Completion publishes only if current and open. Cadence starts from render start; failures preserve an explicitly pending/error status rather than claim a current preview. Closing retires all work. No sink capable of device writes is supplied.
- The authenticated rendition endpoint returns a versioned layout and RGB array from the most recent current generation, or pending/error metadata without stale pixels. Consumers resync through current reads. Synthetic HTML is generated from the same rendition contract and paints RGB using canvas ImageData, with native/enlarged views and text-only full details.
- Use a source-only default cadence of 3000 ms as a configurable experiment value, not physical qualification. Host construction accepts the renderer option; page duration remains fixed at 10000 ms.

## Risks / Trade-offs

Tiny text requires an explicit legend and physical readability remains unverified. A slow renderer can withhold output during continuous changes; bounded work and current-generation correctness take precedence over publishing obsolete frames. Tests use deferred renders to observe this behavior. Known child counts are attributable lower bounds when relationship evidence is unavailable.

## Migration Plan

No database change. Existing monitoring opt-in enables preview production; disabling monitoring removes its routes. Rollback to the prior source leaves shared state intact. Startup and Media ownership are unchanged.
