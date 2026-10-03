## Why

The running Pixoo process does not report its source revision, so an updater
cannot distinguish an installed candidate from an older process. This implements
[issue #114](https://github.com/jimmie-potts/divoom-app-upgrade/issues/114), using
the accepted Hub install contract's build fields.

## What Changes

- Stamp clean source identity during the build and load it once at server startup.
- Return the same build identity from health and diagnostics, with explicit unknown provenance.
- Show a short revision and a copyable full revision in Settings.
- Align the UI verification policy with the owner's removal of human UI approval;
  retain browser/accessibility checks and independent reviews.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `application-foundation`: process-owned build identity in readiness.
- `local-operations`: diagnostic build identity.
- `controller-ui`: read-only, copyable build information in Settings.

## Impact

Build tooling, server/core response schemas and the existing Settings view change.
No dependencies, device operations, installation or state migration are added.
Installed readback is batched into the existing updater issue #115; this source
delivery alone does not establish installation.
