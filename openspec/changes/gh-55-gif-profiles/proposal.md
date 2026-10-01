## Why

[Pixoo #55](https://github.com/jimmie-potts/divoom-app-upgrade/issues/55) separates useful GIF imports from the dated physical smoke profile. Device mode currently rejects complete animations before they enter the library or can be previewed.

## What Changes

- Admit complete library imports under existing application resource budgets in either runtime mode.
- Show playback compatibility alongside effective previews and retain physical admission checks.
- Add a fixed, bounded, offline-default qualification tool for frame count and timing. Retain the historical device profile and add a separately selected GIF profile from the completed physical observations.

## Capabilities

### New Capabilities

- `gif-qualification`: bounded synthetic frame-count and timing experiments with distinct transport and visible evidence.

### Modified Capabilities

- `media-rendering`: separate library rendering from active playback limits.
- `controller-ui`: display playback compatibility without limiting previews, simplify optional device notes, and show the active profile limits.
- `application-foundation`: accept either dated observed profile at explicit device startup.
- `local-operations`: document selection and physical acceptance for the selected profile.

## Impact

Server catalog composition, browser media library, device qualification tooling and tests. No dependency, database migration or default hardware activation change. Add an explicit 20-frame production playback profile with one fixed 100–800 ms delay per animation; preserve the historical profile and require normal-player acceptance. Issue criteria AC1–AC2 and AC6 cover source work; AC3–AC5 require physical evidence and acceptance.
