## ADDED Requirements

### Requirement: Running build identity
Build output SHALL identify the full source commit only when its source is clean
at the same known repository revision before and after the build; otherwise its revision
SHALL be `unknown`. The server SHALL load its own build metadata once at startup
and expose `build: {sourceRevision, version}` from health, with package version
informational. Missing or malformed metadata SHALL produce unknown provenance.
Identity reads SHALL perform no device operation or runtime Git lookup and SHALL
exclude private paths and credentials. Trace: issue #114 server criteria.

#### Scenario: Clean and unqualified builds
- **WHEN** a clean known commit is built
- **THEN** the build reports its full commit SHA
- **AND** dirty, missing or changed source provenance reports `unknown`

#### Scenario: Older process after another build
- **WHEN** newer metadata replaces the file after a server starts
- **THEN** that server keeps reporting the identity it loaded at startup
- **AND** a later server reports the metadata from its own startup
