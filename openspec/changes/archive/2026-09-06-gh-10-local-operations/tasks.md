## 1. Recovery

- [x] 1.1 Implement verified catalog/media export and offline backup; prove WAL retention and busy-owner rejection with integration tests.
- [x] 1.2 Implement fresh-directory restore and incomplete-output safeguards; prove round-trip playback recovery, corruption/path rejection and preservation of occupied targets.

## 2. Operation

- [x] 2.1 Add private-safe diagnostics and native CLI commands; verify real process success/failure, local security and bounded response tests.
- [x] 2.2 Verify playback survives closing the browser using an isolated production-server browser test.
- [x] 2.3 Document startup, shutdown, storage, bounds, recovery, wakefulness and Windows/WSL troubleshooting with an ADR; inspect commands against the implemented CLI.

## 3. Delivery checks

- [x] 3.1 Run full application/browser checks and verify completed artifacts are ready for the required synchronization and archive; verify both workflow commands.

Evidence: operations.test.ts covers WAL round-trip, paused recovery, busy owners,
occupied destinations, incomplete output, paths, checksums and catalog/settings
validation. operations-cli.test.ts exercises built commands from another cwd.
diagnostics.test.ts verifies privacy and origin rejection. The browser lifetime
scenario passed at desktop and mobile sizes. npm run check and npm run
test:browser passed; synchronization and archive are coordinator delivery gates.
