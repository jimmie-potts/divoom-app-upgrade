## Context

The Monitor presentation already owns the Pixoo's non-playlist pictures. In Monitor mode it pauses the player and uploads complete 64×64 frames through `Player.uploadDashboard(rgb, generation)`. Uploads go at most once per cadence (1 s by default), with one upload in flight. Any player generation change or screen-off suspends it. The hub serves `GET /api/playback/v1/snapshot`:

- `availability` is `available` under 5 s, `stale` from 5 to 30 s, `unavailable` otherwise.
- `ageMs` is the age of the last observation.
- `playback` holds `status`, optional `title`, `artist` and `album`, and `controls`.

The hub validates Pixoo's `pixoo-integration/1.0` snapshot and commands strictly, so this change must not alter them.

## Goals / Non-Goals

**Goals:**

- A readable text card.
- The settled Monitor pop-up.
- The Media Off, Pop-up and Whole song setting.
- The shared stale rules.
- One serialized writer.
- An exact browser preview.

**Non-Goals:**

- Artwork.
- Scrolling.
- A playlist rotation slot.
- Playback commands.
- Hub changes.
- Installation and physical verification.

## Decisions

### Reading

`agent-monitor/playback.json` holds `{version:1, endpoint, token, sourceId}`. The endpoint must be exactly `http://127.0.0.1:<port>/api/playback/v1/snapshot`. It is read with the existing bounded, no-follow monitor file reader. Without the file, nothing reads or changes.

The reader polls every 2 s, one request at a time. Each request has a 1.5 s timeout, a 64 KiB bound and no redirects. The reader keeps the last valid snapshot, its receive time, and whether the latest read succeeded. A response for another source ID, or with an invalid shape, counts as a failed read.

### View

The rules match the Tidbyt, from agent-device-hub#280. Effective age is `ageMs` plus the time since receipt.

- A card appears only for `playing` or `paused` under 30 s.
- The card is stale when the snapshot is `stale`, the latest read failed, or the age is 5 s or more.
- `unavailable`, `stopped`, `inactive`, `unknown` or 30 s of silence shows nothing.

A track is the uppercased title and artist.

### Card

The card is 64×64, drawn with the existing 3×5 font at a 4-pixel advance (16 columns) and a 7-pixel row pitch.

- **Header:** row 1 holds a play triangle (green) or pause bars (amber), then `PLAYING` or `PAUSED`. A stale card shows `?` and dims everything to a third.
- **Divider:** a rule at y = 9.
- **Title:** in white from y = 13, on up to 4 rows when there is an artist, otherwise up to 7.
- **Artist:** in cyan, on the rows after a one-row gap. Every line ends by y = 60.
- **Text:** wraps at spaces, splits over-long words and ends cut-off text with `.`. Accents fold to base letters, and unsupported characters draw as `-`. The album is not drawn.

### Monitor pop-up

A **start** is a fresh, non-stale `playing` card whose track differs from the last fresh track, or that follows a non-playing or absent state. Stale reads do not update this memory, so a hub hiccup does not re-trigger.

In Monitor mode, a start with no attention sets a 10 s pop-up deadline. Attention means any session holding approval, input or question attention. If attention is present or arrives, the deadline is cleared: the pop-up is dropped, not replayed. While the pop-up runs, the card is the selected frame, and updates to it (paused, stale) redraw it. Otherwise the dashboard rendition is. Frame identity is a key over the selected source, so switching sources is a change like any rendition change.

### Media takeover

The setting is `off`, `popup` or `whole`, persisted in `agent-monitor/now-playing.json` (default `off`).

A takeover starts only when all of these hold:

- the mode is Media;
- the player intent is `active` (a playlist is playing);
- the screen is requested on;
- no takeover is running;
- and either the setting is `popup` with a start, or the setting is `whole` with any card.

It runs on the presentation queue. It pauses the player, records the player generation after that pause, and holds `{kind, generation, until?}`. Card frames are uploaded against that generation through the same cadence and in-flight gate.

A takeover ends when:

- `popup` reaches its 10 s deadline, or the card disappears;
- `whole` sees the card disappear;
- or the setting changes.

On end, if the player generation still matches, intent is `paused` and the screen is on, the presentation calls `Player.resume()`, which restarts the current item. Any other generation, screen-off, a mode change, close, or a failed or uncertain card upload **drops** the takeover without resuming. Pixoo does not replay a possibly failed write or override a manual action.

Alternative considered: resume after a failed upload. That could fight a device fault, so manual control wins.

### API

`GET /api/integration/v1/view` adds a `nowPlaying` object with:

- `configured` and `source`;
- the setting and the view;
- `showing` (`dashboard`, `card` or `none`);
- the takeover kind;
- the last takeover outcome and the card RGB.

`POST /api/integration/v1/now-playing` takes exactly `{media}`, saves it, then applies it, and publishes the change. The existing Host, Origin and `X-Pixoo-Request` protections apply. The native integration snapshot and commands are unchanged.

## Risks / Trade-offs

- Resuming a playlist restarts its current item; the owner accepted this.
- A GIF's play count restarts with it.
- A title reaches the local UI and the device only. Nothing logs it.

## Migration Plan

None. Without `playback.json` the app behaves as before, and the setting defaults to Off.
