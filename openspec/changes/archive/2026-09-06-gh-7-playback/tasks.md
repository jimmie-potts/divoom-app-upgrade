## 1. Durable context

- [x] 1.1 Add checkpoint migration and atomic immutable snapshot/retention operations; prove capture, stale saves, release protection and paused restart with isolated catalog tests.
- [x] 1.2 Add the playback workspace and bounded frame-loading storage port; verify effective frame timing and retained rendition loading.

## 2. Deterministic orchestration

- [x] 2.1 Implement loading/ready/dwell transitions and independent intent with a monotonic clock; prove duration/total-play timing and late-callback behavior.
- [x] 2.2 Implement cancellation, pause/resume/stop, repeat/shuffle/history and restart-with-changes; prove stop/skip during upload and command spam with fake time.
- [x] 2.3 Implement serialized display controls, bounded reconnect, item-failure exhaustion and takeover pause; prove brightness ordering, screen behavior and reconnect-after-stop.
- [x] 2.4 Prove process restart restores paused context without old timestamps, preserves referenced renditions and blocks competing player owners.

## 3. Delivery preparation

- [x] 3.1 Document contracts, defaults and source/hardware limits; pass application/browser/workflow checks as input to specification sync/archive and independent review.
