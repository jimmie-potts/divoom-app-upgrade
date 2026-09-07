## 1. HTTP contracts and admission

- [x] 1.1 Add shared schemas, typed errors and host/origin/auth admission; prove invalid requests have no effects with integration tests.
- [x] 1.2 Add bounded multipart media and revisioned playlist routes; prove uploads, references, revision races and safe previews.

## 2. Player and events

- [x] 2.1 Add request identity reservation, replay/conflict handling and authoritative snapshots; prove concurrent replay, expiration and restart rejection.
- [x] 2.2 Add player subscriptions and bounded SSE replay/resync; prove real HTTP reconnect, backpressure/shutdown and continued backend playback.
- [x] 2.3 Add persisted validated device settings and simulator controls; prove arbitrary destinations are rejected, runtime recording is disabled, and fake observations remain separate from health.

## 3. Startup and delivery validation

- [x] 3.1 Wire private library/player startup and graceful closure; prove process restart and browser health behavior using isolated data.
- [x] 3.2 Document API contracts, dependency/license and limits; pass full application, workflow and browser checks before sync/archive and independent review.
