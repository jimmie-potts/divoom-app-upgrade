## Change

Describe the problem and resulting behavior. Refs #<issue>.
Link the exact OpenSpec change and ADR, or explain why no specification delta is needed.
Use Refs so issue closure waits for main CI and any additional acceptance work.

## Validation

Record actual commands and results. Workflow changes require `npm run check:workflow`
and `npm run test:workflow` after `npm ci`. Application/tooling changes require `npm run check`; web, serving and startup
changes also require `npm run test:browser`.
For executable changes, include actual failing and passing evidence or explain a proportionate substitute.

## Review and CI

Record base, head, merge-base, diff command, clean worktree state, independent
Standards and Specification reviews, finding dispositions, and current PR CI.
Read unresolved review threads and outstanding change requests before merging.
Append the merged revision and main CI result after merge.

## Runtime and hardware impact

Record source validation, installation status, and physical verification separately.
Use Not run or Not in scope when appropriate. Simulator results do not establish
physical display timing or authenticated phone access.

## Cross-project work guide (only when in scope)

Omit this section for ordinary source or tracker work; no guide refresh, hub PR
or no-impact record is required. For an authorized guide update or publication,
follow the [hub procedure](https://github.com/jimmie-potts/agent-device-hub/blob/main/docs/work-guide/README.md)
and link the relevant hub PR. A source merge does not update the public site.

- Source/tracker completion and revision:
- Guide PR, revision and validation:
- Public publication PR and revision (when authorized):
- Live verification (when publication is in scope):
- Pending stage owner and next action:
