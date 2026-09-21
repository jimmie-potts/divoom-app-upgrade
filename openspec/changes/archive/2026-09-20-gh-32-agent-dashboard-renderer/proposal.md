## Why

[#32](https://github.com/jimmie-potts/divoom-app-upgrade/issues/32) needs a readable Pixoo projection of the delivered shared session source. Pixel rendering and preview must work before physical transport is selected.

## What Changes

- Add deterministic dashboard layout, four-row pagination and a bundled bitmap font.
- Add a bounded latest-snapshot rendering service with injectable time and generation retirement.
- Expose authenticated rendition reads and an exact synthetic browser preview, without a monitor panel or display takeover.
- Document symbols, label fallback, cadence and shared-state semantics.

## Capabilities

### New Capabilities

- `agent-dashboard-renderer`: deterministic paged monitoring rendition and bounded preview publication.

### Modified Capabilities

None. Existing session-source, authentication, device and playback contracts are preserved.

## Impact

Server monitoring composition, new renderer modules and tests, synthetic browser examples, and docs/agent-monitoring.md. No new dependency, provider mapper, persistence engine, physical writer or installed hook. The delivery coordinator also owns the required Hub guide companion.
