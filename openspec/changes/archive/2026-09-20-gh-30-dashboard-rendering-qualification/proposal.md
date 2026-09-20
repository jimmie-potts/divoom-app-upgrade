## Why

[Issue #30](https://github.com/jimmie-potts/divoom-app-upgrade/issues/30) needs a bounded way to qualify dashboard updates without treating HTTP acknowledgments as visible results. The existing smoke tools do not exercise dashboard layouts or coalesce rapid changes.

## What Changes

- Add an offline-default synthetic dashboard experiment with bounded cadence, duration, uploads and no retries, using the existing adapter queue.
- Gate physical execution on explicit target, run identity and consent, and share the backend's target ownership lock with both protocol tools.
- Produce exact RGB browser previews and redacted transport receipts, with a separate physical observation procedure.
- Document the text/item candidate's evidence and exact-preview limitations; expose no unqualified raw text commands.
- Keep the measured method/cadence decision and physical acceptance open in #30 after source delivery.

## Capabilities

### New Capabilities

- `dashboard-qualification`: Synthetic comparison cases, bounded execution, evidence and preview contracts.

### Modified Capabilities

None. Existing command and application semantics remain unchanged; the legacy spike receives the same local exclusivity safeguard as the new tool.

## Impact

Device qualification modules, opt-in CLI scripts, tests, protocol/hardware documentation and a scoped ADR. No monitoring runtime, new dependency, installation or physical execution. The hub guide companion records tooling delivery separately from measured transport selection.
