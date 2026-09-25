## 1. Startup presentation

- [x] 1.1 Add device-mode startup restore of a saved Monitor selection; observe the focused failing test, then verify one upload through the serialized adapter, paused playback context, failed-upload suspension without retry and explicit reactivation (`tests/integration/monitor-startup.test.ts`).
- [x] 1.2 Verify simulator, saved Media and retained screen-off startup stay passive, and the existing simulator restart test still reports inactive participation.

## 2. User service

- [x] 2.1 Add the systemd user-service template and environment example; verify the example environment loads device mode, monitoring, controller flag and identity through `loadConfig`, and the unit keeps restart, stop-signal and timeout settings (`tests/unit/service-template.test.ts`). Record `systemd-analyze --user verify` on a filled copy.
- [x] 2.2 Verify graceful SIGTERM stop at process level: active playback drains, the process exits 0 and the same data directory reopens with the session paused (`tests/integration/process.test.ts`).

## 3. Documentation and delivery

- [x] 3.1 Document install, upgrade, rollback and removal, add the controller flag to the installed runbook, amend ADR 0018 and update monitoring, device application, playback and product documents.
- [x] 3.2 Run Node 24 `npm run check` and `npm run test:browser`, synchronize and archive affected specs, and pass both workflow checks. Keep review and CI evidence in the PR.

## Acceptance evidence

Node 24.21.0 `npm run check` passed: 594 tests in 65 files, plus both workflow checks. `npm run test:browser` passed 64 tests. The first run of `tests/integration/monitor-startup.test.ts` failed because device startup sent no upload; it passed after the restore. `systemd-analyze --user verify` accepted a filled copy of the unit. A transient `systemd-run --user` simulator unit started and stopped with SIGTERM, reporting `Result=success` and exit status 0. Installing the service on the owner's host, the WSL-restart check and hub readiness remain separately authorized.
