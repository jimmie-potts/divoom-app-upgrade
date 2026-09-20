## 1. Released core and durable ownership

- [x] 1.1 Pin the release archive and receipt; verify checksum, isolated imports and shared fixtures.
- [x] 1.2 Implement private revision-checked atomic storage and exclusive ownership; verify restart, concurrent process, interrupted-write, privacy and retention tests.

## 2. Host and selected facade

- [x] 2.1 Compose embedded hosting, scoped credentials and bounded routes; verify negative auth, replay, labels, filters, acknowledgment and no-device integration tests.
- [x] 2.2 Reuse SSE and implement remote selected-source access; verify reconnect, stalled consumer, stale host and identical operation contracts without local storage.
- [x] 2.3 Add quiesce/export/import and explicit rollback tooling; verify empty-destination, identity/revision preservation, restart fencing and cutover tests.
- [ ] 2.4 Add authenticated fail-open producer examples and Linux measurement; verify shared normalization, bounded failure and frozen budget comparisons.

## 3. Documentation and delivery

- [x] 3.1 Document architecture/operation decisions and source-only setup in docs/agent-monitoring.md; inspect examples and link guide companion evidence.
- [ ] 3.2 Run Node 24 npm run check and npm run test:browser, synchronize/archive the exact change and run both workflow checks; record actual inventory/results.
- [x] 3.3 Reconcile the Hub guide companion and link its reviewed evidence.

## External delivery gates

After implementation acceptance and archive, publish the ready candidate, obtain
independent Standards and Specification reviews, require current PR CI, guarded
merge and main CI before closing the issue. These post-implementation gates are
tracked in the PR rather than checked off before they occur.

## Acceptance evidence

Node 24 canonical checks pass with 295 application tests plus workflow checks.
Remote HTTP filtering/change-feed parity, actual monitor-socket backpressure and
failed-spawn cleanup regressions pass. Guide companion: https://github.com/jimmie-potts/agent-device-hub/pull/112.
The frozen Linux performance limits remain unmet; see
`docs/performance/gh-31-embedded-host.json`. Task 2.4 and specification archive
remain blocked on performance acceptance. No budget or requirement is waived.

Guide companion #112 merged at `ee1f4405798ea1c6645cec1f9d17b288f5feffd3`
with independent reviews and the verified guide-only CI exception.
