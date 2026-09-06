## 1. Decode and render

- [x] 1.1 Pin licensed decoder dependencies after original patch-fixture checks; verify raw timing, transparency and disposal metadata and record provenance.
- [x] 1.2 Implement strict signature/container/pixel checks and GIF compositing with focused red/green fixtures for patches, disposal, interlace, timing and malformed input.
- [x] 1.3 Implement orientation, fit/crop, scaling, background and profile gates; verify exact full RGB pixels, independent PNG/GIF decode and source/effective metadata.

## 2. Background storage

- [x] 2.1 Implement bounded streaming, queueing and child-process decode with timeout/cancellation tests proving cleanup and subsequent progress.
- [x] 2.2 Publish immutable originals/renditions and effective previews; verify concurrent deduplication, cache identities, corruption rejection and existing-file preservation.

## 3. Delivery evidence

- [x] 3.1 Document API, safeguards, licenses, provisional/observed profiles and evidence; pass canonical application/browser/workflow checks before spec sync/archive and independent review.
