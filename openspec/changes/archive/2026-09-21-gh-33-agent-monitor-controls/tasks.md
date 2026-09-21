## 1. Ownership and selected view

- [x] 1.1 Add the paused-generation dashboard writer through Player; demonstrate a failing focused test, then verify exact pixels, one queue, stale-generation rejection and media/screen cancellation.
- [x] 1.2 Add persistent mode/filter/cadence and bounded presentation orchestration; verify fake-clock mode changes, bursts, no Media takeover, paused context, failed-write suspension and inactive recovery.

## 2. Shared commands and browser

- [x] 2.1 Add browser/native integration snapshots and strict guarded commands over the existing ledger; verify replay, multi-client revision/generation conflicts, authentication/revocation, sanitized finite capabilities and unchanged released v1/MCP behavior.
- [x] 2.2 Connect selected-source label/acknowledgment operations and project/session filters; verify exact preview/display selection, retained notices, remote cutover/rollback and no second owner.
- [x] 2.3 Add the monitor panel and shared frontend adapter; verify desktop/mobile full details, explicit labels/filter/empty state, exact canvas pixels, mode/participation controls and stale reconnect handling.

## 3. Delivery validation

- [x] 3.1 Document product/ADR/monitoring/API ownership and recovery; inspect synthetic UI and maintain a linked Hub guide candidate with correct source/physical boundaries.
- [x] 3.2 Run Node 24 check and browser suites, synchronize/archive every affected OpenSpec capability and pass both workflow checks; retain evidence for independent source and guide reviews.


## Acceptance evidence

Node 24.21.0 `npm ci` and `npm run check` passed: 582 tests in 62 files,
10 workflow fixtures. `npm run test:browser` passed 58 desktop/mobile checks
with stable built assets. An earlier concurrent build caused a static-page 404;
the complete isolated rerun passed without product changes. Initial focused red
runs established the missing paused dashboard writer, integration routes and
Monitor tab before implementation. Current tests cover guarded uploads,
coalescing/cadence, Media preservation, uncertain transport, screen/restart,
revision/replay conflicts, native revocation and selected-owner cutover/rollback.
Desktop/mobile Monitor screenshots were inspected. No hardware was contacted.

The coordinator's isolated Hub companion `codex/pixoo-gh-33-guide` contains
candidate narrative and monitoring-diagram changes. Generation, five maintenance
checks and nine diagram validations pass. Final source pins/status, guide browser
checks, publication and independent source/guide reviews remain delivery gates;
this archive does not claim those gates passed.
