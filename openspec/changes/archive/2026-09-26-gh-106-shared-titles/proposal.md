## Why

[Pixoo #106](https://github.com/jimmie-potts/divoom-app-upgrade/issues/106) replaces opaque session ID cards with shared titles and projects after Hub #424. User labels keep precedence, and sessions without metadata retain distinct ID tails.

## What Changes

- Consume verified agent-state 3.3.0 and lifecycle 1.1.0 archives and snapshot 1.2.
- Show bounded shared titles and projects in monitor cards and full text in the Monitor tab.
- Fold accents before pixel truncation; preserve pagination, attention pulse and exact previews.
- Replace the retired title exclusion while retaining credential, prompt, transcript, tool and private-path exclusions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-monitor-contract`: allow bounded shared title/project metadata.
- `agent-monitor-host`: negotiate snapshot 1.2 while preserving legacy projections.
- `agent-dashboard-renderer`: label/title/ID precedence, accent folding and project line.
- `agent-monitor-controls`: full title/project display and title search.

## Impact

Vendored packages, selected-source facade, renderer, browser Monitor tab, deterministic examples and their checks. Source-only delivery does not install packages into the running service, migrate live state, capture prompts or contact a device. Layout remains subject to the issue's owner checkpoint and final candidate approval.
