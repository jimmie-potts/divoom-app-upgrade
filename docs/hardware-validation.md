# Hardware validation

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
