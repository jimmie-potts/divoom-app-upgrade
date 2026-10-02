## Why

Routine missing ordering evidence dims otherwise current session cards and displays `UNSURE`. [Issue #102](https://github.com/jimmie-potts/divoom-app-upgrade/issues/102#acceptance-criteria) defines the accepted presentation policy and full browser evidence display.

## What Changes

- Distinguish routine optional ordering/read limits from evidence conflict, loss and uncertain session state.
- Display every unavailable dimension/reason on the Monitor card without changing shared evidence.
- Cover project and non-project layouts in deterministic checks, documentation and committed previews.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-dashboard-renderer`: explicit dimension/reason uncertainty policy, including unknown turn.
- `agent-monitor-controls`: complete unavailable evidence on each session card.

## Impact

Changes are confined to Pixoo projection, browser presentation, synthetic fixtures and documentation. Shared contracts, source ownership, device commands, persistence and dependencies remain unchanged. Delivery is source-only.
