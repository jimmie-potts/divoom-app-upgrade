## MODIFIED Requirements

### Requirement: Explicit display participation
Monitor and Media SHALL be explicit modes. Entering Monitor SHALL pause playlist advancement. Explicit start, show-media, restart or resume SHALL select Media. Leaving Monitor SHALL preserve paused playback until explicit media intent. Collection SHALL continue in either mode and unsolicited agent events SHALL NOT take over Media. The only automatic Media change SHALL be the owner's explicit now-playing Media setting, which resumes only playback it paused itself.

#### Scenario: Attention while Media owns the display
- **WHEN** questions, approvals, errors or turn ends arrive during Media
- **THEN** monitor state and preview update without a monitor picture or ownership change

#### Scenario: Return to paused media
- **WHEN** the user enters Monitor during playback and then selects Media
- **THEN** the captured playlist remains paused until explicit resume or start

#### Scenario: Now-playing setting off
- **WHEN** the now-playing Media setting is Off and a new track starts during Media
- **THEN** no picture or ownership change occurs
