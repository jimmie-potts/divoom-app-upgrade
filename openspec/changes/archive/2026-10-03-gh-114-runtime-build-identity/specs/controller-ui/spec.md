## ADDED Requirements

### Requirement: Read-only build information
Settings SHALL show the running backend's short source revision and make its full
revision selectable and copyable. Unknown or unavailable provenance SHALL remain
explicit. Build information SHALL refresh through the existing server-consistent
runtime read without changing device settings or issuing device commands.
Trace: issue #114 Settings criterion.

#### Scenario: Read and copy a known revision
- **WHEN** Settings has a known running source revision
- **THEN** it shows the short revision and exposes the full value for copying
- **AND** copying reports success or an actionable clipboard failure

#### Scenario: Unqualified build
- **WHEN** the backend reports unknown provenance
- **THEN** Settings labels it unknown without implying that the package version identifies a commit
