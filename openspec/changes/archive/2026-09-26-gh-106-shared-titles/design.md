## Context

See proposal.md for the outcome. This change crosses the selected-source facade,
shared packages, bitmap renderer and browser view, so the schema requires a design.
Shared title/project metadata arrives in lifecycle 1.1 and snapshot 1.2; Pixoo
previously consumed agent-state 1.0.0 and snapshot 1.0.

## Goals / Non-Goals

Use the shared owner's bounded metadata without another provider mapper or local
metadata store. Keep one state owner, one device writer, ten-second pages, the
existing cadence and attention-only two-frame pulse. No installed service, hook,
settings, live state, prompt capture or device operations are part of this delivery.

## Decisions

- Pin released state 3.3.0 and lifecycle 1.1.0 archives, source receipts and
  manifest hashes. Use released Hub 0.4.0 in the isolated loopback compatibility
  test. This verifies the real owner protocol as well as fixtures.
- Select snapshot 1.2 internally and request it explicitly from remote owners.
  Keep authenticated session reads at 1.0 by default, with explicit 1.1/1.2
  projections. A downgraded or invalid remote response is stale/unavailable;
  it cannot silently erase metadata or create a fallback owner.
- The shared label wins, then title, then ID tail. NFD accent folding precedes
  uppercase alphabet mapping and the existing 20-character truncation/wrapping.
  Full Unicode title and project remain in the browser and rendition metadata.
- The owner selected candidate A from the side-by-side preview: a dedicated
  project line at y45, retaining the activity word. Project text has 15 display
  characters, shortened with a middle ellipsis. When a project exists, child and
  uncertainty details move to y21, and title lines start at y27/y36. Their ink
  bounds are 21–25, 27–33/36–42 and 45–49, with blank rows between them. Without
  a project, the existing title and detail positions remain. Candidate B would
  replace the activity word and leave only seven project characters; it was not
  selected.
- Query matching includes label, title, project and session ID. The existing
  neutral projectId grouping filter remains distinct from the presentation name;
  equal project names never combine sessions.

## Risks / Trade-offs

- Long projects are shortened on the 64x64 card → show the complete name in the
  Monitor tab and synthetic preview metadata.
- The package upgrade adopts the shared owner's retention/current-status rules
  → use current synthetic event timestamps, verify explicit unavailable-child
  evidence, and test current notices surviving journal pruning separately from
  24-hour stale-session retirement. No custom Pixoo reducer is added.
- A selected remote owner must support snapshot 1.2 → report unsupported owners
  as unavailable/stale. Upgrade the installed owner only under separate authority.

## Migration Plan

This is source-only. Tests use isolated stores, an empty controller list and
loopback endpoints. A later installation needs its own owner selection and
backup/rollback procedure; this delivery does not migrate or open live stores.
Final source review and UI approval apply to the completed candidate. Physical
readability, installed hooks and live title/project cards remain unverified.
