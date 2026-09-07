## MODIFIED Requirements

### Requirement: Concurrency and command identity
Playlist mutations SHALL require an expected revision. Player and display commands SHALL use a server-issued epoch and monotonically sequenced request identity shared across HTTP and MCP entry points. Concurrent matching replays SHALL share the same retained application outcome; different payloads at one identity SHALL conflict. Old or expired identities SHALL never execute again, including after restart. The last 256 completed outcomes SHALL be retained; pending work SHALL not be evicted as completed history. Trace: issue #8 criteria 2 and 5 and [issue #24](https://github.com/jimmie-potts/divoom-app-upgrade/issues/24), shared-service and replay criteria.

#### Scenario: Stale editor
- **WHEN** two clients edit the same playlist revision
- **THEN** exactly one edit succeeds and the other receives a revision conflict with current revision information

#### Scenario: Command replay and restart
- **WHEN** clients replay a command, use its identity for a different command, or submit an identity from a previous server lifetime
- **THEN** the matching retained replay returns its original result and conflicting or expired requests are rejected without another action

#### Scenario: Cross-transport display replay
- **WHEN** an HTTP caller and an MCP caller submit the same canonical display command and request identity in either arrival order
- **THEN** only one display operation executes and each caller receives its existing transport projection of that same outcome
- **AND** a retained failed outcome does not execute again on replay

### Requirement: Local request security
The server SHALL remain loopback-only and validate the exact listener host/port and any Origin. Unsafe HTTP API requests SHALL require same-origin evidence or an explicit non-simple request header. Only the explicitly enabled authenticated `/mcp` endpoint SHALL allow native mutations without that browser request header or an Origin. Cross-site requests and arbitrary forwarded hosts SHALL not authorize access. An authentication hook SHALL gate API reads, writes and streams before effects when configured. Trace: issue #8 criteria 4 and 5 and issue #24, authentication criterion.

#### Scenario: Untrusted caller
- **WHEN** a caller supplies a foreign host/origin, cross-site fetch metadata or a simple API mutation without origin evidence
- **THEN** the server rejects the request without storage or player effects

#### Scenario: Authentication hook
- **WHEN** the configured authentication hook denies or fails
- **THEN** API data and effects remain unavailable, including event streams, with sanitized errors

#### Scenario: Native exception remains local to MCP
- **WHEN** an authenticated native MCP client omits an Origin and browser request header
- **THEN** it can access the enabled MCP route
- **AND** the same omission remains forbidden for unsafe HTTP API requests
