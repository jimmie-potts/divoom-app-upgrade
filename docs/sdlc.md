# Development workflow

## Ownership and authority

GitHub issues own requested outcomes, delivery scope, acceptance criteria,
dependencies, status, and delivery target. OpenSpec owns reviewed capability
requirements and issue-linked proposed changes. ADRs own lasting decisions;
PRs own reviewed revisions, tests, CI, and finding dispositions. The shared
agent-skills catalog owns reusable methods. Link these sources; do not create
a second status ledger or duplicate issue acceptance criteria in OpenSpec.

Planning and review requests are read-only, including GitHub. Explicit requests
for planning documents authorize those documents only. A normal implementation
or documentation-maintenance request includes issue tracking, isolated worktree,
code/docs, tests, PR publication, independent review, an eligible merge, main CI
readback, and [cleanup after delivery](#cleanup-after-delivery). A narrower user
request prevails. Skill handoffs preserve existing authority and return to the
coordinator; they grant no extra authority.

Source-only is the default delivery target. Installing the app, replacing display
content, or testing physical behavior requires an explicit request and an owner.
Before device tests obtain the explicit IP and permission to replace current
content. Source and simulator checks never imply installation or hardware success.

## Prepare work

Search existing issues first. Draft features with the prompts in
[scope defaults](#scope-defaults) and bugs with the bug form. Maintenance and
investigation issues use the same headings in Markdown. Source-only is the
default delivery target.

Keep descriptive labels such as bug, enhancement, documentation, maintenance,
hardware, and deferred. Each open delivery issue has exactly one status label:

| Label | Meaning |
| --- | --- |
| status:backlog | Waiting for prerequisites or decisions |
| status:ready | Criteria, dependencies, and implementation-changing decisions are settled |
| status:in-progress | Implementation or validation underway |
| status:review | PR review and final validation underway |

Add blocked separately with a reason and next action. Preserve descriptive labels
when replacing status labels. On closure remove all status labels and blocked.
No Project board, status bot, or scheduled service is required.

Read docs/product.md before application work. The preserved handoff is historical
planning context; translate issue outcomes into capability scenarios before
implementation. Reviewed specs replace proposed requirements for delivered
capabilities. An empty bootstrap inventory is not an implemented behavior baseline.
Resolve source conflicts before dependent work.

Use plan-work and deliver-work only when explicitly invoked; ordinary work
follows this SDLC. Compose grill-with-docs for unsettled choices,
tdd for meaningful executable behavior, and code-review for review. Use research
or openai-docs for source-dependent facts, how for existing behavior, and
diagnosing-bugs for unknown failures. Investigation alone does not authorize a fix.
Read docs/development.md for provisioning; do not copy shared skills into this repo.

When the authorized scope includes a guide update or publication, follow the
[cross-project work guide procedure](#cross-project-work-guide).

## Scope defaults

This is a personal project. Size each story for how it actually runs: one
operator, one local backend on the selected host (simulator by default), and the
Pixoo explicitly configured in its private startup configuration. Add hosts,
users, services or automation only when the story needs them. These defaults
never remove an already accepted capability.

Assess scope when drafting a story, at pickup and after a material scope or
assumption change, whether or not `plan-work` or `deliver-work` was invoked.
Use the shared assessment in the installed deliver-work package's
`references/work-assessment.md`, found through the host's skill discovery.
Reading it does not invoke either skill. If it is unavailable, report that and
apply this section. Codex and Claude follow the same policy. A read-only request
reports the assessment instead of editing the issue.

Draft stories with the five prompts of the
[feature form](../.github/ISSUE_TEMPLATE/feature.yml). A small story may answer
them in a few sentences.

1. Outcome and real setup.
2. Smallest useful implementation, with dependencies.
3. Behavior and protections to preserve.
4. Observable acceptance and planned evidence, with the delivery target.
5. Meaningful deferrals, each with its consequence or manual alternative and
   its owning issue or revisit trigger.

Prefer existing components and explicit manual steps where practical. Avoid
speculative platform support, abstraction layers, automatic rollback systems and
broad outage matrices. Always protect supported behavior: one authoritative
state owner and one serialized device writer, correct targets, bounded queued
work, no unsafe replay, accurate freshness and completion, manual control, and
user data integrity, including originals and referenced renditions.

Basic credential hygiene and the existing authorization and origin checks apply
to local use too. Reassess before remote or public exposure, including LAN
access, an additional operator or writer, expanded compatibility, or recurring
failures. A change that could lose irreplaceable data needs practical recovery
evidence, using existing facilities where possible; this is not a general
backup-tooling requirement.

For each meaningful cut, name the capability or assurance lost and reconcile
dependent issues and specifications within the task's authority. Never silently
remove requested behavior; ask the user when a cut would change it. Scope
defaults keep review, CI, OpenSpec and the source, installation and physical
boundaries, with their existing exceptions, and add no new gate.

For a consequential change to credentials, persistent state, concurrency or
device commands, define acceptance examples before implementation. Give the owner
a short walkthrough in the PR with code and test links: state and writer
ownership, timeout, restart and duplicate behavior, the important failure test,
and diagnosis and recovery. Explain any change that weakens an existing test
assertion. The walkthrough is an understanding aid, not an approval gate.

Judge these defaults from existing PR evidence: delivery time, correction rounds,
defects after merge and human effort. Unknown effort or usage stays unknown.
[agent-skills#44](https://github.com/jimmie-potts/agent-skills/issues/44) owns
the comparative evaluation; no metrics service or parallel report is required.

## Plan and implement

- Small contract-preserving fixes need an issue, reproduction, focused check, and an explanation that no specification delta is required.
- Features and changed contracts need an issue plus OpenSpec proposal, capability deltas, and tasks.
- Timing, state migration, concurrency, installation, and significant design changes also need applicable design/failure/recovery work and an ADR for lasting choices.
- Documentation and tooling without product behavior changes need an issue/PR and a recorded reason why no product spec delta applies.
- Uncertain feasibility needs a bounded investigation, question, and stop condition.

Use the pinned standard spec-driven schema through `npm run openspec -- <arguments>`
from the assigned worktree. Identify the exact issue-linked change and planning
root. Use `gh-<issue-number>-<slug>`, checking both active and archived changes for
collisions. Do not choose the newest or only change as a substitute for identity.
Further work on an archived capability needs a new scoped change.

Evaluate the schema's conditional design criteria. If omission is valid, record
the reason and verify the remaining applicable artifacts. OpenSpec 1.12.0 can
report `isPlanningComplete: false` for valid conditional omission; the flag alone
is not a completion proof. Every task requires observable acceptance evidence.

Refresh main, inspect worktrees, record the base revision, and create
`codex/gh-<issue-number>-<slug>` in an isolated worktree. Preserve unrelated work.
Map dependencies before delegation. The coordinator owns durable repository and
GitHub writes; independent review agents return findings without editing.

For executable behavior, select one scenario, observe the focused failure,
implement, rerun it, and refactor while green. Keep real red/green evidence.
When a failing automated reproduction is impractical, explain why before changing
production code and choose a proportionate executable or observable substitute.
Do not invent a red run or test document wording merely to satisfy TDD.

Bootstrap adapts existing Nanoleaf tooling and fixture checks. It does not change
product behavior. Verify those imported checks in a fresh environment and report
their actual results without claiming a pre-fix product failure.

Run the canonical commands in docs/development.md. After fixes, repeat checks
according to changed behavior, failures, and unresolved concerns. All configured
CI jobs are still required. Resolve scope changes before proceeding and put
unrelated improvements in separate issues.

## Review and merge

1. Complete implementation, docs, acceptance checks, and applicable OpenSpec artifacts/tasks. Obtain successful current CLI status and sync/archive instructions. Verify every affected capability; synchronize and archive on the delivery branch before final review. A failed lookup or incomplete artifact blocks archive. Run both workflow checks.
2. Commit the full candidate and open its PR with `Refs #<issue>`. Record base SHA, head SHA, merge-base, diff command, and clean worktree state. Keep revision-specific evidence in the PR.
3. Obtain independent read-only Standards and Specification reviews of that same comparison. Use fresh review agents and the code-review method with GitHub as scope owner. Give each the issue, relevant contracts, and its own rubric. Self-review is insufficient. Missing independent review leaves the issue blocked and PR open.
4. Fix P0-P2 defects. Obtain reviewer reassessment for disputed findings and renewed review after relevant candidate changes. Record P3 dispositions and follow-up issues where deferred. Read every page of GitHub reviews and review threads. Resolve threads after fixes or agreed disposition; do not dismiss outstanding change requests to enable merge.
5. Inspect CI at the candidate revision to enumerate all jobs. Current CI requires Workflow checks on ubuntu-latest and windows-latest, Application checks on both hosts, and Simulator browser checks. Require every configured job to succeed on the latest PR run associated with the current head and PR. Missing, pending, skipped, cancelled, or failed jobs block merge. Read all result pages. An empty required-check list proves nothing.
6. Immediately reread issue scope, dependencies, PR head, and main. If head or base changed, refresh the comparison and affected tests/reviews/CI. Require no unresolved decisions, blocking findings, or outstanding change requests. Squash-merge only the reviewed head with `gh pr merge <number> --repo jimmie-potts/divoom-app-upgrade --squash --match-head-commit <reviewed-head>`. Never use `--admin` or delete another task's worktree/branch.
7. Read back the merged commit on main and its push CI. Every configured job must succeed. Close the issue only when all its acceptance criteria are met; remove status labels/blocked and read back closure. Keep it open and blocked if main CI fails, developer prerequisites remain unavailable, or requested installation/physical acceptance remains unfinished.
8. Clean up this delivery's own worktree and scratch as described in [Cleanup after delivery](#cleanup-after-delivery).

This repository is public. While it was private, branch protection returned an
account-plan 403 on September 5, 2026. Protection is now available, but `main`
has no branch protection rules or rulesets configured. These checks are
procedural safeguards. Delivery work does not change visibility or account
settings; honor any protections introduced later. No background merge service is
used.

### Cleanup after delivery

Start once step 7 has confirmed that the merged revision's push CI succeeded and
read back the issue state. Cleanup does not wait for installation or physical
acceptance unless that work still uses the worktree. Clean up only what this
delivery created:

1. Confirm the PR is merged and the delivery worktree's `HEAD` is the PR's reviewed head (`headRefOid`, the `--match-head-commit` value), not the squash commit on `main`. Squash merges leave a branch's commits off `main`, so judge delivery by the PR's merged state, never by commit ancestry. Commits after the reviewed head are unfinished work.
2. Run `git status --short --ignored` in the worktree, and look inside the scratch folder. `git worktree remove` deletes ignored files, including the worktree's own `.local/`, `.env`, databases, test output, and `node_modules/`. Move anything the issue still needs into the PR, the issue, or the canonical repository's `.local/evidence/gh-<issue-number>-<slug>/`. The PR and issue are public, so private material goes only to `.local/evidence/`. Confirm the other ignored files are disposable.
3. In every case, clean up the canonical repository's `.local/scratch/gh-<issue-number>-<slug>/` folder: remove each worktree registered inside it with ordinary `git worktree remove`, confirm that `git worktree list` shows none there, then delete the folder. Step 1's `HEAD` check applies only to the delivery worktree.
4. For a delivery worktree created with `git worktree add`, run `git worktree remove <path>` from the canonical repository and confirm with `git worktree list` that the path is gone. Do not delete the delivery branch yourself.
5. Leave a tool-managed worktree, such as a Claude Code session worktree under `.claude/worktrees/`, to that tool's own exit flow instead of `git worktree remove`; that flow may also delete its branch. Once steps 1 and 2 pass on a clean worktree, accepting the tool's option to discard the squash-merged commits is allowed. If this session cannot run that flow, keep the worktree and report it as ready to remove.

Keep the worktree and scratch, and report the path and reason, when a worktree
is dirty or locked, another process or session uses it, the delivery worktree's
`HEAD` differs from the reviewed head, evidence is not yet preserved, an ignored
file is not confirmed disposable, or `git worktree remove` refuses. Without the
user's explicit approval, never force removal or reset, clean, or discard files
to make a worktree removable. If main CI fails, or the work failed or was
abandoned, ask the user whether to keep or remove it and keep it until they
decide. Leave other tasks' worktrees, branches, and scratch alone.

## Completion evidence

Report source revision, local checks, hosted CI, installation, and physical checks
separately. Record blockers and next actions. Simulator-only completion must be
labeled software complete with hardware verification pending when appropriate.

Exercise routing and delivery boundaries in isolated fixtures: read-only planning,
automatic implementation routing, narrower local-only scope, stale review,
missing CI, unresolved findings, unfinished archives, and unavailable independent
review. Observe responses/actions; static schema validation alone does not prove
agent routing. Fixture results do not prove real GitHub writes or host skill discovery.

## Cross-project work guide

The [hub work guide](https://github.com/jimmie-potts/agent-device-hub/blob/main/docs/work-guide/README.md)
is a dated view of cross-project work, history and architecture. GitHub issues
remain authoritative for scope and status. Ordinary planning and delivery do not
require a guide refresh, hub PR or no-impact record and can finish without a
newer guide revision.

When a task intentionally updates or publishes the guide, follow the hub's
maintenance procedure. Only that authorized scope requires a linked hub PR;
the procedure allows reuse of a reviewed guide revision for publication when
output is unchanged. The coordinator links the relevant PRs and records the
represented source revision and guide validation. Report source completion,
guide revision, public publication and live verification separately, with
evidence or a pending owner and next action. A source merge does not update the
public site.

Read-only tasks do not authorize writes, and tracker-only requests change only
the tracker. Guide maintenance does not authorize installation, device operation
or hosting. Preserve source, installation, client and physical evidence as
separate claims.
