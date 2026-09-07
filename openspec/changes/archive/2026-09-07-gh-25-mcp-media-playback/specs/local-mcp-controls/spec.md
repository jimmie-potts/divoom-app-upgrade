## MODIFIED Requirements

### Requirement: Protected bounded discovery
MCP SHALL authenticate each HTTP request against current private credential state, enforce read/control authorization, validate the exact listener Host and every supplied Origin, and reject cross-site fetch metadata. It SHALL use the shared module's bounded transport and registration behavior. Credentials, private paths and device addresses SHALL NOT enter discovery, results or logs. Media catalog metadata SHALL NOT enter discovery, status, display outcomes or logs. Only authenticated list_media and list_playlists results SHALL include the bounded approved catalog metadata defined by mcp-media-playback; this exception SHALL NOT permit originals or raw manifests. Media/playback mutation results SHALL contain only their bounded identity and state projection, without catalog names or source metadata beyond the defined session identity. Trace: issue #24, authentication, shared-module and tool-description criteria, and issue #25 bounded catalog selection.

#### Scenario: Invalid caller
- **WHEN** a caller supplies a foreign Host or Origin, invalid credential or unauthorized scope
- **THEN** protected data and effects remain unavailable with a sanitized result

#### Scenario: Revocation during a session
- **WHEN** a credential is revoked after successful initialization
- **THEN** later requests on the existing session are rejected before application access

#### Scenario: Bounded delivery
- **WHEN** transport capacity or message limits are exceeded
- **THEN** excess work fails within the configured bounds without creating another device writer or an unbounded waiting queue

#### Scenario: Catalog-specific metadata exception
- **WHEN** an authenticated caller lists media or playlists and then requests status or discovery
- **THEN** only the catalog response includes its approved bounded catalog metadata
- **AND** status, discovery, display outcomes and logs remain free of catalog names and descriptive media metadata

### Requirement: Fixed display tools
The local endpoint SHALL bind exactly `get_status()`, `set_brightness(percent, request_id)`, `set_screen(on, request_id)`, `list_media(q?, offset?, limit?)`, `list_playlists(q?, offset?, limit?)`, `show_media(rendition_id, request_id, policy?)`, `play_playlist(playlist_id, revision, request_id)` and `control_playback(action, request_id)` for the existing application target. Media and playback schemas SHALL follow mcp-media-playback. Inputs SHALL reject extra fields, brightness outside integer 0-100, nonboolean screen state and malformed request identities before effects. Status and catalog queries SHALL be annotated read-only and all mutations as writes. Arbitrary targets, raw commands, URLs and filesystem inputs SHALL NOT be accepted. Trace: issue #24, tool, validation and description criteria, and issue #25 media/playback tool criteria.

#### Scenario: Discovery and invalid input
- **WHEN** an authorized client discovers tools and submits an invalid brightness or screen input
- **THEN** it sees the fixed tool schemas and receives a validation error without consuming an application request identity or invoking the adapter

#### Scenario: Screen control during playback
- **WHEN** an authorized client turns the screen off and then on
- **THEN** off follows the player's cancellation and pause semantics
- **AND** on does not resume playback

#### Scenario: Media extensions preserve the fixed target
- **WHEN** an authorized caller discovers the media and playback extensions
- **THEN** the endpoint exposes only the eight fixed tools with strict schemas for the existing application target
- **AND** no import, edit, arbitrary target or raw device operation is exposed
