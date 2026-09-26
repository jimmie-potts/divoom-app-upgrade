# ADR 0020: One session per monitor picture, pulsing only for attention

Status: Accepted for [issue #98](https://github.com/jimmie-potts/divoom-app-upgrade/issues/98).
The owner chose the layout and the pulse transport on 2026-09-25.

## Decision

The Pixoo monitor shows one top-level session per picture and keeps the pager's
attention-first order, filters and ten-second interval. The owner chose layout B
from three sketches. It has a large state tile, a provider mark with an activity
word, an attention chip, a two-line label in an original 5×7 font, a detail line
and a summary strip. The rejected sketches were a header row with a full-width
activity bar (A) and a coloured frame around the card (C).

The picture moves only when the shown session needs approval, input or an
answer. A session that is merely working does not pulse. The pulse is a second
frame that dims the tile and chip. Both frames go to the device in one upload at
500 ms each, and the device loops them. The owner chose this over alternating
still pictures at the upload cadence, which would upload about once per second
for as long as a session waited.

The identifier width is 20 characters, drawn as two lines of ten. The #87 rule
is unchanged.

## Evidence and limits

The observed Pixoo64 profile allows two frames at a uniform 500 ms, and the
media soak ran two-frame GIFs for an hour. [ADR 0015](0015-dashboard-qualification.md)
qualified single dashboard pictures at a 1000 ms minimum interval. The
two-frame dashboard picture itself has not been observed on the device.
Known defect [#52](https://github.com/jimmie-potts/divoom-app-upgrade/issues/52),
extra flashing when a two-frame GIF is replaced, may appear when an attention
picture changes. The qualification fixtures now include a pulsing case for a
future authorized physical run. If the flashing is unacceptable, the fallback
is a one-frame attention picture, a change confined to the renderer.

## Consequences

The rendition keeps `rgb` as the first frame and adds `frames` and
`frameDelayMs`, so readers of a single picture are unaffected. The hub reads only
`layout.revision`. The writer, generation guards, coalescing and minimum
interval from ADR 0015 and ADR 0018 are unchanged; a picture is still one
upload. Now-playing cards stay single frames in their own 3×5 font. Showing n
sessions takes n × 10 s, so attention stays first and the `!n` total appears on
every picture.
