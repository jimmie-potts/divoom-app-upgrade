## ADDED Requirements

### Requirement: Bounded hosted file operation
An explicitly selected hosted profile SHALL encode multi-frame effective RGB losslessly using one global palette, no local palettes or transparency, disposal 1, and every repeated frame. The existing FIFO SHALL own preparation, one Device/PlayTFGif command and bounded transfer wait. It SHALL use no retry or transport fallback after uncertain effects. Prepared bytes SHALL be exposed only under an expiring random capability on a separate file-only listener, with one active file, at most 10 MiB, a 15-second lifetime, ten requests and five file lengths of transfers. Cancellation, replacement and shutdown SHALL revoke access. Control authentication SHALL remain unchanged. Trace: issue #55 AC4–AC6.

#### Scenario: Complete transfer
- **WHEN** the device acknowledges file play and a complete GET response finishes within the operation deadline
- **THEN** the adapter returns estimated readiness at completion plus 1000 ms without claiming visible output
- **AND** the player bases duration and total-plays accounting on that estimate

#### Scenario: Missing fetch or cancelled transfer
- **WHEN** a hosted command has been submitted but transfer cannot complete before cancellation, stale generation or the deadline
- **THEN** the outcome reports possible effects and the player pauses without replay or fallback
- **AND** the URL is revoked while an already downloaded device loop may continue

#### Scenario: File-only listener
- **WHEN** a client requests a catalog route, unknown path, expired file or unsupported method on the file listener
- **THEN** no private media or control route is exposed
- **AND** only the exact current capability can serve prepared bytes through bounded GET or HEAD requests
