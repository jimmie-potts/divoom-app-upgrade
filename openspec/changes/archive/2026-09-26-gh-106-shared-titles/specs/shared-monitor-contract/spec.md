## MODIFIED Requirements

### Requirement: Session attribution and private metadata boundaries
The consumer contract SHALL preserve separate sessions in one project and aggregate only attributable children. It SHALL allow neutral identifiers, explicit labels, and bounded shared titles and project names while excluding prompt/tool/transcript content, credentials and private paths from monitoring payloads, persistence, diagnostics and errors.

#### Scenario: Concurrent sessions with unknown children
- **WHEN** two sessions share a project label but parent evidence is unknown
- **THEN** the mapping keeps distinct session identities and does not invent an aggregate relationship or child count

#### Scenario: User-chosen label
- **WHEN** a user supplies a supported explicit label
- **THEN** it remains presentation metadata and takes precedence over shared titles and does not merge sessions

#### Scenario: Shared title and project
- **WHEN** lifecycle 1.1 supplies an allowlisted title and project
- **THEN** title value and provider/user provenance survive within 160 Unicode scalars, the project remains within 80 scalars, and neither field changes identity or permits credential or private-path disclosure
