# Working on the Pixoo playlist controller

## Start and scope

Read `README.md` for the current implementation state and commands. For planning,
implementation, or delivery, read `docs/sdlc.md`. Before changing application
behavior, read `docs/product.md` and the exact issue-linked requirements.

Before agent monitoring, MCP, controller interoperability or collector migration,
read docs/hub-integration.md for shared ownership and the canonical hub contracts.

GitHub issues own outcomes, scope, acceptance criteria, dependencies, status, and
delivery targets. Reuse existing issues. Planning-only and review-only requests
remain read-only, including GitHub. Explicit planning-document requests authorize
those documents only. A normal implementation request includes issue updates,
an isolated worktree, tests, PR publication, independent review, an eligible merge,
and main CI readback. Narrower user instructions prevail.

## Skills and validation

Use the centrally installed `github-delivery` workflow for implementation.
Compose `grill-with-docs` for unsettled implementation-changing decisions, `tdd`
for meaningful executable behavior, and `code-review` for review. This repository
explicitly composes those methods without changing their global invocation settings.
Use `writing-for-agents` for persistent instructions. Read `docs/development.md`
for shared skill provisioning; report missing prerequisites without vendoring
skills or overwriting existing installations. Substeps return to the authorized
coordinator and preserve the user's requested terminal state.

After workflow or OpenSpec changes, run `npm ci` for setup, then
`npm run check:workflow` and `npm run test:workflow` from the assigned worktree
root with Node 24. Both checks must exit zero. Report the actual specification inventory.
After TypeScript or application/tooling changes, run `npm run check` from the
assigned worktree root. After web, HTTP/static serving, or startup changes, also
run `npm run test:browser` after installing Chromium with Playwright. These checks
use isolated runtime data and must pass without a device or credentials.

Use `npm run openspec -- <arguments>` with the exact issue-linked change and local
planning root. Initialize using `init --tools none --profile core --no-animation`.
Before sync/archive, require successful current input lookups, complete applicable
artifacts/tasks, and acceptance evidence. Synchronize every affected spec and
archive on the delivery branch before final review. Conditional design omission
requires a recorded schema-based reason; failed lookups are not an omission.

The coordinator owns repository and GitHub writes. Obtain independent read-only
Standards and Specification reviews against the same committed base/head. Missing
independent review, unresolved blocking findings, or any missing/unsuccessful
configured CI job prevents automatic merge. Recheck head and base immediately
before a squash merge guarded by `--match-head-commit`; never use `--admin`.
Verify all merged-revision main CI jobs before issue closure.

## Runtime boundaries

Normal application startup remains simulator-only. The device package also has
a separately invoked HTTP spike; it is not enabled by startup. Before protocol or
hardware work, read docs/protocol-spike.md for command stages and evidence gates.
Before media ingestion, rendering, or cache work, read docs/media-rendering.md
for the library contract, limits and profile evidence. Before catalog, playlist,
migration or media deletion work, read docs/library-persistence.md for revision,
reference and storage-ownership rules. Before playback, timing, player controls
or checkpoint changes, read docs/playback.md for cancellation, history and recovery
contracts. Before HTTP routes, request authentication, SSE or API startup changes,
read docs/api.md for replay identity, admission limits and simulator boundaries.
Rendering, persistence and backend playback are implemented. Only
one local backend and one serialized operation queue may write to the configured
device. Keep private media, credentials, device details, databases, and runtime
state outside Git. Preserve originals and referenced renditions.

Source delivery does not install the app or operate the display. Before physical
tests, obtain an explicit device IP and permission to replace current content.
Never send requests to a guessed IP, change firmware, alter router/firewall
settings, or claim physical accuracy from simulator or HTTP-only evidence.
Preserve other worktrees, deployments, their owners, and live state.

## Human-facing prose

Use the centrally installed `$unslop` skill as the final editorial pass on
commentary, responses, documentation, and authorized GitHub prose. Preserve facts,
quotations, commands, contracts, and evidence. If unavailable, report it and
continue without fetching, copying, or installing it.
