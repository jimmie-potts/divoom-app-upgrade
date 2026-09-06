# Hardware validation

Hardware status on September 5, 2026: **Not run**. The device IP and explicit
hardware authorization have not been provided. Model variant and firmware remain
unknown. No Pixoo request, display change, ID reset or physical timing observation
was performed for the source implementation of issue #4.

The simulator and experimental HTTP tools now exist. Source checks cover fake
servers, serialized frames, typed response failures, cancellation and CLI gates.
Chromium decodes both synthetic GIF frames and verifies the paired RGB data and
500ms delays. Those results are software evidence only.

| Check | Physical result | Evidence needed |
| --- | --- | --- |
| Model and firmware | Blocked | User's device/app information, redacted before committing |
| Read-only channel/settings probe | Blocked | Explicit IP/authorization and a successful device receipt |
| Static pattern | Blocked | Display-change approval and user-observed pixels/loading |
| Two-frame known GIF | Blocked | Approval and observation of both frames/cadence/artifacts |
| Ten mixed transitions | Blocked | Prior static/GIF acceptance, approval and observed interruptions |
| ID query, ordering and reset behavior | Unverified | Actual ID receipts and separately approved reset experiment |
| Brightness and screen controls | Unverified | Approved control stage and observed restoration |
| Timing tolerance and capability profile | Unverified | Measured visible timing and user's acceptance threshold |

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
cannot establish visible output. Missing hardware observations keep issue #4
open; simulator-backed work may continue. Incompatible/unacceptable behavior
requires a user decision before further hardware integration.

M6 soak tests, recovery observations and phone access remain separate. No soak,
router/firewall change, firmware change or application installation is included
in this spike. Preserve the actual tested profile and never probe crash limits.
