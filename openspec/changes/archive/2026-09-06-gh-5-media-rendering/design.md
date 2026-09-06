## Context

See proposal.md. The media package has no persisted runtime format yet. Issue #6 owns database metadata and asset deletion; API/UI delivery is later. Issue #4 observed a Pixoo64 with unknown firmware using one/two frames at 500 ms, with early loading screens. Those observations cannot establish general device limits.

## Goals / Non-Goals

Deliver a filesystem-backed library whose stored originals and rendition manifests can be referenced by later persistence. No database schema, upload endpoint, player, cleanup of committed assets, optimizer or device requests are included.

## Decisions

- Select gifuct-js 2.1.2 after original patch fixtures verify transparency, offsets, disposal metadata and raw delays. Own strict container/LZW preflight and canvas compositing because its parser tolerates malformed input and its convenience delay field normalizes zero. Use sharp 0.35.4 for PNG/JPEG orientation, resizing and PNG previews. Their licenses are MIT and Apache-2.0; transitive/native licenses stay documented. A decoder's demo is not a composition oracle.
- Decode in a short-lived child process with a default 30-second whole-job deadline, one active job and four queued requests. Node's heap ceiling, input byte/pixel/frame limits and sequential frame processing bound exposure; this is not an OS memory sandbox. Kill and reap the child before releasing capacity. Stream original bytes to a request-owned temporary directory, avoiding large in-process decode allocations.
- Validate GIF structure and total logical-canvas pixels before patch decompression. Reject malformed compressed streams, unknown rendering blocks, reserved disposal modes, out-of-canvas patches and unsupported animated PNG. Composite on RGBA; disposal 2 clears the previous rectangle to the logical background or transparency when specified, disposal 3 restores a canvas snapshot. Process one patch at a time.
- Source timing retains null/zero; effective timing uses 100 ms only for missing/zero with warnings. Preserve every positive delay. Stills have null timing, since image duration belongs to playlist policy. Profile rejection is sufficient for this issue; an optimizer would need its own preview/consent contract.
- Canonical keys include source SHA-256, transform, renderer and full validated profile. Stage files, then atomically publish complete directories without replacing existing ones. Preserve accepted originals under content hashes. Failed attempts delete their own staging only; startup never sweeps another task's files. Existing cache corruption fails closed rather than overwriting a referenced result.
- Default profile is provisional simulator-only. An opt-in observed Pixoo64 profile accepts at most two frames and exactly 500 ms animation delays, linked to #4; it makes no broader firmware claims. PNG previews are encoded from final RGB bytes and carry matching delays in the manifest. The UI can consume them in its own issue.

## Risks / Trade-offs

- Native decoder allocation is outside the JS heap ceiling: enforce input/canvas/frame bounds and deadlines, disable sharp caching and limit per-child concurrency. OS-level quotas are a deployment concern.
- A process crash can leave its own staging or an unreferenced original: normal error/abort paths clean staging; never sweep committed or foreign data. Database reachability cleanup belongs to #6.
- Firmware and precise visible timing remain unknown: observed profile is narrow and source-only tests never contact hardware.
- Compositor errors can look plausible: use exact pixel fixtures and independent browser/sharp decoding for well-defined cases.

## Migration Plan

Additive package API only. New output is versioned and kept outside Git; no existing data is migrated or deleted. Rollback removes source use of the new API while preserving files.
