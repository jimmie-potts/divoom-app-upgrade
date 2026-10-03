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

Draft stories with the recognized headings of the
[Work item template](../.github/ISSUE_TEMPLATE/feature.md). A small story may answer
them in a few sentences.

Use the [issue conventions](issue-conventions.md) for Epic, Work item and Bug
intake, native membership and portfolio views. Outcome and observable acceptance
are required. Implementation, preservation and deferral details are conditional
on the work; keep their recognized headings without inventing irrelevant prose.
No model choice or Execution recommendation is required to file an issue.

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

No project UI requires human approval. UI changes retain applicable automated,
browser and accessibility checks, independent Standards and Specification reviews,
and every configured CI job. Physical-device acceptance remains separate.

1. Complete implementation, docs, acceptance checks, and applicable OpenSpec artifacts/tasks. Obtain successful current CLI status and sync/archive instructions. Verify every affected capability; synchronize and archive on the delivery branch before final review. A failed lookup or incomplete artifact blocks archive. Run both workflow checks.
2. Commit the full candidate and open its PR with `Refs #<issue>`. Record base SHA, head SHA, merge-base, diff command, and clean worktree state. Keep revision-specific evidence in the PR.
3. Obtain independent read-only Standards and Specification reviews of that same comparison. Use fresh review agents and the code-review method with GitHub as scope owner. Give each the issue, relevant contracts, and its own rubric. Self-review is insufficient. Missing independent review leaves the issue blocked and PR open.
4. Fix P0-P2 defects. Obtain reviewer reassessment for disputed findings and renewed review after relevant candidate changes. Record P3 dispositions and follow-up issues where deferred. Read every page of GitHub reviews and review threads. Resolve threads after fixes or agreed disposition; do not dismiss outstanding change requests to enable merge.
5. Inspect CI at the candidate revision to enumerate all jobs. Current CI requires Workflow checks, Application checks and Simulator browser checks, all on ubuntu-latest. Require every configured job to succeed on the latest PR run associated with the current head and PR. Missing, pending, skipped, cancelled, or failed jobs block merge. Read all result pages. An empty required-check list proves nothing.
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

Apply this procedure to ordinary authorized delivery and explicit `deliver-work`.
Start after the merged revision's required push CI succeeds and the issue state
is read back. Any applicable CI exception must already be documented; cleanup
creates no exception. Record source/CI completion and cleanup outcomes separately.
Retention is a valid completed cleanup outcome and does not prevent otherwise
eligible source completion.

Account for each resource this delivery created: local branch, worktree, scratch,
standalone clone or review copy, staging directory or branch, and remote branch.
Discover clones, scratch and staging from task ownership records as well as the
Git worktree registry; they can be outside the registered paths. These records
establish what this task owns, not permission to remove other work. Existing
accumulated artifacts require a separately approved candidate list
([Hub #477](https://github.com/jimmie-potts/agent-device-hub/issues/477)).

1. Verify the merged PR and its exact reviewed head (`headRefOid`, the
   `--match-head-commit` value). The delivery worktree's `HEAD` and local branch
   tip must still equal that head, not the squash commit on `main`. Squash-merge
   delivery is established by the merged PR and exact head; commit ancestry and
   `git branch --merged` cannot establish it. A moved tip or commits after the
   reviewed head are unfinished or unknown work: retain the affected resources.
2. Establish ownership and release for each resource. No other session may use
   it, and no remaining acceptance, installation, publication or other consumer
   may need it. A lack of visible processes is not proof that a session released
   a worktree. Unknown ownership or release, active consumers, locks, dirty
   state, unavailable or unsuccessful required CI, or needed ignored files retain
   the affected resources, including scratch, clones and staging. An independent
   clone must also have no stashes or unpushed work that still needs preservation.
3. Inspect `git status --short --ignored` in each owned worktree and clone, and
   inspect scratch and staging contents, including registered worktrees inside
   them. Removing a directory deletes its ignored files too, including `.local/`,
   `.env`, databases, test output and `node_modules/`. Preserve needed evidence in
   the PR/issue when public, or in the canonical repository's surviving private
   `.local/evidence/gh-<issue-number>-<slug>/`. Confirm all remaining contents are
   disposable before removal. Keep private paths, configurations and runtime
   metadata in private evidence; public receipts use neutral task labels.
4. Recheck state, ownership, evidence preservation and consumers immediately
   before each removal. For an owned worktree created with `git worktree add`,
   use ordinary `git worktree remove <path>` from the canonical repository, then
   confirm its absence with `git worktree list --porcelain` and a path readback.
   A tool-managed worktree, such as a Claude Code session worktree, uses that
   tool's exit flow. After the same gates pass, accepting its option to discard
   squash-merged commits is allowed. If this session cannot run the flow, retain
   the worktree with the tool/session owner and the next exit action. Never
   substitute manual removal for its lifecycle.
5. Remove an eligible owned local delivery branch only after its worktree is
   gone. Immediately recheck the branch identity and tip against the merged PR's
   exact reviewed head. Run `git worktree list --porcelain` and confirm no
   registered worktree has that branch checked out; also establish that no
   session or remaining consumer uses it and that this delivery has exclusive
   ownership for the removal. Delete only the exact local ref using:

   ```bash
   git update-ref -d refs/heads/<branch> <verified-tip-sha>
   ```

   This expected-tip guard rejects a moved tip. It does not atomically prevent
   another session from checking out the branch between the worktree check and
   deletion, and it bypasses `git branch -d`'s checked-out-branch protection.
   Retain the branch when exclusive ownership cannot be established. Never use
   `git branch -D` or a broad forced branch sweep. After successful deletion,
   remove only that branch's configuration section if present:

   ```bash
   git config --remove-section branch.<branch>
   ```

   Read back both absences with `git show-ref --verify --quiet refs/heads/<branch>`
   (exit 1 for an absent ref) and
   `git config --get-regexp '^branch\.<escaped-branch>\.'` (exit 1 for no matching
   configuration); escape regex metacharacters in the branch name. A command
   error or remaining configuration is an incomplete cleanup result, not proof
   of absence. If the tool exit flow removed the branch, verify the same ref and
   configuration absences before reporting removal.
6. Remove owned scratch, independent temporary clones, review copies and staging
   only after their ownership, state, evidence and consumer gates pass. For the
   canonical `.local/scratch/gh-<issue-number>-<slug>/`, remove each eligible
   registered worktree inside it through its designated lifecycle first, then
   confirm the registry has none there before removing the directory. The exact
   reviewed-head check applies to delivery branches/worktrees; disposable fixture
   repositories instead require known task ownership and disposable contents.
   If a nested resource is retained, retain its containing directory. Verify each
   directory's absence after removal. Never delete an unregistered clone merely
   because it is absent from `git worktree list`.
7. Read back remote state separately. A host-deleted remote branch is removed
   only with a current absence readback. If it remains, record retention; do not
   infer local cleanup from remote absence. GitHub automatic deletion and the old
   remote backlog belong to
   [Hub #309](https://github.com/jimmie-potts/agent-device-hub/issues/309). Enabling
   deletion or pruning old remote branches requires its own authorization and is
   not a prerequisite for eligible local removal.
8. Record a concise separate outcome for **branch, worktree, scratch, clone,
   staging and remote** in the existing PR, issue or delivery evidence:
   - **Removed:** successful removal with current ref/configuration, registry or
     path readback as applicable; name the host when it performed the removal.
   - **Retained:** concrete reason, owner or **unknown ownership**, and next action.
     A partially removed resource records what is absent and what remains.
   - **Not applicable:** this delivery created no resource of that kind.

Any refusal or changed state stops removal of the affected resource and retains
what remains, with reason, owner or unknown ownership, and next action. Never
force worktree removal, reset, clean or discard files to make cleanup pass.
Preserve other tasks' branches, worktrees, deployments and scratch. Failed or
abandoned deliveries keep their resources pending the owner's keep/remove
choice; ask and retain them until that decision. Retention does not claim removal.

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
