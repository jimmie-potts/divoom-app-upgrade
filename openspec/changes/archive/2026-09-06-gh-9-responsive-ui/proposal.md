## Why

[Issue #9](https://github.com/jimmie-potts/divoom-app-upgrade/issues/9) makes the delivered controller API usable in a browser. The current page only checks readiness.

## What Changes

- Add responsive media, playlist, player and device-settings views with accessible native controls.
- Preview immutable effective frames, edit independent item policies, and preserve saved versus playing revisions.
- Reconcile authoritative SSE state and revision conflicts; retry uncertain commands only with their original identity.
- Cover desktop and phone viewports with real simulator-backed browser journeys.

## Capabilities

### New Capabilities

- `controller-ui`: Browser media workflows, revisioned editing, player controls and simulator settings.

### Modified Capabilities

- `application-foundation`: Replace the initial UI absence claim with implemented simulator controls.
- `controller-api`: Include a server monotonic sample so browser remaining-time estimates do not compare unrelated clocks.

## Impact

React browser source, browser tests and usage documentation. Reuse installed dependencies and the existing same-origin API. Source-only, loopback-only simulator delivery; no installation, LAN exposure or device operation.
