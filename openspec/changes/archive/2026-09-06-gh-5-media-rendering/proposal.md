## Why

Issue [#5](https://github.com/jimmie-potts/divoom-app-upgrade/issues/5) needs a bounded renderer before persistence, playback, and the media library can consume user files. The media workspace currently contains only canvas dimensions.

## What Changes

- Validate streamed PNG/JPEG/GIF uploads and preserve accepted originals outside source.
- Decode and composite GIF patches, normalize undefined timing with warnings, and render complete RGB frames with orientation, transform and background controls.
- Bound decoding in a child process and publish immutable cached renditions with previews of the actual effective frames.
- Keep simulator limits distinct from the narrowly observed Pixoo64 smoke profile.

## Capabilities

### New Capabilities
- `media-rendering`: bounded ingestion, source/effective timing, transforms, immutable renditions and previews.

### Modified Capabilities
None.

## Impact

The media package gains a library API and pinned sharp/GIF decoding dependencies. Tests cover fixtures, process limits, file cleanup and browser decoding of effective previews. No upload HTTP route, media-library UI, database, player or device operation is introduced. Source delivery remains the target.
