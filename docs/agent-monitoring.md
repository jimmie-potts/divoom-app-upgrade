# Shared monitoring consumer requirements

Pixoo consumes shared lifecycle and state code from released Hub packages.
This delivery pins lifecycle schemas/fixtures and defines consumer requirements.
Collectors, a runtime state owner, monitoring APIs and UI remain planned.
Read the [vocabulary mapping](agent-monitoring-vocabulary.md),
[hub integration](hub-integration.md) and [ADR 0010](decisions/0010-shared-agent-device-hub.md).

## Supported source contract

The supported lifecycle artifact is `@jimmie-potts/agent-lifecycle-contracts`
`1.0.0`, API `1.0`. Its closed schema rejects missing/unknown versions and unknown
fields. Do not default a missing version, strip fields to disguise an unsupported
version or treat rejection as successful monitoring.

The committed release archive, source/SHA-256 receipt and npm lock support
installation without another checkout or authenticated release access. The
manifest identifies schema, fixtures, validators and qualification documents.
Upgrades require reviewed pins and shared conformance checks. Source acceptance
establishes corpus behavior, independently of provider emission, state reduction
or physical output.

## Required-client matrix

This dated summary uses Hub's 2026-09-08 source qualification. The
[pinned record](https://github.com/jimmie-potts/agent-device-hub/blob/855bd3787803dad7245f29e88c758659f6e4eda4/docs/provider-qualification.md)
owns artifact identities, primary documentation and limits. Versions below are
artifact evidence, not qualified live Pixoo installations.

| Required path | Inspected version evidence | Shared source contract | Installed-client coverage |
| --- | --- | --- | --- |
| Codex CLI in WSL Linux | npm `0.153.4`; executable version check passed | API `1.0`, client `cli` | Hook emission, bounds and end-to-end operation unverified |
| Codex CLI in native Windows | npm `0.153.4`; binary present | API `1.0`, client `cli` | Invocation and live hooks unverified |
| Codex Desktop in Windows, targeting Windows or WSL | Version and hook path inaccessible | API `1.0`, client `desktop` | Unqualified until version, route and required coverage are established |
| Claude Code in WSL Linux | Native artifact `2.1.236` | API `1.0`, client `code` | Live hooks and delivery bounds unverified |
| Claude Code in native Windows | Native artifact `2.1.237`, byte identity verified | API `1.0`, client `code` | Live hooks and delivery bounds unverified |

Pixoo consumes the shared translation; provider payload mapping belongs to Hub.

| Capability | Consumer requirement and evidence limit |
| --- | --- |
| Session/turn identity | Preserve the full selector and available turn identity. Codex has event-specific turn identity; Claude prompt identity has version/availability limits. Missing evidence remains unknown. |
| Continuing/blocking input | Require qualified operation semantics; do not classify question text or infer a blocked wait from silence. |
| Approval/resolution | Require correlation; an unrelated resolution cannot clear a wait. Monitoring never changes permissions. |
| Turn/runtime end | Preserve turn end, interruption and runtime end separately. Reviewed Claude evidence does not establish a Codex-equivalent Interrupt event. |
| Parent/child identity | Aggregate only attributable children. Unsupported relationships and counts remain unknown. |
| Native IDs/ordering | Common documented fields do not establish universal native event IDs or total ordering; retain shared deduplication and ordering limits. |
| Read/unread | Optional qualified Codex Desktop evidence only. Absence is neither read/unread nor monitor acknowledgment. |
| Delivery/freshness | Async settings alone do not prove bounded delivery. Lost/stale observations remain visible, and provider failure cannot hold agent execution. |

Qualify the required version, route and signal coverage before enabling a
producer path. A required gap needs an explicitly accepted degraded mode that
shows uncertainty. Leave a path disabled when identity, privacy or safe delivery
cannot be established. Optional read evidence may remain unknown. This source
delivery supplies no installed qualification or degraded-mode approval.

## Missing, invalid and stale evidence

A future consumer rejects unsupported/missing versions with a fixed bounded
error and no payload echo. Rejection preserves fail-open agent execution and
media operation. Keep the last valid state subject to its freshness rules;
invalid input cannot refresh it, clear attention, mark a notice read or fabricate
successful synchronization. Bounded diagnostic counts must not retain input.

Validate and bound raw input before monitoring storage. API `1.0` allows at
most 8192 UTF-8 JSON bytes, depth 8 and 256 visited values including keys. These
are admission limits, not measured latency budgets. Hub #30 owns the measured
budgets; Hub #3 owns shared producer and state enforcement.

## Browser and task requirements

The Codex-first browser must keep sessions/turns distinct, show activity and
attention independently, retain turn-ended notices, show freshness and allow
explicit user labels and monitor acknowledgment. Claude source compatibility
remains required. The browser consumes the issue #31 session-source boundary;
it interprets neither raw provider payloads nor another reducer. Issue #32 owns
64x64 rendering; issue #33 owns the monitor panel and Monitor/Media controls.

Acknowledgment targets the exact notice for the configured Pixoo consumer. It
claims neither readership nor another consumer's acknowledgment. An unavailable
feed cannot manufacture successful acknowledgment. Collection is independent
of display mode/device availability; unsolicited events must not take over Media.
Screen-on alone neither resumes playback nor requests monitor redraw. Preserve
playback recovery, originals and referenced renditions.

## Source ownership and hosting

Hub owns shared schemas, provider interpretation, reduction, persistence and
state interfaces. Pixoo consumes reviewed released packages and owns backend
composition, browser presentation, monitor policy, rendering and its device
writer. Planned shared code must not be described as already implemented.

Issue #31 initially embeds the real shared state owner in the existing Pixoo
backend. That host location does not transfer shared source ownership. Do not
copy adapters/reducers or substitute a fake upstream for the released core.
Its embedded/remote session-source facade serves snapshots, updates, labels and
acknowledgment. Remote mode must not start an embedded fallback reducer.

A later standalone owner requires explicit quiesce/export/import, preserved
identity, endpoint switching, verification and rollback. Never run concurrent
owners against live state or share mounted controller SQLite across Windows/WSL.
State ownership is separate from device ownership: browser, MCP and Hub device
requests use existing services and one serialized Pixoo writer. Monitoring adds
neither another adapter nor arbitrary device targets, and preserves browser
authentication.

## Legacy compatibility and delivery limits

Preserve legacy Nanoleaf behavior until an explicitly selected, verified cutover,
including its collector, unread policy, Work/Quiet/Free behavior, preferences and
scenes. Source adoption installs no hooks, changes no personal settings, starts
no client sessions, migrates no live state and contacts no device. Hub #8 owns
shared installation/migration tooling; Pixoo #34 owns installed-provider and final
acceptance. Transport and visible-device evidence remain separate.

Canonical source checks exercise the shared corpus and package integrity.
Runtime, browser, installed-client and physical claims require later evidence.
