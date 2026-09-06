# ADR 0005: Bounded media rendering and immutable outputs

Status: Accepted for issue #5, September 6, 2026.

The backend needs reproducible full frames and timing before persistence or
playback can reference media. Decoding untrusted bytes in the API process would
let expensive input interrupt unrelated work.

Use a bounded stream-to-file queue and a short-lived child process for decoding.
Pin sharp 0.35.4 and gifuct-js 2.1.2. Own GIF structural validation, compositing
and raw/effective timing policy, since parser convenience defaults can erase
source timing distinctions. Missing/zero delays become 100 ms with warnings;
positive delays remain unchanged. No optimizer is implicit.

Publish content-addressed originals and complete immutable rendition directories.
Keys include transforms, renderer version and complete profile. Preview PNGs come
from effective RGB bytes. Database reachability and garbage collection remain
#6. Preserve failed-crash remnants until an ownership-aware cleanup policy exists.

Simulator bounds remain provisional. The optional Pixoo64 profile is restricted
to one/two frames at 500 ms, reflecting #4 with unknown firmware and observed
loading screens. No renderer call operates the device.

The process heap ceiling does not limit all native allocations. Byte, canvas,
frame and deadline checks remain required, and deployment may add OS quotas.
See [media-rendering.md](../media-rendering.md) for the API and evidence.
