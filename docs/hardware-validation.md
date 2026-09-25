# Hardware validation

## Dashboard acceptance, September 20, 2026 UTC

[Issue #30](https://github.com/jimmie-potts/divoom-app-upgrade/issues/30) qualifies
complete single-frame RGB updates for the bounded synthetic dashboard below.
[ADR 0015](decisions/0015-dashboard-qualification.md) selects a
configurable 1000 ms minimum submission interval for downstream integration.
This does not qualify sustained one-frame-per-second traffic or other firmware.

The owner supplied the target privately and explicitly authorized replacement of
random GIFs, the two cadence runs, cancellation, and the later recorded restart.
The owner confirmed that no other writers were active and recorded the display
beside a UTC browser clock. The configured model was Pixoo64; firmware was
explicitly unknown, not queried or inferred. Each run used clean source
`6a424e3298adf19a756745208d5f3606e23fc37b`, whose tree equals the source merge
`df9c37d836df78ecd7e26d4fa2c2934b829055e6` from PR #59. One standalone process
held the normal target lock and serialized queue per run. Each initial probe
reported channel 1, brightness 100%, and screen on. These settings were unchanged.
Unknown original artwork could not be restored, as disclosed before replacement.
No firmware, router, firewall, reset, screen toggle or competing writer was used.

| Run | Bounds and transport result | Recorded display result |
| --- | --- | --- |
| A, 22:47 UTC | 3000 ms interval, 15000 ms cap; bounded after 15.002 s; five acknowledged uploads, two obsolete burst pictures coalesced, one final event omitted | Cases 0, 3, 4, 5, 6 appeared in order; removed rows cleared, overflow page replaced labels, page 1 remained at the cap. Final all-row clearing was not tested in A |
| B, 22:58 UTC | 1000 ms interval, 18000 ms cap; complete after 12.788 s; six acknowledged uploads, two pictures coalesced, none remaining | Cases 0, 3, 4, 5, 6, 7 appeared in order; both partial and final row clearing succeeded. The owner confirmed, "Yes, readability looks good." |
| C, 23:06 UTC | Same 1000/18000 ms settings; SIGINT five seconds after process launch, 4.229 s into the post-probe run; two acknowledged uploads and one cancelled upload with possible prior effects; three events remaining | The in-flight rows-cleared picture applied and remained for about 19 seconds of subsequent recording and in the supplied still. No later case appeared. Cancellation did not undo that write |
| D, 23:13 UTC | Explicitly authorized restart after C's receipt and picture were inspected; 1000/18000 ms; complete after 12.766 s; six acknowledged uploads, two pictures coalesced, none remaining | The retained two-row picture was replaced. Cases 0, 3, 4, 5, 6, 7 appeared in order, ending with all four rows removed |

Across these runs, 19 uploads were acknowledged and one reported cancellation
with possible effects. C's wrapper withheld its planned restart after that
uncertain result. D was a later explicit restart, not an automatic retry. C's
process exited approximately 16 ms after SIGINT; that is local process timing,
not a promise that a device write stops within 16 ms. No outage, firmware crash,
network failure or long-running soak was induced.

### Visible timing and observation limits

Receipt monotonic submission times were mapped to UTC using Node's recorded
`performance.timeOrigin`. Synthetic event times use the runner's event offsets.
The recording contains the display and the browser's UTC clock in the same
frame. A was recorded at 30 fps and B at 60 fps; transition windows were
inspected at 30 fps, with one-frame-per-second overviews of complete recordings.
Clock digits blend during camera exposure and display refresh. Allow roughly
0.1 s for reading uncertainty, not a calibrated error bound. The Windows browser
clock and WSL Node clock offset were not independently calibrated. The following
cross-clock latency estimates are approximate and could have systematic offset.

Each cell gives event / submission / HTTP acknowledgment / observed change,
as UTC seconds within the stated minute. A uses first appearance, which can
include a mixed scan frame; B uses the first inspected settled picture. They
are observation estimates, not exact transition timestamps.

| Case | A, 22:47 UTC, five samples | B, six samples, 22:58 UTC except marked 22:59 |
| --- | --- | --- |
| Four rows | 02.337 / 02.337 / 02.605 / 02.744 | 56.574 / 56.574 / 56.911 / 56.894 |
| Latest burst | 03.087 / 05.340 / 05.581 / 05.544 | 57.324 / 57.576 / 57.829 / 57.808 |
| Rows cleared | 06.337 / 08.342 / 08.601 / 08.577 | 22:59: 00.574 / 00.579 / 00.881 / 00.894 |
| Overflow page 2 | 09.337 / 11.344 / 11.586 / 11.577 | 22:59: 03.574 / 03.578 / 03.865 / 03.808 |
| Return page 1 | 12.337 / 14.344 / 14.592 / 14.577 | 22:59: 06.574 / 06.576 / 06.886 / 06.888 |
| Final row clear | Omitted by cap | 22:59: 09.074 / 09.075 / 09.363 / 09.388 |

Using those readings, A's approximate event-to-visible median was 2.24 s,
range 0.41–2.46 s; B's was 0.32 s, range 0.23–0.48 s. Submission-to-visible
medians were about 0.23 s and 0.31 s respectively, with ranges 0.20–0.41 s
and 0.23–0.32 s. Different appearance/settling endpoints and clock uncertainty
prevent a claim that transport itself became faster. The smaller interval
reduced the fixture's queue delay, particularly the burst's 2.46 s versus
0.48 s event-to-visible estimate. Sparse six-picture runs do not establish
sustained 1 Hz, a device throughput ceiling, thermal behavior or general limits.

No loading screen or blank frame appeared in the inspected A/B transition
windows. Interruption duration was therefore below what this inspection could
resolve, not proven zero. Camera sampling, scan/exposure artifacts and reflections
prevent claims about sub-frame interruptions or physical color accuracy.
Four-row labels, icons, counts and page indicators were distinguishable; the
owner confirmed readability. Removed rows left no visible stale row pixels.
Page 2 showed E/F labels and page 1 returned. Final clear intentionally retains
the summary strip, page indicator and case marker 7; it is not a blank panel.
No pre-existing firmware overlay was identified, so clearing such overlays
remains unqualified.

The source browser tests compare the exact 64×64 RGB payload with canvas pixels.
That establishes preview/payload equality separately from physical readability.
The synthetic bitmap alphabet is locally rasterized. Device text/items remain
excluded for unqualified fonts, layout and clearing semantics, as documented in
[the candidate comparison](protocol-spike.md#candidate-evidence-checked-september-20-2026).
The selected interval is configurable and applies to downstream #33 integration;
#32's production renderer and #34's real-client physical acceptance remain
separate work. Original recordings, clock anchors, receipts and device identity
remain private outside Git. D exited and released its writer; the final synthetic
cleared-row picture may remain. No application installation was performed.

## Local playback acceptance, September 8, 2026 UTC

**Accepted with recorded limitations** for the current uniform-500-ms profile in
[#12](https://github.com/jimmie-potts/divoom-app-upgrade/issues/12). The owner
approved deferring effective variable frame timing to
[#55](https://github.com/jimmie-potts/divoom-app-upgrade/issues/55) after the
completed experiments below; variable timing remains unverified.
The owner supplied the target privately, identified Pixoo64, and approved the
synthetic still/GIF, controls, recovery and bounded soak sequence. Firmware remains
unknown. The tested application source is
`15b0820eaf14e6d61da44e299b2407f339bfe6c1`, running on Node 24.20.0 with
`pixoo64-smoke-2026-09-06`. One device-mode backend at a time held the normal local target
lock and used an isolated private synthetic library. Codex commands use the
approved local HTTP proxy; the backend retains the serialized device writer.

| Check | Result and evidence |
| --- | --- |
| Startup and read-only probe | Passed; device available and connected, channel 1, brightness 100%, screen on |
| Initial still | Owner confirmed the white 30 and border on blue matched the expected image |
| Still duration estimate | Backend playing interval was 30.002 seconds after a 220 ms loading interval; this is state-derived timing, not measured visible dwell. Completion leaves the image visible |
| Visible still dwell during soak | Owner first reported about 28 seconds, then measured 30.3 seconds on each of two repeats, from solid blue appearance until the numbered GIF replaced it. Two readings are within the agreed 29-31-second range; the earlier approximate reading is outside it. Human stopwatch uncertainty and variation remain unquantified |
| One GIF play | Owner confirmed one red 1 / green 2 cycle followed by the blue still; requested delays were 500 ms per frame |
| Three GIF plays | Owner saw three complete cycles, then several rapid extra 1 / 2 cycles before the blue still. The expected visible sequence failed; precise burst timing is unmeasured |
| Three-play backend timing | GIF playing interval 3000.159 ms, followed by a 195.791 ms transition to still readiness; no session error or reconnect was reported |
| Five GIF plays | Owner confirmed five normal cycles then blue with the known flashing. Backend GIF interval 5000.601 ms; still loading 199.978 ms. The accepted defect persists; visible timing remains unmeasured |
| Pause, resume and stop | Owner confirmed blue remained during pause, changed to the GIF about 30 seconds after resume, and GIF content remained after Stop. Backend held pause 50.877 seconds and gave the resumed still 30.002 seconds; GIF loading was 366.962 ms. Precise visible dwell remains unmeasured |
| Skip during loading | Isolated repeat submitted Skip 4.112 ms after GIF loading began. The GIF never reached backend playing; owner confirmed blue 30 stayed visible with no delayed GIF start |
| Brightness | In a separate observed repeat, owner confirmed dimming at requested 20% and restoration. Fresh device probe reported brightness 100% and screen on |
| Isolated screen off/on repeat | Owner confirmed blue still after its playlist ended, a dark screen after Off, then random GIFs after On. The player remained paused. Screen controls operated, but uploaded content did not survive this off/on cycle. Owner accepted this as a known limitation for #12 |
| Explicit Resume after screen-on | Owner confirmed blue 30 returned. The same retained session was resumed; backend loading-to-playing interval was 223.047 ms |
| Backend restart | In a separate repeat without screen toggles, owner confirmed blue 30 stayed visible. The same session/item restored paused with connectivity unknown; only local health/status/catalog reads were made after restart |
| Device disconnect/reconnect | Owner unplugged power. Resume entered bounded reconnect handling, then offline/error with paused intent after 15.089 seconds. Stop retired that attempt. On reconnection, owner saw native GIFs; a fresh probe confirmed connectivity while playback remained stopped. Fresh Resume restored blue 30, confirmed by the owner, with 284.255 ms backend loading. Final Stop/close completed |
| Soak | Passed with accepted flashing defect #52: 60 minutes 2.192 seconds and 119 ordered transitions, with no backend error or recovery event. Stop and close succeeded at 23:17:46 UTC. Owner confirmed continued alternation through the end with only the known flashing |
| Variable timing | Not demonstrated. The approved [500,1000], [1000,500] and [500,500] ms protocol stages each completed five acknowledged requests and closed after a 15-second hold and one blue-still upload. A was ambiguous: red 1 seemed longer, with explicit owner uncertainty, opposite the requested timing. In B, both frames seemed equally long. The control looked equal, and the owner confirmed final blue 30. The application profile remains uniform 500 ms; HTTP completion does not qualify normal application variable timing |

Command acceptance, state timing and owner observations are separate evidence.
Private session logs retain the source revision, command intents/results, SSE
states and resource samples. During the soak the owner clarified that blue 30
briefly interleaves with red 1 / green 2 before settling on solid blue. Defect
#52 records this additional description. Stopwatch readings are approximate;
the burst and precise frame timing have not been instrumentally measured.
The completed controls and recovery checks satisfy their issue criterion with
the accepted screen-retention limitation. The scoped physical observations are
complete. The timing deferral preserves the approximate out-of-tolerance still
reading, failed three-play sequence and accepted flashing defect; it changes
only the variable-timing requirement. Source review, CI and guide delivery are
tracked separately in the issue and PR.

After the extra flashing was reported, the coordinator stopped playback and
closed the physical backend. Brightness and screen settings had not been
changed; that run left the synthetic still displayed. A local application fixture using
the same media and three-play policy sent exactly five protocol requests: an ID
query, two GIF frames, another ID query, then one still frame. Every frame used
500 ms and its expected rendered RGB hash. This excludes extra uploads and
changed delays in that software reproduction, but does not explain the physical
burst. No firmware cause is established.

The owner authorized one traced repeat and reported the rapid burst again.
The instrumented application adapter sent exactly five requests: the two GIF
frames used returned animation ID 6, and the still used ID 7. All three frames
used 500 ms and the expected RGB hashes. Every response reported error_code 0,
with no retry or rejected request. The next ID query began 3004.108 ms after the
final GIF response, and the query/still-upload interval was 205.987 ms. Trace
overhead and HTTP completion are included; these are not visible-burst timings.
The backend stopped and closed after the still. Extra application uploads,
changed requested speed and reused IDs do not explain this recorded run.

The owner accepted the rapid flashing as a known defect and authorized continuing
the remaining tests. Backlog defect
[#52](https://github.com/jimmie-potts/divoom-app-upgrade/issues/52) owns its
investigation and correction. The failed visible sequence remains recorded; this
disposition makes the artifact nonblocking for #12 and does not establish a fix
or waive any other acceptance criterion. A recurrence of the same known burst
will be logged during later stages. New uncertain writes, conflicting control or
other unexpected output still require a stop and assessment.

After the later screen-control and backend-restart sequence, the owner reported
random GIFs and said they had not seen the test execute. The backend was closed
immediately without another device command. The last settings probe had reported
brightness 100%, screen on and channel 1; the player stayed paused across screen-on
and restart. Those acknowledgments do not establish visible output or its cause.
The onset of the non-test content is unknown. This separate mismatch is not
covered by the accepted flashing defect, so physical stages paused at that point.

The owner then authorized a step-by-step still-retention and screen off/on check.
The normal application uploaded the blue still once and completed its still-only
playlist after a 30001.476 ms backend playing-to-idle interval. After completion,
the owner confirmed blue 30 was still showing. The owner then confirmed a dark
screen after Off and reported "Random GIFs return." after On. The player stayed
paused; no replacement artwork, Skip or backend restart occurred during this
sequence. The backend closed after the final observation. Brightness was not
changed in this repeat.

Screen off/on is a sufficient trigger for the reported content change in this
observed sequence. This does not establish the device's internal cause or precise
return timing. Screen-on currently sends only the screen command and leaves
playback paused, as specified; it does not restore artwork. The missed initial
Skip/brightness sequence was followed by separate observed checks recorded above.
The owner accepted this separate
screen-retention limitation for #12 and authorized an explicit Resume to reload
the retained content. The owner confirmed that Resume restored blue 30.
Automatic artwork restoration was not added.

### Soak measurements

The normal application ran from 22:17:44 to 23:17:46 UTC. The runner admitted the
approved playlist revision, alternated a still and a two-frame GIF for 30 seconds
each, and required both one hour and 100 ordered transitions. It completed with
120 playing visits and 119 transitions before the 75-minute cap. The final GIF
may continue looping after Stop; shutdown sends no restoration upload.

Loading intervals below run from backend loading to playing SSE observations.
They include the upload path and local observation overhead, including the
initial upload. They do not measure first-visible time or the flashing burst.
Percentiles use the nearest-rank method.

| Loading interval | Samples | Median | 95th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| All uploads | 120 | 246.307 ms | 379.620 ms | 1105.055 ms |
| Still | 60 | 173.784 ms | 215.371 ms | 246.307 ms |
| Two-frame GIF | 60 | 332.166 ms | 407.978 ms | 1105.055 ms |

The 119 completed backend dwell intervals ranged from 29999.815 to 30001.208 ms.
These estimates do not replace the owner's visible readings above. No error or
reconnecting state appeared. The owner confirmed continued alternation at the
midpoint and through the end, with only the known transition artifact. No freeze
or new unexpected content was reported. This satisfies the soak criterion with
the already accepted flashing defect; it does not qualify variable frame timing.

Resource samples cover the application and its recorder in one process. RSS was
88.703 MiB at startup, 88.113 MiB at the last periodic sample, and 88.363 MiB after
close. The largest periodic sample was 104.168 MiB; the process-reported peak was
113.656 MiB. Median RSS increased from 81.363 MiB during minutes 5-10 to
88.113 MiB in the final five minutes, a 6.750 MiB increase. Average sampled CPU
usage was about 0.106% of one core. These are observations from one bounded run,
not proof that the server has no memory leak. Separate source/browser checks ran
on the same host during the soak. Private logs retain the samples and shutdown
receipt; independent log analysis matched the runner's counts and thresholds.

### Variable-timing experiment

Stages A, B and control each completed exactly five requests with error_code 0 and closed
the adapter. The traces preserved the synthetic RGB hashes and frame order under
one animation ID per GIF, requesting 500/1000 ms in A, 1000/500 ms in B and
500/500 ms in control. Each
sent one blue-still upload after the 15-second hold. No retry, reset, screen or
brightness command was sent.

For A, the owner said red 1 seemed longer but they could be mistaken. This is an
ambiguous result, not a timing pass or a confirmed inversion. The owner confirmed
blue 30 afterward. In B, the owner reported that neither frame lasted longer;
they seemed equal. That observation does not demonstrate the requested timing
difference. B's blue-still upload was acknowledged but not separately confirmed
visually. The owner confirmed equal-looking control durations and final blue 30.
All three helpers closed. Their combined observations do not establish effective
variable timing or its cause. The application continues to reject media outside
its uniform 500 ms profile; no retiming, expanded profile or workaround was added.
The owner approved moving this qualification to
[#55](https://github.com/jimmie-potts/divoom-app-upgrade/issues/55), preserving
the observations and the existing application profile. No additional physical
run is part of #12 closeout. All helpers are closed; final blue 30 was confirmed.

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
settings were preserved. Earlier child sessions reported `auto_review` as the
approval reviewer; their logs did not expose the selected approval policy.

A later simulator-only policy check explicitly selected the existing
`device-development` permissions profile for that invocation. The installed
CLI startup header reported `approval: on-request`. Status, brightness 20 and
final status completed successfully; revocation and host cleanup also passed.
That policy readback belongs to this later simulator session, not the earlier
physical sessions. No approval-policy or reviewer override was supplied, and
saved configuration was unchanged. A human approval dialog was not observed.
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

## Issue #34 monitoring acceptance

September 22, 2026. The owner selected a small Codex Desktop → Ubuntu WSL →
Pixoo64 setup and authorized the short content-replacement sequence. The exact
address, credentials, task identities and private runtime files remain outside
Git. The selected final mode is Monitor; no previous artwork restoration is
claimed. Model is Pixoo64; firmware and exact Desktop app version were not
available from the restricted task environment. The installed Node runtime is
24.20.0. Those unknowns are recorded rather than inferred from the CLI version.

| Evidence | Result |
| --- | --- |
| Pixoo source | PR #65 merged as `37031be56007b6b890ec7a2098aa6e283d9d01fa`; both independent reviews and all five PR plus all five merged-main checks passed. |
| Shared fix | Hub PR #144, `013b829a851277cd0cfbaeaba6d6d0dfc32727c7`; merged-main workflows passed. Hub 0.2.0 archive SHA-256 `47c6a23564652fe2d8ec72d48f45fb639decb2846664898935dc0f3cfe5b94a2`; bundled state 2.0.0. All six packaged hook tests passed before update. |
| Installation | Owner ran the one-off installation and shared-host update in an ordinary Ubuntu terminal because task writes/service-manager access were restricted. Installed manifests/source receipt and authenticated current feed were read back. Same owner, credentials and consumer configuration retained; no database reset or duplicate hooks. |
| Real Desktop lifecycle | An observation-only watcher recorded active, matching-turn idle with a retained completion notice, then active for the next ordinary user turn with that notice cleared for Pixoo. All five watcher predicates passed. Existing ambiguous state recovered and all 15 older notices were cleared according to policy while retained in shared state. Provider ordering remains unknown. |
| Visible dashboard | Owner confirmed: "Yes, dashboard is visible and readable" and later "Yes, I see the T." The amber T is a turn-ended notice, not successful task completion. HTTP sent receipts are separate from these observations. |
| Dismissal | One actual completed notice from this delivery task was explicitly acknowledged for Pixoo; shared state returned applied, and other consumers' acknowledgment sets were unchanged. |
| Monitor/Media | Active synthetic-still playlist playback was paused by Monitor. The current item stayed unchanged beyond its four-second dwell. Returning to Media retained paused playback; explicit Resume resumed playing. Monitor was restored, with the player paused. Earlier shared notice activity while Media was selected did not activate Monitor. |

The first media helper failed before any request because its local image-library
import path was wrong. After correcting the path, the first immediate Resume
sample was taken before asynchronous playback reached playing; its item-position
check also used an absent field and is not accepted as evidence. A corrected
bounded poll observed playing, and the repeated pause check compared actual
nonempty item IDs. No failures were relabeled as passes.

The original installed state 1.0.0 test failed: successive turns remained unknown
and notices accumulated. The isolated provider/reducer reproduction and live
failure are retained in the [issue diagnosis](https://github.com/jimmie-potts/divoom-app-upgrade/issues/34#issuecomment-5769993937).
The owner accepted best-effort current status and Hub #137 supplied the fix.
Unseen delayed starts can still select incorrectly; independent attention
uncertainty is not a task-status failure or an approval grant.

This is bounded real-client, transport and owner-observed display acceptance.
It does not certify precise optical timing, firmware variants, reliable history,
CLI/Claude, shared frontend, Nanoleaf physical behavior, long-duration outages or
migration. Those are outside the owner-approved #34 scope. No router, firewall,
firmware, brightness or screen-power changes were made. Synthetic local test
media remains available; originals and unrelated playlists were preserved.

Restart and monitor-disconnection instructions are in the
[operator note](agent-monitoring.md#start-stop-and-disconnect). Issue closure
still requires the reviewed documentation/guide delivery and its applicable
checks; this receipt does not predict that merge.

## Issue #77 user service installation

September 24-25, 2026. The owner authorized installing the
[user service](local-operations.md#run-as-a-linux-user-service) on the same
Ubuntu WSL host. The target address, backup, receipts and private settings
remain outside Git.

| Evidence | Result |
| --- | --- |
| Pixoo source | PR #84 merged as `690f14d59c1db4025404ecf6c6ff4fce611470c4`; both independent reviews, all five PR checks and all five merged-main checks passed (main attempt 2 after an unrelated Windows test timeout). |
| Installation | Recorded in the install session and its private receipt. A verified offline data backup and copies of the prior launcher, receipt and monitor configuration came first. The build went into a new runtime directory with Node 24.21.0, and the prior `37031be` runtime was kept. `systemd-analyze --user verify` passed on the installed unit before it was enabled in `default.target`. Linger is unchanged (off). |
| Startup restore | With the Pixoo unreachable, the first startup upload timed out and monitoring suspended without retry. With the Pixoo reachable, a service restart restored Monitor without a command: `sent`, `participating: true`, `connected: true`, with later frames also sent. |
| Hub | API evidence: the controller snapshot reported `serviceHealth: ready` with the hub's registered identity, and hub health reported `pixoo` as `ready`. Owner observation: BUNNY listed the Pixoo controller as ready. |
| Stop | `systemctl --user restart` stopped with exit status 0 and reopened the same data directory. |
| WSL restart | Not run: `wsl --shutdown` would stop in-progress agents. The owner accepted proxy evidence: on the two previous WSL boots, the user manager started the enabled Nanoleaf services within 2 seconds, and the Pixoo unit is enabled in the same target. Revisit on the next WSL restart; see the [closing comment](https://github.com/jimmie-potts/divoom-app-upgrade/issues/77#issuecomment-5827118688). |

HTTP receipts are transport evidence. No firmware, router, firewall, brightness
or screen-power changes were made.

