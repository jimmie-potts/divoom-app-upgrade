## 1. Released core and durable ownership

- [x] 1.1 Pin the release archive and receipt; verify checksum, isolated imports and shared fixtures.
- [x] 1.2 Implement private revision-checked atomic storage and exclusive ownership; verify restart, concurrent process, interrupted-write, privacy and retention tests.

## 2. Host and selected facade

- [x] 2.1 Compose embedded hosting, scoped credentials and bounded routes; verify negative auth, replay, labels, filters, acknowledgment and no-device integration tests.
- [x] 2.2 Reuse SSE and implement remote selected-source access; verify reconnect, stalled consumer, stale host and identical operation contracts without local storage.
- [x] 2.3 Add quiesce/export/import and explicit rollback tooling; verify empty-destination, identity/revision preservation, restart fencing and cutover tests.
- [x] 2.4 Add authenticated fail-open producer examples; verify shared normalization and bounded failure.

## 3. Documentation and delivery

- [x] 3.1 Document architecture/operation decisions and source-only setup in docs/agent-monitoring.md; inspect examples and link guide companion evidence.
- [x] 3.2 Verify Node 24 application/browser evidence and run both workflow checks; record actual inventory/results. Synchronize/archive before final delivery review.
- [x] 3.3 Reconcile the Hub guide companion and link its reviewed evidence.

## External delivery gates

After implementation acceptance and archive, publish the ready candidate, obtain
independent Standards and Specification reviews, require current PR CI, guarded
merge and main CI before closing the issue. These post-implementation gates are
tracked in the PR rather than checked off before they occur.

## Acceptance evidence

Node 24 canonical checks at ae25a76bb6c597c96e1f08b81300878932ca46b9 passed with 535 application tests and 52 browser tests plus workflow checks.
Remote HTTP filtering/change-feed parity, actual monitor-socket backpressure and
failed-spawn cleanup regressions pass. Guide companion: https://github.com/jimmie-potts/agent-device-hub/pull/112.
The frozen Linux performance limits remain unmet; see
`docs/performance/gh-31-embedded-host.json`. The owner moved measurement and numeric qualification to
[hardening #61](https://github.com/jimmie-potts/divoom-app-upgrade/issues/61) on September 20.
That work follows #31 and does not block feature delivery or this archive. Frozen
limits and failed receipts remain unchanged; performance acceptance is not claimed.

Guide companion #112 merged at `ee1f4405798ea1c6645cec1f9d17b288f5feffd3`
with independent reviews and the verified guide-only CI exception.

After the authorized scope update, npm ci, check:workflow and test:workflow
passed with Node 24. The pre-sync inventory was 13 specifications, one active
change and 14 archived changes; all 10 workflow fixtures passed. Application
and browser evidence remains applicable because this update changes prose and
specification scope only. Final archive validation is recorded in the PR.
