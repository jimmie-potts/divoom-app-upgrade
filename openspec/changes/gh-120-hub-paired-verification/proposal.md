## Why

[Pixoo #120](https://github.com/jimmie-potts/divoom-app-upgrade/issues/120): the Hub's integrated verification preview ([Hub #495](https://github.com/jimmie-potts/agent-device-hub/issues/495)) pairs one disposable Pixoo run with one disposable Hub run. Pixoo must act as a real Hub consumer there: it reads the Hub run's session feed as a remote owner and serves its controller API to that Hub. The simulator verification plug-in from #118 seeds its own embedded owner, keeps the controller API off and lets the transport guard reach only the run's own port.

## What Changes

- Add a `hub-paired` scenario on `@jimmie-potts/app-verify` 1.1. It requires the non-secret input `hub-feed`, the Hub run's origin. It reads the feed token and the Hub's controller token from private files the orchestrator writes into the run directory. It seeds the existing remote monitor configuration for owner `verify-owner`, registers the controller token by digest, and seeds no local sessions.
- In `hub-paired` only, launch with the native controller API and the Hub port declared to the transport guard. Every other launch declares no paired port, and the guard keeps the controller setting only in a paired launch.
- Announce the `controller` endpoint, the run's main origin, from the `hub-paired` launch on.
- Make `no-physical-transport` accept a connection to the Hub port only from a launch that declared it, and require the serving process's pairing to match its scenario. Add a `hub-feed` check, the `hub-sessions` capture step and the `control-hub-feed-stale` control.
- Add `GET /api/device/simulator`: counts of operations the simulator's writer admitted and completed, for the orchestrator's single-command assertion. The fake adapter keeps these counts even with history disabled.
- Add `registerCredential`, which stores the digest of a token another party generated, beside `provisionCredential`.
- Vendor the released `@jimmie-potts/app-verify` 1.1.0 core and document the pairing convention.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulator-verification`: the paired scenario, its inputs and credentials, the pairing-aware transport boundary and checks, the paired capture step and control, and the feature map.
- `device-adapter`: operation counts that survive disabled history.
- `controller-api`: the simulator writer count route.

## Impact

Changes `scripts/verify/`, `packages/device` (fake adapter), `apps/server` (one read-only simulator route and a credential store helper), tests, the vendored core archive and the development, API, adapter and Hub integration guides. Standalone scenarios, their steps and their guard proof are unchanged, except that every launch now sets `APP_VERIFY_PAIRED_PORTS` explicitly. Source delivery installs nothing, starts no installed service and contacts no device. Hub #495 owns the integrated evidence with the real Hub.
