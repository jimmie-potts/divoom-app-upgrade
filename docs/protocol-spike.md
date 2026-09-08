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

Use Node 24 from the worktree root:

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
