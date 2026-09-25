# ADR 0019: Now-playing cards share the Monitor presentation

Status: Accepted for issue #89, the Pixoo half of
[agent-device-hub#38](https://github.com/jimmie-potts/agent-device-hub/issues/38).
The owner settled the policy on 2026-09-25.

## Decision

The Pixoo reads the hub's shared playback snapshot only when the owner adds a
private `agent-monitor/playback.json`. It draws a 64×64 text card in this
application and writes it only through `MonitorPresentation`, `Player` and the
existing serialized adapter. The hub stays a read-only source, and nothing
else writes to the device.

In Monitor, a new track, or playback starting, replaces the dashboard for 10 s.
Attention (approval, input or question) wins at once, and the pop-up is not
replayed.

In Media, an opt-in setting allows the only automatic change to Media:

- Pop-up pauses an actively playing playlist for a 10 s card, then resumes it.
- Whole song pauses it for as long as a card exists, then resumes it.

The takeover records the player generation its own pause produced. It resumes
only when that generation, paused intent and the screen request are unchanged.
Any other player command, a mode change, screen-off, shutdown, or a failed or
uncertain card upload drops the takeover without resuming. A takeover never
starts while the playlist is paused or stopped, or while the screen is off,
because it would have nothing to restore.

The setting lives in `agent-monitor/now-playing.json` and a browser route. The
`pixoo-integration/1.0` snapshot and commands are unchanged, because the hub
validates them strictly.

## Consequences

ADR 0018's rule, that unsolicited events never take over Media, still holds for
agent events. The now-playing Media setting is an explicit owner opt-in with its
own restore guard. Resuming restarts the current playlist item. The stale rules
match the hub's Tidbyt tile. Physical acceptance stays separate from these
source checks.
