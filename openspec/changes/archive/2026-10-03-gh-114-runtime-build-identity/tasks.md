## 1. Build and server identity

- [x] 1.1 Demonstrate missing health identity with a failing integration test and retain the red result.
- [x] 1.2 Stamp qualified source builds and freeze validated metadata per application startup; verify clean/dirty/unknown source and process-stability tests.
- [x] 1.3 Add matching health and diagnostic schemas/responses; verify shared identity and malformed metadata cases.

## 2. Settings and policy

- [x] 2.1 Show short/full build identity and clipboard outcome through the existing controller snapshot; verify known/unknown identity and copying in browser tests.
- [x] 2.2 Document build provenance and source-only delivery pending #115; align UI policy while retaining automated checks, and inspect the resulting instruction paths.

## 3. Source acceptance

- [x] 3.1 Run npm run check and npm run test:browser successfully, reporting actual workflow inventory and retaining results.
- [x] 3.2 Verify all three spec deltas, synchronize them and prepare the completed source change for archive before independent review; installed acceptance remains linked to #115.
