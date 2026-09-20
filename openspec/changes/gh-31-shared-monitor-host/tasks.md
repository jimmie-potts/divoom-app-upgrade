## 1. Released core and durable ownership

- [ ] 1.1 Pin the release archive and receipt; verify checksum, isolated imports and shared fixtures.
- [ ] 1.2 Implement private revision-checked atomic storage and exclusive ownership; verify restart, concurrent process, interrupted-write, privacy and retention tests.

## 2. Host and selected facade

- [ ] 2.1 Compose embedded hosting, scoped credentials and bounded routes; verify negative auth, replay, labels, filters, acknowledgment and no-device integration tests.
- [ ] 2.2 Reuse SSE and implement remote selected-source access; verify reconnect, stalled consumer, stale host and identical operation contracts without local storage.
- [ ] 2.3 Add quiesce/export/import and explicit rollback tooling; verify empty-destination, identity/revision preservation, restart fencing and cutover tests.
- [ ] 2.4 Add authenticated fail-open producer examples and Linux measurement; verify shared normalization, bounded failure and frozen budget comparisons.

## 3. Documentation and delivery

- [ ] 3.1 Document architecture/operation decisions and source-only setup in docs/agent-monitoring.md; inspect examples and link guide companion evidence.
- [ ] 3.2 Run Node 24 npm run check and npm run test:browser, synchronize/archive the exact change and run both workflow checks; record actual inventory/results.
- [ ] 3.3 Publish the candidate, obtain independent Standards and Specification review, require current PR CI, guarded merge and main CI before closing the issue; reconcile hub guide sources.
