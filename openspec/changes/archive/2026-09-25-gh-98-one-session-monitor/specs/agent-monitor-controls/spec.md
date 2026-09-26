## MODIFIED Requirements

### Requirement: One generation-guarded display writer
All media, monitor and display controls SHALL use the existing backend adapter and serialized queue. Mode changes, screen-off and shutdown SHALL retire obsolete callbacks and pending pictures. At most one monitor upload and one latest desired rendition SHALL be retained; no old completion SHALL restore ownership. A monitor picture SHALL be one upload of one or two complete RGB frames at the rendition's uniform delay, within the device profile's frame limits. Monitor uploads SHALL use a configurable minimum submission interval of 1000 ms by default, no faster than 1000 ms.

#### Scenario: Switch modes during upload
- **WHEN** a Monitor upload is in flight and explicit media intent supersedes it
- **THEN** no subsequent picture from the old mode is submitted and its completion cannot replace current intent; possible already-applied effects remain identified

#### Scenario: Coalesced burst
- **WHEN** several snapshots arrive within the cadence or while an upload is active
- **THEN** only the newest current rendition remains eligible after the minimum interval, without replaying missed pictures

#### Scenario: Pulsing picture
- **WHEN** the current rendition has two frames
- **THEN** exactly one upload carries both frames in order at the rendition's delay, and no further upload occurs until the rendition changes
