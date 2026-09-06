# Media rendering

`@pixoo/media` accepts streamed PNG, JPEG and GIF bytes and returns immutable
64x64 renditions. It is a backend library. HTTP upload routes, the media library,
database metadata, playback and deletion policies belong to later issues.
No renderer call contacts a device.

## Use the library

Build with Node 24 and `npm run build`. Pass a dedicated absolute directory
outside Git, normally beneath the application's configured `PIXOO_DATA_DIR`.
The store rejects Git checkouts and symlink aliases into them. It does not read
environment variables or filenames to infer media type.

```ts
import { createReadStream } from 'node:fs';
import { MediaStore, DEFAULT_TRANSFORM } from '@pixoo/media';

const store = new MediaStore({ directory: mediaDataDirectory });
const rendition = await store.render(createReadStream(originalPath), {
  transform: { ...DEFAULT_TRANSFORM, background: [0, 0, 0] },
  signal: cancellationSignal,
});
const preview = await store.readFrame(rendition.id, 0, 'png');
const frame = await store.readFrame(rendition.id, 0, 'rgb');
```

Reuse one store per backend. Each input is an `AsyncIterable<Uint8Array>`;
producer-owned chunks are copied before asynchronous writes. Callers own their
input stream and should support iterator cancellation. A noncooperative producer
cannot keep the media job or its partial files alive after the job deadline.

`render` returns a manifest with source metadata, normalized transform, selected
profile, renderer version, ordered frame hashes/delays and timing warnings.
`readFrame` returns a fresh buffer. PNG previews encode the exact effective RGB
bytes; consumers use the manifest's ordered delays to animate them. No separate
preview resampling or source-GIF replay is involved. Originals stay byte-identical.

## Safeguards and errors

| Setting | Default | Configurable ceiling |
| --- | --- | --- |
| maxUploadBytes | 10 MiB | 100 MiB |
| maxSourcePixels | 50 million | 100 million |
| concurrency | 1 active request | 4 |
| maxQueued | 4 waiting requests | 16 |
| timeoutMs | 30 seconds from submission | 120 seconds |

These are application safeguards. GIF pixel accounting charges the complete
logical canvas for every frame, even small patches. The selected profile also
bounds frame count. Input bytes are bounded while streaming; structural and
canvas checks precede expensive decoding. PNG/JPEG decoding uses sharp's pixel
limit and strict failure mode. Animated PNG, unknown GIF rendering blocks,
reserved disposal methods, damaged LZW streams and unsupported signatures fail.

Each decode runs in a short-lived child process with a 256 MiB JavaScript heap
ceiling, disabled sharp caching and one native worker. Native allocations are
outside that heap ceiling. The byte/pixel/frame limits and process deadline bound
work; this is not an OS memory sandbox. Large files within an input limit can
still fail to decode if the process exceeds its resources.

A timeout includes queueing, input streaming and decoding. Cancellation stops
consumption, asks the iterator to return, and kills/reaps an active decoder before
releasing its slot. Existing originals and renditions are never swept. Normal
failures remove only that request's staging directory. An abrupt parent crash
can leave staging or an unreferenced original; database-aware cleanup is #6.

`MediaError.code` distinguishes `invalid-input`, `unsupported`, `upload-limit`,
`pixel-limit`, `profile-limit`, `busy`, `timeout`, `cancelled`, `decode-failed`,
`cache-corrupt` and `storage-error`. Errors omit paths, source bytes and native
error text. No failed job publishes a shortened or partially rendered result.

## Pixels and timing

Orientation is applied before resizing. `fit: 'fit'` pads the full source;
`fit: 'crop'` crops centrally to fill the square. `scaling: 'nearest'` preserves
hard pixel edges; `scaling: 'smooth'` uses Lanczos3. Transparency is flattened
onto the required RGB background. Defaults are fit, nearest and black.

GIF composition supports frame offsets, transparency, interlace and disposal
0/1, 2 and 3. Disposal 2 restores the previous rectangle to the GIF background,
or transparency when the frame specifies it. Disposal 3 restores the canvas
snapshot before that patch. The transparent canvas is flattened only during
rendition rendering.

Source delays retain their raw millisecond values: zero stays zero and a missing
graphic-control extension becomes null. Missing/zero delays become 100 ms in
effective frames with `missing-delay` or `zero-delay` warnings naming the frame.
Positive delays remain unchanged, including 10 ms. A missing source delay makes
source duration null; effective GIF duration is the sum of effective delays.
PNG/JPEG frame delays and durations are null because playlist policy owns still
image duration. Single-frame GIFs retain GIF identity and timing. Embedded GIF
repeat metadata does not override playlist play counts.

## Profiles and immutable storage

The default `SIMULATOR_PROFILE` is labeled `provisional-simulator`: at most 500
frames, 10–655350 ms positive delays, variable timing allowed. These are simulator
safeguards, not device measurements. Caller-supplied simulator profiles must fit
the validated configuration ceilings.

`PIXOO64_SMOKE_PROFILE` is an explicitly selected `observed-device` profile. It
accepts one or two frames with exactly 500 ms animation delays, reflecting the
[September 6 smoke test](https://github.com/jimmie-potts/divoom-app-upgrade/issues/4#issuecomment-5562714620).
The user identified Pixoo64; firmware was unknown and early loading screens were
observed. This profile establishes no broader limits or precise visible timing.
Custom observed-device claims are rejected. The protocol spike's separate
experimental profile is not changed by this renderer.

Profile violations fail with `profile-limit`. The package does not truncate,
drop frames or resample timing to make content fit. Explicit previewed optimization
can be designed later; rejection is the current supported behavior.

Originals are stored as `originals/<sha256>`. A rendition ID hashes the source
hash, complete canonical transform, renderer version and complete profile.
`renditions/<id>/` holds `manifest.json`, numbered `.rgb` files and numbered PNG
previews. A complete staged directory is published atomically; duplicate requests
reuse it. Existing files are never overwritten. Cache reads validate identity,
metadata consistency and frame hashes; corruption fails closed. Even cache hits
must satisfy the current upload and source-pixel limits.

## Decoder evidence and licenses

The chosen [gifuct-js 2.1.2 source](https://github.com/matt-way/gifuct-js/tree/c497192922d79acc537ec9f4796dfa2d89aaa13a)
returns decoded patches and disposal metadata. Its convenience delay field
normalizes zero internally, so this renderer reads raw control-extension delays
instead. Original generated fixtures checked patch pixels, transparency, offsets,
disposal metadata and raw variable/zero/missing delays before dependency adoption.
Strict container/LZW validation and composition are application-owned.

[sharp constructor documentation](https://sharp.pixelplumbing.com/api-constructor/)
describes pixel limits; its [orientation](https://sharp.pixelplumbing.com/api-operation/)
and [resize](https://sharp.pixelplumbing.com/api-resize/) operations supply the still
image and transform path. Versions and installed license metadata are recorded
in [dependencies.md](dependencies.md). No upstream demo compositor or artwork was
copied. All committed fixtures are generated from original small pixel patterns.

Tests cover malformed/over-budget input, GIF patches/disposal/interlace/timing,
JPEG orientation, PNG alpha, crop/scaling, queue/cancellation/process deadlines,
cache identity/corruption, preservation and cleanup. A normally compressed GIF
matches an independent sharp decode. Chromium decodes every stored preview pixel
at desktop and mobile sizes and compares it to the effective RGB frames.
