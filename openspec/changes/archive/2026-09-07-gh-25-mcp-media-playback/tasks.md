## 1. Shared service and bounded queries

- [x] 1.1 Move existing player admission into ControlService without changing fingerprints or HTTP snapshots; observe focused failures and pass HTTP-first/MCP-first canonical replay and immutable-receipt tests.
- [x] 1.2 Add strict shared expected-revision and single-media commands with schema-before-reservation validation; pass unknown-field, request-order/conflict/expiry and replayed-domain-failure tests.
- [x] 1.3 Add coherent bounded rendition/playlist summary queries; pass duplicate-name, search, page-boundary, many-renditions and maximum-playlist-size tests with no private fields.

## 2. Guarded capture and temporary context

- [x] 2.1 Add expected-revision capture and shared profile/policy validation before replacement; observe focused failures and pass stale-revision, unknown-rendition, incompatible-profile and computed-dwell-overflow cases preserving prior context.
- [x] 2.2 Implement guarded admission and synchronous committed-record adoption through the existing context queue; pass deferred-capture tests for stop, close, newer start, edits on either side of capture and old queued saves without new device effects or ownership failures.
- [x] 2.3 Add immutable temporary source metadata and single-rendition checkpoint/reference capture without saved rows; pass old-checkpoint reads, source-mutation rejection, rollback and reference-protected deletion tests.
- [x] 2.4 Apply established defaults and temporary-source controls, including unsupported restart-with-changes; pass fake-clock loading/pause/resume/navigation/history tests and saved-playlist regressions.
- [x] 2.5 Verify temporary context restores paused after normal and abrupt process restart without device writes; pass checkpoint, offline verification and retained-reference tests.

## 3. MCP tools and cross-client behavior

- [x] 3.1 Register the five strict extensions in the existing shared registry with accurate annotations and default/device-ID bindings; pass scope, target, malformed-input and discovery tests without changing transport authentication; verify catalog metadata remains absent from status, discovery, display outcomes and logs.
- [x] 3.2 Add bounded source/session/error projections and actionable revision conflicts; pass output-schema, private-field exclusion, loading/estimated-timing and possible-effects cases without claiming upload completion.
- [x] 3.3 Exercise the built endpoint with a real SDK client and fake device/clock; pass selection, repeated identity, browser/MCP race, loading cancellation and playback-after-disconnect cases through one ledger and writer.

## 4. Browser context and delivery

- [x] 4.1 Show the temporary-media label and disable only its saved-playlist restart action; pass desktop/phone browser checks and capture temporary plus unchanged saved-session screenshots for review.
- [x] 4.2 Update playback/library/API/MCP/UI documentation and ADR 0014 with source, replay, recovery and downgrade limits; verify examples against strict schemas and fake fixtures.
- [x] 4.3 Run Node 24 npm ci, npm run check and npm run test:browser with Chromium on the applicable supported-host matrix; retain actual local results under the approved GitHub Actions credit exception.
- [x] 4.4 Obtain current OpenSpec status and sync/archive instructions, verify all six affected capabilities, synchronize and archive after applicable tasks and browser evidence are complete; pass workflow checks before independent fixed-base/head review.
