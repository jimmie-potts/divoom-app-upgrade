# Pixoo HTTP protocol spike

The source tools are experimental. The app still starts in simulator mode.
Fake-server success and decoded fixtures do not establish hardware support.
Issue #4 owns physical observations and acceptance.

## Sources and provenance

Checked September 5, 2026. No community SDK was installed or copied. This
adapter was independently implemented against the command descriptions below.

| Source | Revision and license evidence | Use |
| --- | --- | --- |
| [Divoom beginner guide](https://divoom.com/blogs/app-guide/pixoo-64-api-beginner-guide) | Vendor article dated July 23, 2026 | Describes local HTTP control and firmware sensitivity; does not establish behavior on this device |
| [Divoom portal](https://docin.divoom-gz.com/web/#/5/23) | Rechecked; only the ShowDoc shell was accessible here | Command pages remain unverified |
| [cyanheads/pixoo-toolkit client](https://github.com/cyanheads/pixoo-toolkit/blob/29065f1e6dcff0e1cd3ac873759b4fbbb9f5a89d/src/client.ts) | `29065f1e6dcff0e1cd3ac873759b4fbbb9f5a89d`, [Apache-2.0 license](https://github.com/cyanheads/pixoo-toolkit/blob/29065f1e6dcff0e1cd3ac873759b4fbbb9f5a89d/LICENSE) | Cross-check command spelling, RGB/base64 fields, error_code and screen/brightness mapping |
| [r12f/divoom contracts](https://github.com/r12f/divoom/tree/d35fc8706968b55d22d6d74d1e8d6c7facdf7f0b/divoom/src/divoom_contracts/pixoo) | `d35fc8706968b55d22d6d74d1e8d6c7facdf7f0b`, [Apache-2.0 license](https://github.com/r12f/divoom/blob/d35fc8706968b55d22d6d74d1e8d6c7facdf7f0b/LICENSE) | Cross-check ID query, response capitalization, settings and frame sequence |
| [SomethingWithComputers/pixoo license](https://github.com/SomethingWithComputers/pixoo/blob/0f750cfef7a3d720f3f68903730ca79f8e7a1412/LICENSE) | `0f750cfef7a3d720f3f68903730ca79f8e7a1412`, header identifies CC BY-NC-SA 4.0; GitHub classifies it NOASSERTION | No code adoption; the handoff's license concern remains relevant |

The pinned community implementations use JSON POST to `/post`, numeric
`error_code`, complete row-major RGB bytes encoded as base64, and sequential
frame offsets. They disagree on frame ID capitalization: the toolkit sends
`PicID`, while the Rust contracts serialize `PicId`. This spike follows the
toolkit's frame spelling and reads `PicId` from the ID-query response. Device
acceptance of these fields remains unverified.

The toolkit resets animation IDs before a push. The Rust contracts provide an
ID query and a separate reset command. This spike queries the ID and performs no
automatic reset. Reset behavior remains a separately authorized observation,
not a recovery assumption. Community frame counts, push counts and load delays
are not universal limits or measurements for this device.

## Narrow command set

| Operation | JSON command and fields | Validation |
| --- | --- | --- |
| Probe | `Channel/GetIndex`, then `Channel/GetAllConf` | Numeric SelectIndex; optional numeric Brightness and LightSwitch |
| Animation ID | `Draw/GetHttpGifId` | Numeric PicId before any frame mutation |
| Frame | `Draw/SendHttpGif`: PicNum, PicWidth=64, PicOffset, PicID, PicSpeed, PicData | Same ID, offsets starting at zero, full 12288-byte RGB frames |
| Brightness | `Channel/SetBrightness`: Brightness | Application integer percentage 0-100 |
| Screen | `Channel/OnOffScreen`: OnOff | 0 or 1 |
| Explicit ID experiment | `Draw/ResetHttpGifId` | One command only; never firmware/factory reset |

These mappings come from the pinned sources above. HTTP 2xx and numeric zero
error_code are both required. The parser rejects malformed JSON, wrong fields,
nonzero device errors and responses over 16 KiB. Requests address the
configured private IPv4, port 80 and `/post`. Hostnames, public destinations,
URLs and redirects are rejected. No discovery, cloud call, arbitrary raw command,
proxy destination, automatic retry or automatic reset is exposed by the CLI.

The transport honors Node's operator-configured proxy support when enabled with
`NODE_USE_ENV_PROXY=1` or `--use-env-proxy`. `HTTP_PROXY` and `NO_PROXY` determine
the route; the configured device address, port and path remain fixed. The
`Connection: close` header prevents device-request connection reuse. Cancellation
waits for local request closure, but cannot recall a request already forwarded by
a proxy or applied by the display. Use only the host's approved proxy settings.

## Build and review commands

Use Node 24.5 or later in the 24.x line from the worktree root:

```bash
npm ci
npm run build
npm run device:smoke -- --help
```

Set `PIXOO_DEVICE_IP` in your shell to the actual private IPv4. No default or
example real device address is supplied. Keep device identifiers and captured
runtime files outside Git. Before the agent runs any hardware command, provide
the IP and explicit authorization. Source delivery does not supply that consent.

```bash
npm run device:probe
npm run device:smoke -- static --allow-display-change
npm run device:smoke -- gif --allow-display-change
```

Probe reads the channel and selected settings. It does not upload, reset, select
a channel, change brightness or turn the screen on/off. Model and firmware must
be recorded from the user's device/app information until a query is verified.

Static uploads a dim synthetic bordered square. GIF uploads two complete frames
with a square moving from left to right, 500ms per frame. Chromium independently
decodes the paired generated GIF and verifies both frames and delays in tests.
This is not an arbitrary GIF importer; decoder selection remains issue #5.
The display may retain/loop the last content after the process exits.

Observe static and GIF output individually before acknowledging the next stage:

```bash
npm run device:smoke -- transitions --allow-display-change --confirm-prior-stages
```

This performs exactly ten alternating static/GIF uploads, with three-second
pauses between completed uploads. It stops on the first failure. A successful
HTTP response still requires the user's visual assessment. Ctrl+C cancels local
pending requests; already-applied display content cannot be undone.

The following are separate experiments, not part of the default smoke sequence:

```bash
npm run device:smoke -- controls --allow-display-change
npm run device:smoke -- reset --allow-display-change
```

Controls reads the existing brightness and screen state and refuses unknown
state. It dims to at most 20%, turns the screen off then on, and restores the
original screen/brightness on success, with one-second pauses. A failed command
ends the stage and may leave a changed state. Reset sends one animation-ID reset;
it does not restore previous artwork or change firmware/device settings.

## Profile and receipts

`SPIKE_PROFILE` is explicitly unverified: two frames maximum, uniform delays
100-1000ms, 64x64 RGB and zero additional ready-delay estimate. These conservative
experiment bounds are application safeguards. Longer/variable-delay animations
are rejected without truncation or resampling. Only dated physical observations
can justify an observed profile. Do not infer a tested frame limit from this cap.

The adapter returns generation and submission/start/completion timing, separating
queue wait from service time. Timeouts include queueing. In-flight cancellation
holds the writer until local request closure; a sent mutation reports possible
prior effects even if the device never replies. Physical cancellation is unknown.

CLI JSON receipts include ordered request fields and whitelisted numeric response
fields, replacing frame bytes with length and SHA-256. They omit the IP and raw
response text. Upload-ready times are estimates. A completed receipt is labeled
`http-complete-observation-pending`, never hardware pass. Save receipts outside
source, review before sharing, and record source revision and user observations
in [hardware-validation.md](hardware-validation.md).

## Dashboard qualification (#30)

`npm run device:dashboard -- --help` describes a separate synthetic experiment.
Build first with Node 24 `npm ci` and `npm run build`. Default execution uses
the fake adapter even when `PIXOO_DEVICE_IP` or application device mode is set.

```bash
npm run device:dashboard -- --preview /absolute/private/new-dashboard-preview.html
npm run device:dashboard -- --cadence-ms 1000 --duration-ms 15000
```

The preview destination must be new, absolute and outside Git. Open it in a
browser. Each canvas contains the exact 64×64 upload RGB bytes, enlarged with
nearest-neighbor presentation. Browser pixel tests establish payload fidelity,
not physical color, timing or readability. The original synthetic 3×5 bitmap
alphabet is not a reproduction of firmware fonts or the future production renderer.

### Candidate evidence, checked September 20, 2026

The [vendor guide](https://divoom.com/blogs/app-guide/pixoo-64-api-beginner-guide)
describes community local-HTTP control and firmware sensitivity. The
[vendor portal](https://docin.divoom-gz.com/web/#/5/23) again exposed only its shell;
command-page contents remain unavailable. Community source descriptions below
are not qualified limits of the owner's device.

| Candidate | Source evidence | Limits and disposition |
| --- | --- | --- |
| Complete frame | Existing pinned [toolkit implementation](https://github.com/cyanheads/pixoo-toolkit/blob/29065f1e6dcff0e1cd3ac873759b4fbbb9f5a89d/src/client.ts) supplies the existing `Draw/SendHttpGif` fields | One 64×64 RGB picture is 12,288 raw bytes, 16,384 base64 characters plus JSON fields. This experiment uses one frame, offset 0, queried ID and 500 ms placeholder. Device maximum payload/frame rate is unknown. Selected for the bounded dashboard profile in ADR 0015; see the dated physical observations. |
| Text overlay | The [same client](https://github.com/cyanheads/pixoo-toolkit/blob/29065f1e6dcff0e1cd3ac873759b4fbbb9f5a89d/src/client.ts) emits `Draw/SendHttpText` with `TextId`, `x`, `y`, `dir`, `font`, `TextWidth`, `speed`, `TextString`, `color` and optional `align` | Font assets, metrics, clipping, scrolling, encoding and string-length bounds are unqualified. Client-side ID clamps are not firmware limits. Unavailable because exact browser reproduction is not established. |
| Item list | [pixoo-rest payload](https://github.com/4ch1m/pixoo-rest/blob/ef6819605ca2da24bcf51bd46b486fa4d25c4258/pixoo_rest/resources/passthrough_payloads/draw_send_http_item_list.json) and [changelog](https://github.com/4ch1m/pixoo-rest/blob/ef6819605ca2da24bcf51bd46b486fa4d25c4258/CHANGELOG.md) describe `Draw/SendHttpItemList` | Numeric item types, supported firmware, count/payload limits and layout semantics are not established. Unavailable; no guessed item commands are exposed. |
| Text clear | [pixoo-rest clear payload](https://github.com/4ch1m/pixoo-rest/blob/ef6819605ca2da24bcf51bd46b486fa4d25c4258/pixoo_rest/resources/passthrough_payloads/draw_clear_http_text.json) has no fields; the toolkit sends `TextId` | Per-ID versus global clearing is unresolved. No clear or reset command is sent by this experiment. |

Full-frame replacement clears the pixels of removed synthetic rows. It does not
prove that an existing firmware overlay is cleared. Unknown overlays or unexpected
output require stopping and reassessment. No SD-card storage, firmware changes,
font probing or crash-limit testing is part of the tool. The source-only
text/item exclusion is not an observation that these commands fail on hardware.

### Bounds and sequence

The qualification CLI retains its historical 3000 ms default, configurable from
1000 to 10000 ms. ADR 0015 selects 1000 ms for downstream dashboard integration;
pass it explicitly to reproduce the accepted experiment.
The default duration is 15000 ms, configurable from 1000 to 60000 ms. At most
20 uploads occur, with zero retries. Each upload queries the ID then sends its
frames: one, or two for a pulsing picture at a uniform 500 ms. Physical traffic
is therefore at most 62 HTTP requests including the two-request initial probe. The probe has a separate 5000 ms timeout; the
run deadline starts after that probe. Each upload is bounded by the smaller of
5000 ms and remaining run time. Transport shutdown may take additional time
to settle local request closure; a deadline cannot recall an applied write.

Events occur at 0, 250, 500, 750, 4000, 7000, 10000 and 12500 ms. They exercise
the one-session layout from issue #98: a state tile, provider symbols, doubled
labels, subagent and attention counts, a two-frame attention pulse, rapid state
changes, a removed session, page 2 and a final clear. They are synthetic
fixtures, not real agent metadata. The runner selects the latest due picture
when cadence permits. It awaits each upload; obsolete pictures are counted and
never replayed. Slow runs or short durations can omit cases, which the receipt
reveals. Use the preview and case IDs to assess what was actually submitted.

### Before physical execution

Record privately the test owner, exact authorized target, clean built source
revision, Pixoo64 model, firmware version or explicit unknown, cadence, duration,
sequence, current visible content, and permission to replace it. Stop the normal
backend and other native/WSL, phone, cloud and network writers. Both protocol
CLIs now acquire the same native-user target lock as the backend before any
request and hold it through adapter closure. This cannot exclude another host,
native user or Windows/WSL environment; the operator confirms that exclusion.
Do not reuse old smoke-test consent.

Only after that separate authorization, use the documented flags with the actual
values. `PIXOO_DEVICE_IP` remains the sole target source:

```bash
npm run device:dashboard -- --device --allow-display-change --confirm-exclusive-writer \
  --owner OWNER --model Pixoo64 --firmware VERSION_OR_unknown \
  --source-revision FULL_COMMIT_SHA --cadence-ms 1000 --duration-ms 18000
```

The tool rejects a mismatched revision or dirty checkout. Its initial probe must
return known brightness and screen state before replacement. It never changes
those settings and cannot restore unknown original artwork. The last sent image
may remain after completion, failure or Ctrl+C. No automatic recovery, text clear,
screen toggle or ID reset runs. On error, stop, retain the receipt and assess
possible prior effects before any separately authorized repeat.

### Measurements and decision

Receipts omit the IP, owner and firmware metadata and record settings, case IDs,
RGB hashes, event/submission times, completion intervals and adapter outcomes.
The completion interval includes failures and is not a visible-latency estimate.
`http-complete-observation-pending` identifies the transport evidence class;
inspect `status` and every operation outcome before calling transport successful.
`bounded` means the deadline or cap omitted remaining events. Fake receipts say
`simulator-only`. Store receipts outside Git and redact before publication.

For each cadence, record a bounded sample with event ID and event time, HTTP
completion, first-visible time with observation method and uncertainty, loading
or blanking duration, one-session readability, pulse flashing, stale-pixel/overlay clearing,
burst ordering and final visible picture. A video synchronized to the event
timeline is preferable for latency; unsynchronized impressions cannot provide
an event-to-visible measurement. Record sample count, median/range and every
failure, not a universal frame-rate limit. Exercise recovery only through a
separately authorized repeat after a failed run; never manufacture a device fault.

The [September 20 observations](hardware-validation.md#dashboard-acceptance-september-20-2026-utc)
record the authorized 3000/1000 ms comparison, cancellation with an applied
in-flight picture, and separately authorized successful restart.
[ADR 0015](decisions/0015-dashboard-qualification.md) selects complete RGB frames
and a configurable 1000 ms minimum interval for downstream integration. The
small sample and uncalibrated cross-clock estimates do not qualify sustained
1 Hz or other firmware. New physical runs still require the authorization and
bounds above; the dated acceptance does not provide standing device permission.
