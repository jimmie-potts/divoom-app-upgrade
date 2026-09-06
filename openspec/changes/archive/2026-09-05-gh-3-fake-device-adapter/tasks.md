## 1. Operation contracts and complete frames

- [x] 1.1 Add typed simulator operations and timing; demonstrate probe behavior with a focused red/green test.
- [x] 1.2 Validate and snapshot complete RGB animations and controls; verify synthetic byte order, lengths, delays and mutation isolation with focused tests.

## 2. Writer and failure boundaries

- [x] 2.1 Serialize uploads and controls with an injected clock; verify non-interleaved effects, FIFO order and separate loading estimates.
- [x] 2.2 Implement queued/active cancellation, deadlines and generation invalidation; verify prompt settlement, partial effects and absence of stale callbacks.
- [x] 2.3 Inject offline/upload failures and recover without replay; verify typed outcomes and writer release after each failure.

## 3. Documentation and integration

- [x] 3.1 Document adapter usage, ownership and evidence limits in the development guide and ADR; check examples against exported types and preserve the simulator health contract.
- [x] 3.2 Run npm run check and verify complete artifacts and capability scenarios for sync/archive using workflow validation.
