## Context

`DashboardPager` sorts, filters and pages top-level sessions four to a page. `renderDashboard` draws one 12288-byte RGB frame per layout with the 3×5 font from `pixel-font.ts`. `DashboardService` coalesces renders into a rendition, and `MonitorPresentation` uploads the latest rendition through `Player.uploadDashboard`. That call already sends a one-frame animation at 500 ms through the serialized adapter. The device application runs the observed Pixoo64 smoke profile: at most two frames, uniform 500 ms timing ([hardware validation](../../../docs/hardware-validation.md)). ADR 0015 qualified single complete pictures at a 1000 ms minimum interval, not sustained 1 Hz traffic. Known defect [#52](https://github.com/jimmie-potts/divoom-app-upgrade/issues/52) shows extra flashing when a two-frame GIF is replaced by the next picture. The hub reads `layout.revision` from the rendition and nothing else.

## Goals / Non-Goals

**Goals:** a screen that can be read from across the room without a legend, motion that draws attention only when a person is needed, and exact previews of every frame.

**Non-Goals:** a different page interval, alert interruptions or moments (#92), a new identifier rule (#87), variable frame timing, animation beyond two frames, and changes to the now-playing card.

## Decisions

- **Layout B, chosen by the owner from three sketches.** The candidates were A (header icons above the label and a full-width activity bar), B (a large state tile) and C (a coloured frame around the card). The owner chose B and asked that it pulse only when attention is needed. Pixel positions:

  | Area | Pixels |
  | --- | --- |
  | State tile | x=1–20, y=1–20, filled in the activity colour, with a 7×7 black icon at (7,7) |
  | Provider and activity | 7×7 provider mark at (24,2); activity word in 3×5 at (33,3) |
  | Attention or notice | Amber chip x=24–62, y=12–20, with a black word at (26,14); otherwise `TURN END` in amber at (24,14) |
  | Label | Two 5×7 lines of up to ten characters, at (2,26) and (2,35) |
  | Detail | `+n SUB` subagents at (2,45); `UNSURE` right-aligned to x=62 |
  | Summary | Divider at y=53; count and `!n` from x=1, page dots or `p/n` in x=26–49, and 5×5 source and collector marks at x=52 and x=58, all from y=56 |

- **One session per page.** The pager keeps its sort, filter, membership and ten-second contracts, with a page size of one. The summary count is still the number of matching sessions, which now equals the page count.
- **Identifier width 20, wrapped for display.** The #87 rule runs once with width 20. Labels then keep their first ten and last nine characters around `…`, and IDs keep `…` and their last nineteen. The renderer splits the identifier into lines of ten. It breaks after the last space, `-`, `_`, `/` or `.` in the first ten characters when the rest fits on the second line; otherwise it breaks at ten. A separate, shorter width for IDs was rejected because the issue asks for one width.
- **An original 5×7 font for labels.** The new alphabet matches the 3×5 alphabet and adds its own `…` marker, three baseline dots. Both are outside the label alphabet. The 3×5 font stays for small words and for the now-playing card, whose output is unchanged.
- **Attention-only pulse, as two frames in one upload.** The owner chose this over successive stills. A single upload of two 500 ms frames is within the observed profile. The device loops the frames, so there is no extra traffic and the 1000 ms minimum interval still applies. Successive stills would upload about once per second for as long as a session waits, which is sustained traffic that was never qualified. Frame 2 dims the tile and chip to 35 %. Everything else, including the steady `!n` total, stays identical.
- **Additive rendition fields.** `rgb` remains the first frame for single-picture readers. `frames` lists every frame, and `frameDelayMs` is 500. The version stays 1 because no field changes meaning. A version bump was rejected: the only external reader, the hub, uses `layout.revision`.
- **Qualification fixtures follow the layout.** `packages/device` cannot import the server renderer, so its fixtures redraw a simplified card with their own glyphs, as before. An event can carry an optional `pulse` frame, which is uploaded with `rgb` at 500 ms, and the report hashes both frames.

## Risks / Trade-offs

- [Known defect #52 may flash when a pulsing picture is replaced] → The pulse appears only on attention pages, which are the pages worth noticing. Physical observation needs the owner's go-ahead. If it flashes, the fallback is a one-frame attention picture, a change confined to the renderer.
- [The 5×7 glyphs and colours are unverified at viewing distance] → The owner judged the sketches in the browser. Physical readability is reported separately and needs the owner's go-ahead.
- [One session per screen takes n×10 s to show n sessions] → Attention-first ordering puts waiting sessions on the first pages, the `!n` total is on every page, and the Monitor tab lists every session.
- [A second frame doubles rendition JSON while it pulses] → That is about 40 KB more on attention pages only, fetched on demand.

## Migration Plan

No data migration is needed. The installed service changes only when the owner separately installs a new revision. Rollback is the previous revision.
