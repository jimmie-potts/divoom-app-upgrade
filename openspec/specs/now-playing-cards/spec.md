# now-playing-cards Specification

## Purpose
Show what is playing on the Pixoo from the hub's shared playback snapshot, [issue #89](https://github.com/jimmie-potts/divoom-app-upgrade/issues/89) (the Pixoo half of agent-device-hub#38): opt-in bounded reading, a readable 64×64 card with visible staleness, a Monitor pop-up that yields to attention, and an owner-selected Media takeover that resumes only playback it paused, all through the existing serialized writer.

## Requirements

### Requirement: Opt-in bounded playback reading
The backend SHALL read the hub's shared playback snapshot only when a private `agent-monitor/playback.json` names a loopback `/api/playback/v1/snapshot` endpoint, a read token and a source ID. It SHALL poll every 2 s with one request at a time, a 1.5 s timeout, a 64 KiB bound and no redirects, and SHALL validate the envelope strictly, including the source ID. Invalid or failed reads SHALL count as failed reads and never as a paused or stopped track.

#### Scenario: Not configured
- **WHEN** no playback configuration exists
- **THEN** no playback request is made and Monitor and Media behave as before

#### Scenario: Wrong source or failed read
- **WHEN** a read returns another source ID, an invalid envelope, an oversized body, a redirect or a timeout
- **THEN** the reader keeps the last valid snapshot and marks the latest read failed

### Requirement: Now-playing card
The view SHALL show a card only for `playing` or `paused` playback whose effective age is under 30 s, marked stale when the snapshot is `stale`, the latest read failed, or the age is 5 s or more. It SHALL show nothing for `unavailable`, `stopped`, `inactive` or `unknown`. The 64×64 card SHALL show a play or pause marker with its status word, the title and the artist, wrapped at spaces and truncated with `.`, with accents folded and no album. A stale card SHALL be dimmed with a `?` marker.

#### Scenario: Paused and stale
- **WHEN** playback is paused, then the snapshot turns stale
- **THEN** the card shows pause bars and `PAUSED`, then dims with a `?` marker

#### Scenario: Silence
- **WHEN** reads fail until the last observation is 30 s old
- **THEN** no card is shown

### Requirement: Monitor mode pop-up
While Monitor presentation is active, a new track or playback starting SHALL show the card for 10 s and then the dashboard. When any session holds approval, input or question attention at that moment, or attention arrives during the pop-up, the dashboard SHALL show and the pop-up SHALL be dropped without being replayed. Stale reads SHALL NOT start a pop-up.

#### Scenario: Track change
- **WHEN** a new track starts while no session needs attention
- **THEN** the card is uploaded, and the dashboard is uploaded again after 10 s

#### Scenario: Attention cuts the pop-up short
- **WHEN** attention arrives 3 s into a pop-up
- **THEN** the dashboard is uploaded at the next cadence and the card does not return for that track

#### Scenario: Same track after a hub hiccup
- **WHEN** the snapshot turns stale and then available again with the same track
- **THEN** no new pop-up starts

### Requirement: Media now-playing setting
A persisted Media setting SHALL offer Off (default), Pop-up and Whole song. With Pop-up, a start while a playlist is actively playing and the screen is on SHALL pause the playlist, show the card for 10 s and resume it. With Whole song, the card SHALL show while a card exists and the playlist SHALL resume when it no longer does. The takeover SHALL resume only when the player generation it recorded is unchanged, the player is paused and the screen is on. A manual player action, mode change, screen-off, shutdown, or failed or uncertain card upload SHALL drop the takeover without resuming. With Off, or when no playlist is playing, Media SHALL be unchanged.

#### Scenario: Pop-up resumes the playlist
- **WHEN** Pop-up is selected and a new track starts during an active playlist
- **THEN** the playlist pauses, the card is uploaded, and the playlist resumes after 10 s

#### Scenario: Manual action wins
- **WHEN** the user pauses, stops or starts media during a takeover
- **THEN** the takeover ends without an automatic resume

#### Scenario: Whole song
- **WHEN** Whole song is selected and music plays, then stops
- **THEN** the playlist pauses while the card shows and resumes once the card is gone

#### Scenario: Nothing to restore
- **WHEN** the playlist is paused or stopped, or the screen is off, and a new track starts
- **THEN** no card is shown and no player command is sent

### Requirement: Browser setting and preview
The Agent monitor panel SHALL show the now-playing configuration state, the Media setting, what the display is showing and an exact card preview. Changing the setting SHALL persist it through a protected browser route without changing the `pixoo-integration/1.0` snapshot or commands.

#### Scenario: Change the setting
- **WHEN** the user selects Whole song and reloads
- **THEN** the setting persists and the native integration snapshot is unchanged
