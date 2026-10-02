## Context

See proposal.md. The change crosses the server projection and browser card, so a short design is included under the schema's multiple-module criterion. The Hub owns evidence; Pixoo owns its presentation.

## Goals / Non-Goals

Keep the accepted policy local to the projection. Preserve the existing snapshot and serialized writer. No timing, concurrency, persistence, migration or authorization changes are needed.

## Decisions

Use a small typed predicate for unavailable evidence and retain explicit session-state guards in the projection. Exclude only the accepted ordering/read reason combinations; a blanket exclusion by dimension would hide conflict or loss. Add unknown turn as an explicit guard. Keep the cloned unavailable metadata unchanged.

Render the source unavailable array directly as a semantic list in each Monitor card. Extend the existing client type rather than introduce a new API or reducer. Use the existing bitmap renderer unchanged; test both detail positions and label brightness.

## Risks / Trade-offs

Suppressing routine limits can hide useful context on the small display. The full browser list and retained warning cases make that trade-off explicit. Tests cover all supported dimension/reason combinations and input immutability. Existing pixel checks need known-turn baselines because unknown turn now deliberately warns.

## Migration Plan

No stored-data migration or installation is part of delivery. A source revert restores the previous presentation; shared evidence remains unchanged in either version.
