## Why

[Issue #89](https://github.com/jimmie-potts/divoom-app-upgrade/issues/89) is the Pixoo half of [agent-device-hub#38](https://github.com/jimmie-potts/agent-device-hub/issues/38): show what is playing, read from the hub's shared playback snapshot, rendered and written by this application. The owner settled the policy on 2026-09-25. In Monitor mode, a new track pops up a card for 10 s unless an agent session needs attention. In Media mode, an opt-in setting offers Off, Pop-up and Whole song. The stale rules match the Tidbyt tile.

## What Changes

- Add an opt-in private playback configuration, `agent-monitor/playback.json`: the hub snapshot endpoint on loopback, a read token and the source ID. Add a reader that polls it every 2 s with strict validation and bounded reads.
- Add a pure now-playing view (card or nothing, with staleness) and a 64×64 card renderer. The card shows a marker and status word, the title and the artist, wrapped and truncated with no scrolling.
- Extend the Monitor presentation:
  - In Monitor mode, a new track, or playback starting, shows the card for 10 s. Attention cancels the pop-up.
  - In Media mode, the Pop-up and Whole song settings pause an actively playing playlist, show the card and resume the playlist afterwards. A manual player action, a mode change or screen-off cancels the automatic resume.
- Persist the Media setting in `agent-monitor/now-playing.json`. Expose it and the now-playing state through `GET /api/integration/v1/view` and `POST /api/integration/v1/now-playing`. The shared `pixoo-integration/1.0` snapshot and commands are unchanged.
- Add a "Now playing" group to the Agent monitor panel, with the Media setting, the current state and an exact card preview.
- Extend the 3×5 pixel font with `'`, `&`, `,`, `(`, `)` and `:`.

## Capabilities

### New Capabilities

- `now-playing-cards`: playback reading, the now-playing view and card, Monitor pop-ups and the Media takeover setting.

### Modified Capabilities

- `agent-monitor-controls`: Media stays free of agent-event takeover. The only automatic change is the owner's explicit now-playing Media setting, and it resumes only playback it paused itself.

## Impact

Changes cover `apps/server` (the presentation, a new reader, card and routes), `apps/web` (the monitor panel), `packages/core` (browser-facing now-playing types), tests and docs. The hub, the native controller API and the `pixoo-integration/1.0` contract are unchanged. No device, hub or installation is touched. Installing the updated app and checking the physical display need the owner's separate go-ahead.
