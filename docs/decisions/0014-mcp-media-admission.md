# ADR 0014: Shared media admission and temporary playback

Status: Accepted for issue #25 source implementation.

## Context

Local agents can already use the shared MCP module for Pixoo display controls. Media commands need the existing app's command identities and player. Current start retires playback before selection validation; checkpoints assume saved playlists. Issue #25 requires failed selections to preserve playback and single-media sessions to avoid saved-library edits.

## Decision

Extend the existing ControlService and Commands instance with canonical player admission. HTTP and MCP share it, including original fingerprints and retained results. Register fixed media/playback extensions through the delivered shared registry. Select an exact rendition and use bounded catalog summaries; never introduce a second scheduler, writer or media renderer.

Validate the chosen immutable content, expected revision and effective policy/profile before retirement or checkpoint replacement. Guard capture at its queued transaction boundary. Adopt a successfully committed record synchronously before another control can persist context. Keep immediate cancellation and the existing player context queue. Validation failures preserve the previous session; post-admission device failures retain established uncertainty semantics.

Temporary media has immutable source metadata and retained session references, with one internal traversal item and no saved playlist insertion. Old source-less checkpoints remain saved-playlist context. Temporary context restores paused and retains its rendition until replacement or clear. Public saved-playlist identity is absent for media. Saved-playlist restart is unavailable for that source.

## Alternatives

A synthetic saved playlist would mutate the catalog merely to play one item. HTTP proxying from tools would couple native access to browser transport and obscure replay ownership. A preliminary revision lookup without guarded transactional capture would permit intervening edits. Retiring before validation would stop valid content on an invalid request. Each alternative violates an issue outcome.

## Consequences

The checkpoint and player must preserve source identity, and the browser must label temporary context accurately. New source metadata needs backward-read tests and a documented downgrade procedure. An older binary may reject media context; clear it with the current version or restore a compatible offline backup before downgrade. Source delivery performs no live migration, installation or physical test. The change's design and tests own the detailed admission protocol.
