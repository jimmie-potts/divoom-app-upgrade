## 1. Projection and pixels

- [x] 1.1 Implement layout and pager with red/green tests for priority, stable identities, filtering, child evidence, empty/overflow/clamping and independent ten-second time.
- [x] 1.2 Implement deterministic bitmap pixels and full layout details; verify clipping, label fallback/truncation, state symbols and RGB fixture hashes.

## 2. Current-state service and preview

- [x] 2.1 Implement bounded generation publication with deferred-render tests for bursts, errors, close, cadence and complete snapshot replacement.
- [x] 2.2 Compose authenticated rendition reads through SessionSource; verify unauthorized access, remote state/health and shared notice persistence/acknowledgment/new-turn behavior with isolated data.
- [x] 2.3 Generate synthetic browser examples from exact RGB and verify native/enlarged canvas bytes plus fake-device frame equality without hardware.

## 3. Delivery evidence

- [x] 3.1 Document layout, API, timing and limitations with synthetic examples and an ADR; inspect outputs and run Node 24 check and browser checks.
- [x] 3.2 Synchronize and archive the capability after current CLI lookups and all acceptance checks; run both workflow checks and report actual inventory.

All tasks are coordinator-owned in one candidate. Tasks 1 and 2 form one integrated behavior boundary; final independent Standards and Specification reviews cover the complete comparison, including concurrency and negative cases. No intermediate artifact is shipped separately. The Hub companion is coordinator-owned delivery work and remains a separate completion gate.
