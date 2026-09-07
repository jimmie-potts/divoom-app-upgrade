# ADR 0007: Deterministic playback and durable paused recovery

Accepted September 6, 2026 for [issue #7](https://github.com/jimmie-potts/divoom-app-upgrade/issues/7).

## Decision

Add a backend playback package with a storage port and library-backed store.
Persist the immutable snapshot and its retained-session ownership together in
SQLite migration 3. A separate checkpoint file would introduce another
filesystem/database commit gap. Keep the checkpoint contract in the persistence
package to avoid a circular package dependency.

Serialize short command/context changes. Cancel generations immediately when a
user supersedes work; run preparation and upload outside that command queue.
Accept their continuations only while the generation and intent still match.
This lets stop retire an incomplete upload without waiting for its completion.
All device effects still use the existing adapter FIFO. Automatic advancement
preserves queued controls instead of cancelling brightness at a short dwell.

Keep playback intent independent from device availability. Start dwell after
upload and estimated readiness, and retain no runtime deadlines in durable
context. Reopen paused; explicit resume uploads the current rendition again and
starts its full policy. Device loop metadata cannot provide finite-play evidence.

Keep the forward cycle cursor separate from selected history. Append history
only at estimated readiness. This distinguishes a selected-but-skipped item from
one that started playing. Shuffle uses injected randomness, avoids immediate
cross-cycle repeats, and retains up to 10000 actual visits.

Bound reconnect probes at three exponential delays by default. Successful probes
followed by failed uploads consume the same recovery budget. Exhaustion pauses in
error; only a started item resets the automatic budget. A takeover notification
pauses without a background reclaim loop. Actual takeover detection remains a
hardware/integration responsibility.

## Consequences

Current and next complete renditions occupy bounded memory. Backend preparation
never preloads the display. A bounded frame-loading helper avoids revalidating
all frames once per requested frame. Media profile limits remain unchanged.

A checkpoint retains originals/renditions after playlist deletion until context
is replaced or cleared. No expiry guesses are made after a process crash.
Checkpoint reads reject mismatched session ownership; migration and replacement
failures preserve earlier committed state. There is no downgrade/reset path.

The player and adapter need the same clock domain. Timings remain estimated;
cancelled requests may already have affected hardware. Source delivery does not
wire HTTP/UI controls, start a device service or establish hardware accuracy.
