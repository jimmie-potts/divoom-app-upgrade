# GIF qualification

[Issue #55](https://github.com/jimmie-potts/divoom-app-upgrade/issues/55) owns this
experiment. It does not change the supported production playback profile.
Build with Node 24 and `npm run build` first.

`npm run device:gif -- --preview /absolute/private/new-preview.html` writes
an offline HTML preview of the exact synthetic RGB frames. With no arguments,
the underlying `node scripts/gif-qualification.mjs` emits that HTML to stdout.
The default never contacts a device, even when a target is configured.

The fixed sequence uses numbered frames 01–20 and a moving position marker:

| Stage | Requested frames and delays | Hold after upload |
| --- | --- | --- |
| A | 20 frames, 500 ms each | 30 seconds |
| B | 20 frames, 100 ms each | 10 seconds |
| C | Frames 01/02, 200/800 ms | 10 seconds |
| D | Frames 01/02, 800/200 ms | 10 seconds |
| E | Frames 01/02, 500/500 ms | 10 seconds |

The initial probe has a five-second deadline and requires known brightness and
screen-on state. Each animation has one fifteen-second total upload deadline,
including its ID query and sequential frame sends. The whole run is capped at
180 seconds. At most 53 HTTP requests occur: two probe requests, five ID queries
and 46 frames. There are no retries, resets, screen or brightness commands,
extra final markers or automatic restoration writes. Final stage E can keep
looping after the process exits; cancellation can leave earlier content visible.

Before physical execution, record the explicit target privately, current visible
content, owner, clean source revision, Pixoo64 model and firmware version or
unknown. Review the preview and obtain permission for content replacement.
Stop other writers and hand off the existing backend; the tool acquires the same
local target lock and retains it until transport closes. This lock does not
exclude other hosts/users or the Divoom app. Keep those writers idle.

After approval and exclusive handoff, use:

```bash
npm run device:gif -- --device --allow-display-change --confirm-exclusive-writer \
  --owner OWNER --model Pixoo64 --firmware VERSION_OR_unknown --source-revision FULL_SHA
```

Set `PIXOO_DEVICE_IP` only to the explicitly authorized private address. The tool
requires an exact clean source revision. It sends nothing when admission or lock
acquisition fails. Ctrl+C stops future stages and aborts pending transport; a
write already received by the display cannot be undone. Stop on unexpected
content, uncertain results, conflicting writers or unacceptable loading. Never
automatically retry a failed stage. After the run, inspect results before the
coordinator explicitly returns the writer to the normal backend.

Receipts omit target/operator/firmware metadata and frame bytes; they contain
ordered request fields, hashes, whitelisted numeric responses, monotonic times
and their UTC time origin. Keep private metadata and original recordings outside
Git. `http-complete-observation-pending` is transport evidence, never a visible
pass. The profile is deliberately labeled unverified.

Record every frame in order, wraparound and at least three complete loops in A;
verify B separately. For C/D, check that the long-held frame reverses; E is the
equal-duration control. A 60 fps video containing the display and time reference
supports per-frame/cycle measurements with stated sampling/exposure uncertainty.
Record loading/blanking and first-visible times separately from HTTP completion.
A tested frame count is not a hardware maximum, and two tested uniform delays do
not establish every intermediate delay. Keep the September 8 inconclusive
variable-timing evidence in `hardware-validation.md`. Normal application playback,
its estimated plays/duration policies and cancellation still require separate
acceptance after an evidence-supported profile is selected.
