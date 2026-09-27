## 1. Pixoo plug-in parts

- [x] 1.1 Launch environment, installed-port refusal and private data directory guard with focused red/green unit tests.
- [x] 1.2 Transport guard, readiness probe and boundary checks; prove ambient device settings stay simulator-only and that the guard records and blocks attempts.
- [x] 1.3 Synthetic scenarios seeded through application code; prove concurrent runs, reseed on the recorded port and occupied-port failure.
- [x] 1.4 Capture steps and `control-*` negative controls; prove the reference passes, each control fails at its named assertion and failed captures keep screenshot and video.
- [x] 1.5 Feature map in the development guide with a drift test.

## 2. Shared core integration

- [x] 2.1 Add the `verify` wrapper with its Node 24.5 check and type the plug-in as the core's `AppPlugin`, with read-only checks repeated by `doctor`.
- [x] 2.2 Mark state-changing steps and controls `fresh`; save the 64×64 results with `t.attach`, failing when it is unavailable; run the browser checks through `runCaptureStep`.
- [x] 2.3 Run start under ambient device settings, doctor, reference and control captures, handoff, extend, a post-handoff capture, stop, restart, two concurrent runs with a reseed, a one-minute lease expiry and a failed start against real user units; stop everything started.
- [ ] 2.4 Vendor the released `@jimmie-potts/app-verify` archive with its checksum and receipt, and repeat 2.3 from a clean candidate.

## 3. Source delivery evidence

- [ ] 3.1 Run `npm run check` and `npm run test:browser` without credentials or devices; keep receipts outside Git.
- [ ] 3.2 Verify the capability delta and current CLI inputs for synchronization/archive; run strict workflow checks.
