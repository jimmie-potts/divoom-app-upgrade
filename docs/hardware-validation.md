# Hardware validation

## Protocol smoke, September 6, 2026

Hardware status on September 6, 2026: **Bounded smoke test passed** in
[issue #4](https://github.com/jimmie-potts/divoom-app-upgrade/issues/4#issuecomment-5562714620).
The user identified Pixoo64; firmware could not be found. Explicit authorization
covered each stage. The user reported a couple of loading screens early in testing
and otherwise good output, then confirmed the slower controls test looked good.
This does not establish seamless switching or precise visible timing.

The simulator and experimental HTTP tools now exist. Source checks cover fake
servers, serialized frames, typed response failures, cancellation and CLI gates.
Chromium decodes both synthetic GIF frames and verifies the paired RGB data and
500ms delays. Those results are software evidence only.

| Check | Physical result | Evidence |
| --- | --- | --- |
| Model and firmware | Pixoo64, firmware unknown | User-reported name; no firmware query invented |
| Read-only channel/settings probe | Passed | Channel 1, screen on, brightness 100% |
| Static pattern | Passed | User confirmed expected output; HTTP service 265.6 ms |
| Two-frame known GIF | Passed | User confirmed animation; requested 500 ms per frame, HTTP service 370.1 ms |
| Ten mixed transitions | Passed with loading interruptions noted | All ten completed; user assessment above |
| ID query, ordering and reset behavior | Narrow observation only | Upload IDs 1-12, query 13 before reset and 0 after; no rollover test |
| Brightness and screen controls | Passed | Slow repeat at 20%, off/on, restored 100%; readbacks and user confirmation |
| Timing tolerance and capability profile | Limited to smoke content | One/two frames at requested 500 ms; no precise visible measurement |

Use [protocol-spike.md](protocol-spike.md) for exact commands and the provisional
profile. The current two-frame cap and zero extra ready-delay estimate are
experiment settings, not measured device capabilities.

For each authorized run, retain the JSON receipt outside source and record:

- Date, source revision and host/network path, with private addresses redacted.
- Model/firmware source and the explicit approved stage.
- Command/response outcome, returned animation IDs and upload service time.
- User-observed first-visible time, artifacts, cadence and acceptance of loading interruptions.
- Pass, hardware unavailable, or incompatible/unacceptable, with the next action.

Do not commit private identifiers or media. Receipts omit IPs/raw responses and
hash synthetic frame bytes, but review any evidence before sharing. HTTP success
cannot establish visible output. Missing observations in future tests must remain open; simulator-backed work may continue. Incompatible/unacceptable behavior
requires a user decision before further hardware integration.

M6 soak tests, recovery observations and phone access remain separate. No soak,
router/firewall change, firmware change or application installation is included
in this spike. Preserve the actual tested profile and never probe crash limits.

## Local Codex acceptance, September 8, 2026 UTC

**Passed with a loading-screen limitation** for the bounded local command path
in [#26](https://github.com/jimmie-potts/divoom-app-upgrade/issues/26).
The device owner observed the display and accepted the limitation below. This
extends the protocol smoke evidence; it does not complete the broader timing,
recovery or soak acceptance in #12.

The tested application revision was
`9d87928a5e3a1311a7621df21441f76acf473c20`, including basic controls from
[#24](https://github.com/jimmie-potts/divoom-app-upgrade/issues/24), media/playback
tools from [#25](https://github.com/jimmie-potts/divoom-app-upgrade/issues/25), and
the application device path from
[#42](https://github.com/jimmie-potts/divoom-app-upgrade/issues/42).
Shared MCP was `device-mcp` 1.0.0 at
`06c9c504a107cc04093c34500dadbbc6082679d2`.

The owner selected WSL as the primary workflow. Installed WSL Codex CLI 0.153.4
used the loopback MCP endpoint of a foreground WSL backend on Node 24.20.0.
That backend owned the private acceptance library and the configured Pixoo64
writer. The owner supplied the target privately and approved setup, synthetic
content replacement and the bounded sequence before device calls. Local process
and ownership checks found only the acceptance writer; the Windows listener was
the WSL relay. The owner was asked to leave other controls idle; remote/cloud
writer activity was not independently established.

Client state, credentials and synthetic media stayed outside Git. MCP entries
were supplied per invocation; saved Codex configuration, model and approval
settings were preserved. Successful child sessions reported `auto_review`.
The client did not expose its complete MCP approval policy, and this
noninteractive run does not establish that a human approval dialog appeared.
Live discovery classified `get_status`, `list_media` and `list_playlists` as
reads, and the other five tools as writes.

| Check | Result and evidence |
| --- | --- |
| Installed client with simulator | All eight tools exercised in 20 calls, including 15 successful writes; inputs/results retained privately |
| Shared browser/API/MCP backend | Matching server/session identities; desktop and mobile library views inspected without a visible UI defect or page error |
| Initial device state | Owning-backend read-only probe returned channel 1, brightness 100%, screen on; firmware remains unknown |
| Brightness and screen | User confirmed dimming at 20% while the original GIF continued, then screen off/on; off/on repeated once at the user's request |
| Synthetic still and animation | User confirmed solid blue and red/green animation; 64x64 fixtures used the two-frame smoke profile with requested 500 ms GIF delays |
| Playlist controls | Revision 2, two items, 10-second duration policies, repeat/shuffle off; pause, next, previous, resume and stop succeeded. Next at the final item retained it; previous selected the first item. User confirmed the visible content and screen changes |
| Screen and playback semantics | Status confirmed screen-off paused advancement and screen-on left it paused until explicit resume; final stop left the backend idle/stopped |
| Client disconnect/reconnect | Two separate starts disconnected only the installed client after its successful receipt. Backend reads at approximately 0.5 and 2.5 seconds showed the same session still playing. Fresh installed clients read each retained session after natural completion. The user requested the repeat and confirmed visible continuation from blue |
| Restoration | User confirmed restored brightness and screen; a fresh owning-backend probe returned 100% and screen on. Playback was stopped; the final test GIF may remain on the device |
| Revocation and ordinary use | Each temporary principal was revoked. Old bearers returned HTTP 401; ordinary health, player and library APIs remained available. All owned test hosts stopped and plaintext bearer files were removed |

Every physical write returned success without a reported uncertain effect or
player error. Context admission, later upload status and human observations were
recorded separately. Screen-off intervals exceeded two seconds. Pause and stop
govern backend advancement; they do not promise to freeze a GIF already running
on the device.

The user reported a brief loading screen about every ten seconds during the
single-GIF test and explicitly accepted it as a limitation. That interval matches
the selected duration policy: temporary media sessions repeat and upload again
at each cycle. Seamless switching and precise visible cadence remain unproven.
Unknown original artwork could not be restored; that limit was approved before
replacement. No private artwork was imported or exported.

Failure/replay protection remains supported by the qualified source checks in
`tests/integration/mcp.test.ts` and `mcp-lifetime.test.ts`, including retained
stale-revision rejection and an uncertain timed-out request that did not submit
a second device call. These are fixture results, not induced hardware failures.
No outage, crash-limit, firmware, router or firewall experiment was performed.

Private dated client transcripts, protocol receipts, screenshots, ownership and
cleanup records accompany the delivery checkpoint. Reproduction and rollback
use [local-mcp.md](local-mcp.md) and [device-application.md](device-application.md):
start an explicitly configured foreground owner, restore known settings, revoke
its test principal, remove the temporary client entry and stop that owned host.
Per-invocation entries disappeared with their clients; existing application data
and unrelated installations were preserved.
