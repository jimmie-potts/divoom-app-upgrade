## Purpose

Expose the Pixoo-owned media catalog, selected-media identity and exact prepared frame previews through authenticated read-only integration routes.

## ADDED Requirements

### Requirement: Negotiated catalog reads
The native integration SHALL negotiate 1.1 explicitly while retaining unchanged 1.0 snapshots, commands and streams (issue #96 AC1).

#### Scenario: Existing client
- **WHEN** a client omits snapshot version negotiation
- **THEN** it receives the 1.0 shape without catalog additions

#### Scenario: Catalog discovery
- **WHEN** a read-authorized client requests a catalog page
- **THEN** it receives at most 100 entries, a default limit of 25, total count, offset, existing names and a catalog revision
- **AND** no command identity or device operation is allocated

### Requirement: Catalog consistency and selected media
The service SHALL persist a catalog revision and advance it transactionally with membership, naming, playlist and item changes. Each JSON catalog response SHALL bind one revision to its payload. Current-media identity SHALL describe captured player selection rather than observed physical output (issue #96 AC2/AC3).

#### Scenario: Concurrent editing
- **WHEN** a playlist changes between catalog requests
- **THEN** the differing revisions allow the consumer to refresh without pairing different rendition identities

### Requirement: Exact bounded preview reads
The service SHALL serve every admitted rendition's effective frames and timing metadata without palette conversion, source decoding or device writes. It SHALL preserve still null timing, repeated frames and timing warnings, require read scope, and bound queued work and read duration (issue #96 AC4/AC5/AC6).

#### Scenario: Immutable preview
- **WHEN** an authorized client reads a cataloged frame
- **THEN** its PNG bytes match the cached effective frame and its strong ETag identifies those bytes
- **AND** matching conditional reads return 304 only after authorization and membership checks

#### Scenario: Deleted rendition
- **WHEN** a client requests a no-longer-cataloged preview with a previously valid validator
- **THEN** the response is 404 rather than 304

#### Scenario: Admission failure
- **WHEN** read admission is full or the request deadline expires
- **THEN** the service returns a typed failure without a partial preview or device operation
