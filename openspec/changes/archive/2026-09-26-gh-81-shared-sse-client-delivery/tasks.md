## 1. Characterize

- [x] 1.1 Run 23 controlled lifecycle tests on unchanged source; verify headers, registration reservation, queue/authentication sequencing, timers, backpressure and shutdown differences.
- [x] 1.2 Refresh to verified merged #80 and rerun characterization before extraction; inspect unchanged HTTP security, protocol and playback ownership.

## 2. Extract

- [x] 2.1 Add one private client-delivery implementation and migrate both feeds; verify the baseline lifecycle tests remain unchanged and pass.
- [x] 2.2 Preserve each feed's signatures, cursors, history, replay/resync and authentication wiring; verify separate browser/native/monitor and mixed-feed/HEAD integration suites.
- [x] 2.3 Record the shared boundary and intentional policy differences in ADR 0023; inspect single-writer and state-owner preservation.

## 3. Validate

- [x] 3.1 Run npm run check, npm run test:controller and Chromium-backed npm run test:browser under Node 24; record actual results.
- [x] 3.2 Retrieve current OpenSpec status/archive instructions, verify no delta specs, archive and pass workflow checks before independent review.

## Evidence

The initial 22 lifecycle cases passed on unchanged source at `2e595cb` and after
refreshing to #80's merged `979bd73`. The expanded 23-case baseline also passed
against the original feed files from `979bd73`. Four extraction cleanup cases
add drain-listener/deadline checks, for 27 passing focused lifecycle cases.
No public behavior regression or performance gain is claimed.

`npm run check` passed with 671 tests, 19 current specifications and 10 workflow
fixtures. `npm run test:controller` passed 239 tests and Chromium-backed
`npm run test:browser` passed 68 scenarios. Baseline and candidate logs are kept
in the canonical checkout's ignored issue evidence directory. An unused mock
parameter was corrected after lint rejected it; no check or assertion was weakened.

Current status/archive inputs were retrieved successfully. There are no delta
specs to synchronize. Revision-specific reviews and hosted CI are recorded in
the PR, after the complete change is archived and workflow checks pass again.
