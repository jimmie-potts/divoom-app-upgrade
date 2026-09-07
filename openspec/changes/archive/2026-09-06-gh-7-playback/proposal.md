## Why

[Issue #7](https://github.com/jimmie-potts/divoom-app-upgrade/issues/7) needs deterministic orchestration on top of the delivered media catalog and serialized device adapter. Criteria 1-7 require timing, controls and durable recovery that cannot be supplied by browser timers or device loop metadata.

## What Changes

- Add a backend playback library with injectable clock/randomness, immutable sessions, generation cancellation and bounded reconnect handling.
- Persist checkpoint context and rendition retention atomically in the library catalog; restore paused without old clock values.
- Implement the handoff's dwell, pause/resume/stop, traversal, display and takeover boundaries with fake-clock and isolated restart evidence.

## Capabilities

### New Capabilities

- `playlist-playback`: deterministic session playback, traversal, device coordination and paused recovery.

### Modified Capabilities

None. Existing standalone media, adapter and playlist contracts remain available; checkpoint ownership adds a new retained-session use case.

## Impact

New `@pixoo/playback` workspace; additive library checkpoint migration and API; bounded media-frame loading helper; tests and ADR 0007. No HTTP/UI wiring, startup changes, additional third-party dependency, installation or device actions.
