## Why

[Issue #98](https://github.com/jimmie-potts/divoom-app-upgrade/issues/98): the installed Pixoo monitor packs four sessions per page into rows of single-letter codes in a 3×5 font. On September 25, 2026 every row read `C? 01A0D+ +0? ?T`. The codes need a legend, a six-cell label is too short to recognize, and nothing moves except the page number.

## What Changes

- The monitor shows one top-level session per screen and cycles through them on the existing ten-second page interval. Sorting, filtering and paging are unchanged apart from the page size.
- The owner chose candidate layout B from the sketches and asked for one change: the picture pulses only when the shown session needs attention, never merely because it is working. A large state tile at the top left shows activity through a colour and a black icon. Beside it are the provider mark and an activity word, with an attention chip, a turn-ended notice or a subagent count below them. The label fills two lines of a new 5×7 font below the tile, with ten characters per line. A detail line and a summary strip sit at the bottom. The strip shows the session count, the attention total, page dots and separate source and collector health marks.
- Uncertain evidence is spelled out as `UNSURE`, and the label is dimmed. An empty view shows `NO SESSIONS` above the summary strip.
- The identifier width becomes 20 display characters. The rule from #87 is unchanged: whole when it fits, the first and last characters of a long label around `…`, and `…` plus the end of an unlabeled session ID.
- When the shown session needs approval, input or an answer, the rendition has two frames at 500 ms. In the second frame the tile and the attention chip are dimmed. The device receives both frames in one upload and loops them, so the pulse adds no upload traffic. Every other picture remains one frame.
- The rendition keeps `rgb`, the first frame. It adds `frames`, every frame in order, and `frameDelayMs`. The Monitor tab animates the exact frames with nearest-neighbour scaling. The committed preview shows each frame.
- The qualification fixtures move to the one-session layout, and the qualification tool can submit a two-frame picture.
- The legend in `docs/agent-monitoring.md` shrinks to one short table, and ADR 0020 records the layout and the pulse transport.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-dashboard-renderer`: one session per screen with icons, colour, words and a two-line label, an attention-only two-frame pulse, and a rendition that carries every frame. The unlabeled-identifier scenario moves from four rows on one page to successive screens.
- `agent-monitor-controls`: a monitor picture can be one or two complete frames in one upload, under the same writer, guards and minimum interval.
- `dashboard-qualification`: the synthetic cases use the one-session layout and include a two-frame pulse. The tool accepts one- or two-frame pictures.

## Impact

`apps/server` changes: the pager page size, the identifier width, a 5×7 font, the renderer, the rendition, the presentation upload, the examples and the preview. `packages/playback` changes `Player.uploadDashboard` to take frames. `packages/device` gets new qualification fixtures and two-frame events. `apps/web` animates the preview. Tests, the committed preview, `docs/agent-monitoring.md` and a new ADR also change. The now-playing card, its 3×5 font, the shared vocabulary, the hub contracts and `pixoo-integration/1.0` command shapes are unchanged. The hub reads only `layout.revision` from the rendition. Physical readability on the Pixoo64, and whether the known GIF-transition flashing in #52 appears between dashboard pictures, need the owner's separate go-ahead.
