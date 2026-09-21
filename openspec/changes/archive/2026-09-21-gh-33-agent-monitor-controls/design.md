## Context

The baseline is 9bd99c1. The existing ControlService joins browser, controller and MCP playback/display commands through Commands and Player. Player owns the sole adapter. The opt-in monitor source owns shared-state access, and DashboardService already bounds rasterization. ADR 0015 selects full RGB frames and a 1000 ms minimum submission interval.

## Goals / Non-Goals

**Goals:** One explicit participation policy, one selected view, shared command identity and guarded recovery. Verify ownership under delayed uploads, concurrent clients and persistence failure.

**Non-Goals:** New provider interpretation, state-owner migration implementation, new MCP tools, general Hub frontend, device activation at startup, installation or physical acceptance.

## Decisions

- Add a server presentation service that holds persisted mode/filter/cadence configuration and transient activation/generation/send evidence. Configuration is atomic private JSON; missing means Media/default view, invalid data fails closed. Playback context stays in its existing store. Startup never restores activation. This avoids putting consumer settings into the shared reducer.
- Keep Player as the only adapter owner. Add a finite guarded dashboard-upload operation for a paused player generation, sharing its abort signal, adapter generation and FIFO. Mode changes and active Monitor view changes retire the old player generation before waiting for persistence. Editing a view in Media preserves ongoing playback. A late upload can return transport evidence but cannot update current presentation.
- Serialize integration configuration and media intent context work, not upload lifetimes. Screen-off cancels immediately. Monitor uploads retain one in-flight promise, consume only the latest current DashboardService rendition, and enforce submission-start spacing. An error suspends participation; automatic monitor retries are zero, a bounded policy that preserves ADR 0015 uncertainty handling.
- Media start/resume selects Media; explicit mode-only Media leaves playback paused. Pause/stop/navigation preserve mode but retire active monitoring until an explicit Monitor activation. Native and MCP calls use ControlService, so they cannot bypass this policy.
- Add strict shared browser schemas and a separate `/controller/pixoo-integration/v1` API, protected by existing native credentials. Leave released controller v1 modes unavailable and its schema/archive untouched. Integration commands share Commands, with canonical fingerprints and expected revision/generation checks. Expose finite capabilities and sanitized state. Shared labels/acknowledgments use the selected source's own request identity and never substitute one after a lost response.
- Reuse Events for lightweight presentation invalidation and current-snapshot resync. Native extension streams reauthorize on delivery and periodically. Browser reads use the existing same-origin API security; machine ingress retains its separate bearer boundary. RGB buffers and full sessions are fetched, not copied into every SSE history entry.
- Extend the existing dashboard filter with optional projectId and full session identity. The installed shared-state type already supplies neutral projectId. Do not infer a project from paths or introduce tags. The browser shows explicit user-chosen labels and the canonical fallback/truncation preview.

## Risks / Trade-offs

- Cancellation cannot undo an applied physical request → preserve uncertainty and never claim visual rollback.
- Persistence errors could separate intent and writes → deactivate before writes, commit settings before activation, remain inactive on failure.
- Concurrent mode/media/screen actions could publish obsolete effects → serialize context changes and compare captured generations at submission and completion.
- New protected routes could bypass checks → finite route allowlists, strict identities/scopes, negative authentication/Origin/replay tests and high-impact independent review.
- Polling previews is not evidence of installation or device visibility → browser/fake/injected transport checks only; #34 retains those acceptance gates.

## Migration Plan

Missing presentation configuration starts in Media with no display work. Existing player checkpoints restore unchanged and paused. New settings are independent of the shared owner and contain no credentials or destination. Older binaries ignore the new settings file; rollback still requires normal stopped-backend ownership discipline. Guide source will be reconciled through a linked Hub PR; public publication is not part of this delivery.
