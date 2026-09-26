## 1. Characterize

- [x] 1.1 Run ledger ordering, replay, failure, observer isolation, capacity and retention tests on unchanged production code; retain baseline results.
- [x] 1.2 Inspect all producers, native attribution and endpoint-dependent accounting; preserve compatibility tests for late uploads, traversal and probe recovery.

## 2. Refactor

- [x] 2.1 Add typed operation metadata separately from replay fingerprints and migrate all producers; verify typecheck and focused event assertions.
- [x] 2.2 Replace ControllerState tuple/result casts with exhaustive tagged handling; verify local-only operations stay unprojected and native compatibility remains green.
- [x] 2.3 Record the internal boundary and failure/recovery behavior in ADR 0022; inspect unchanged public contracts and writer ownership.

## 3. Validate

- [x] 3.1 Run npm run check, npm run test:controller and Chromium-backed npm run test:browser under Node 24; record actual results.
- [x] 3.2 Obtain current OpenSpec status/archive instructions, confirm no affected spec delta, archive the complete change and pass both workflow checks before independent review.

## Evidence

The unchanged production baseline passed 25 focused ledger/service/controller tests;
the separate enabled/disabled capacity characterization passed both cases on the
same original source. The initial retention assertion was corrected to match
insertion-order eviction before the refactor. No pre-existing defect is claimed.

The candidate passed `npm run check` (644 tests, 19 current specifications and
10 workflow fixtures), `npm run test:controller` (239 tests), and
`npm run test:browser` (68 scenarios). Typechecking includes negative cases for
literal and union operation-key mismatches. Baseline and candidate logs are
retained in the canonical checkout's ignored issue evidence directory.

Current status and archive instructions were retrieved successfully. The change
explicitly skips specs; controller-api and hub-controller-api remain unchanged.
Revision-specific review and hosted CI evidence belongs in the PR.
