# ADR 0015: Dashboard transport qualification boundary

Status: Source experiment design for [issue #30](https://github.com/jimmie-potts/divoom-app-upgrade/issues/30). Physical method and default cadence selection pending.

Use complete, locally rasterized RGB pictures as the provisional test candidate.
The same bytes can populate the browser preview and existing serialized adapter.
The runner coalesces pending changes and bounds cadence, duration and traffic.
Its 3000 ms default is an experiment setting, not a measured recommendation.

Device-rendered text and item lists are excluded from executable qualification
at this stage. The [protocol evidence](../protocol-spike.md#candidate-evidence-checked-september-20-2026)
does not establish exact font/layout reproduction, item types or clear semantics.
The issue's exact-preview requirement therefore prevents accepting that candidate.
This is an evidence-based source exclusion, not a physical unsupported-command
result. Do not add guessed payloads or claim that raster previews prove hardware.

Both standalone protocol tools share the backend's local target lock and retain
it through transport closure. Operator exclusion of other native users, hosts,
Windows/WSL owners and external apps is still required. No new runtime owner,
monitor service or automatic recovery is introduced.

After an authorized physical session, record visible latency, interruptions,
readability, clearing, bursts and recovery with sample sizes and uncertainty.
Select a method and configurable default only from that evidence. If no candidate
meets the requirements, retain a blocked feasibility result and identify the
needed product decision. #32 pure rendering remains independent; #33 consumes
the eventual measured transport decision.
