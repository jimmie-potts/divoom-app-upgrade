# ADR 0001: Development workflow

Status: Accepted. Date: September 5, 2026.

## Decision

The user approved a private GitHub repository named `jimmie-potts/divoom-app-upgrade`
and the Nanoleaf SDLC. GitHub issues own delivery criteria and status; OpenSpec
owns reviewed requirements; ADRs own lasting decisions; PRs own revision evidence.
Use isolated issue worktrees and normally one independently deliverable issue per PR.

Normal implementation includes independently reviewed source delivery through a
guarded squash merge and successful main CI. Planning and review are read-only.
Installation and physical-device tests require separate explicit authorization.
The bootstrap introduces workflow and backlog only, with zero capability specs.

Reuse central skills without vendoring or replacing existing installations. Pin
OpenSpec 1.12.0 locally and use Node 24/npm for tooling. Preserve personal CLI
settings through isolated OpenSpec invocation. Apply TDD proportionately to
meaningful executable behavior and use independent Standards/Specification reviews.

## Consequences

GitHub returned a plan-related 403 for branch protection on this private repository
on September 5, 2026. The delivery checks are procedural, not server-enforced.
Preserve privacy and account settings; honor protections if they become available.
No Project board, background status service, or auto-merge service is introduced.

Central skill installation is a developer prerequisite. If the host mounts skill
directories read-only, report the blocker and keep setup open until installation
is verified. Source files and CI can still be completed and reviewed.

The initial commit only establishes a main branch for the setup PR. Subsequent
changes use the [SDLC](../sdlc.md), including the remainder of bootstrap.
