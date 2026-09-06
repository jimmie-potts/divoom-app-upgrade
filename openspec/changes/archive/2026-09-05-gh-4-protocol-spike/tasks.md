## 1. Protocol source and transport

- [x] 1.1 Record pinned protocol provenance and license metadata, including inaccessible vendor documentation and reset disagreement.
- [x] 1.2 Implement pinned-destination HTTP transport and parser; prove request/response rejection and cancellation with fake-server red/green tests.

## 2. Adapter and experiments

- [x] 2.1 Implement serialized ID/frame/control operations and provisional profile validation; verify payload order, snapshots, timeouts and stale-generation behavior.
- [x] 2.2 Add synthetic static/GIF fixtures and separate opt-in CLI stages; verify GIF bytes and that missing approval/IP never starts transport.

## 3. Source acceptance

- [x] 3.1 Document commands, evidence gates and pending hardware observations; verify application startup remains simulator-only.
- [x] 3.2 Run npm run check and browser regression checks; verify complete source artifacts and requirements before sync/archive. Physical acceptance remains open in issue #4.
