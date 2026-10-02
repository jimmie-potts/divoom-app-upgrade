## ADDED Requirements

### Requirement: Complete unavailable evidence display

The Monitor session card SHALL list every unavailable dimension and reason from the selected shared snapshot, including evidence that does not trigger the pixel uncertainty warning under [issue #102](https://github.com/jimmie-potts/divoom-app-upgrade/issues/102#acceptance-criteria). It SHALL display structured dimensions and reasons without raw provider payloads and SHALL NOT mutate or discard evidence. Exact RGB previews and full label/title/project precedence SHALL remain intact.

#### Scenario: Evidence suppressed only in pixel presentation
- **WHEN** a session has missing ordering and unsupported optional read evidence that do not trigger `UNSURE`
- **THEN** its Monitor card shows both entries while the preview equals the rendition's RGB frame

#### Scenario: All unavailable evidence remains visible
- **WHEN** a selected session contains multiple unavailable dimensions and reasons, including conflict or loss
- **THEN** every entry is listed on its card and remains unchanged in the source and projection
