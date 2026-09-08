## 1. Consume the release

- [x] 1.1 Add a focused real-package conformance check and record the expected missing-dependency failure before adoption.
- [x] 1.2 Pin the verified released archive, source/checksum receipt and npm integrity; verify a clean npm ci and all upstream cases plus manifest hashes through the installed package.

## 2. Define consumer requirements

- [x] 2.1 Write the vocabulary mapping and provider/version evidence matrix; inspect every semantic, privacy, unsupported-signal and acknowledgment scenario against the canonical released docs.
- [x] 2.2 Write consumer/host/owner-transition requirements and update product, README and ADR pointers; verify no runtime, provider or device behavior is claimed or changed.
- [x] 2.3 Document the contract-consumer check in development and dependency records and verify it runs in the existing Linux/Windows application CI path.

## 3. Validate and synchronize

- [x] 3.1 Run npm run check on Node 24 and inspect all results, including the shared fixture corpus and workflow inventory.
- [x] 3.2 Obtain current OpenSpec lookups, synchronize the affected capability and archive this completed source change before final review; run both workflow checks afterward.
