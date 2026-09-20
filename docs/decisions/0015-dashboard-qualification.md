# ADR 0015: Dashboard transport and cadence

Status: Accepted September 20, 2026 for the bounded profile in
[issue #30](https://github.com/jimmie-potts/divoom-app-upgrade/issues/30).

## Decision

Use complete, locally rasterized 64×64 RGB pictures through the existing
serialized adapter. The browser preview uses the same pixels. Select a
configurable 1000 ms minimum interval between submission starts for downstream
#33 integration, with latest-picture coalescing and one in-flight upload.
Keep 3000 ms available as a slower operator choice. This decision does not
change the qualification CLI's historical 3000 ms fallback; reproduce the
selected experiment with explicit `--cadence-ms 1000 --duration-ms 18000`.
The qualification tool accepts 1000–10000 ms. Neither this range nor its
20-upload cap is a measured device limit.

[Four authorized runs](../hardware-validation.md#dashboard-acceptance-september-20-2026-utc)
provide the bounded evidence. The 3000 ms run completed five pictures before
its cap; the 1000 ms run completed all six. Approximate event-to-visible medians
were 2.24 s and 0.32 s respectively. Cross-clock offset was not independently
calibrated; these are camera/clock estimates with roughly 0.1 s reading
uncertainty, not instrument-grade latency. The shorter interval reduced queue
delay for this fixture. No loading/blank frame was visible in inspected transition
windows, removed rows cleared, overflow pages changed, and the owner confirmed
readability. This is not sustained 1 Hz, soak or universal firmware qualification.

## Alternatives and limits

Device-rendered text and item lists are excluded. The
[protocol evidence](../protocol-spike.md#candidate-evidence-checked-september-20-2026)
does not establish exact font/layout reproduction, item types or clear semantics.
They cannot meet the agreed exact-preview requirement on current evidence.
This is a source-based exclusion, not a hardware command-failure result.
Full-frame replacement qualifies removal of the synthetic rows, not clearing
unknown firmware overlays. No guessed text, item or reset command is warranted.

A 3000 ms default delayed the latest burst to about 2.46 s after its event and
omitted the final clear within the 15-second cap. At 1000 ms that burst appeared
in about 0.48 s and the complete sequence fit within 18 seconds. The 3000 ms
option remains usable when a slower dashboard is desired. Faster intervals
were not tested and are not selected.

## Ownership and recovery

Both standalone protocol tools share the backend's local target lock and retain
it through transport closure. Operator exclusion of other native users, hosts,
Windows/WSL owners and external apps is still required. No new runtime owner,
monitor service or automatic recovery is introduced.

Cancellation may leave an in-flight picture applied. The recorded stop did so;
the process stopped further submissions, preserved the uncertain receipt and
withheld automatic restart. A separately authorized run replaced that retained
picture and completed the sequence. Preserve zero automatic retries after
uncertain effects and inspect the display before an explicitly authorized repeat.
No rollback of unknown original artwork is promised. Final row clearing retains
the summary strip and case marker by design.

#32 can deliver its pure renderer independently. #33 consumes this method and
configurable default through the existing owner/queue. #34 verifies the
integrated result with actual clients. This documentation records the experiment
and integration decision; it does not implement those downstream features or
change an executable contract, so no new product specification delta is needed.
