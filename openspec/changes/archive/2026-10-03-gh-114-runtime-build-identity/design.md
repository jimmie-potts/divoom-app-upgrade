## Context

See proposal.md for the outcome. Build metadata crosses the core schemas, server
startup and browser controller, so a short design records that shared boundary.
Health currently reports readiness and connectivity; diagnostics has a strict
schema. The browser already refreshes health with a server-ID consistency check.

## Goals / Non-Goals

Freeze one build identity for each application instance and display that exact
value. Do not introduce polling, runtime Git access, deployment, credentials,
device probes or changes to application-state revisions.

## Decisions

- Wrap the existing build commands with source checks before and after the build.
  Stamp output only with the same clean full SHA at both boundaries; otherwise
  write `unknown`. Verify the repository root to avoid borrowing an enclosing
  checkout's revision for an unpacked archive. Do not accept a revision from the
  environment. The updater can build its exact clean checkout before packaging.
  Invalidate prior metadata before compiler-only/typecheck output changes and on
  a failed build; stale compiled output must not retain qualified identity.
- Keep a small generated metadata file beside the compiled server. The server
  reads that file once when constructing the application, validates its shape,
  and freezes a copy. A missing or malformed file yields unknown provenance.
  Reading current Git or metadata on each request could mislabel an old process.
- Add the common build shape to existing core schemas. Keep package version
  `0.0.0` informational. Pass the same identity to health and diagnostics.
- Retain build in the existing browser runtime snapshot, refreshed with its
  server-ID check. Settings offers a short revision, selectable full text and a
  copy button with visible success/failure. No device request is added.

## Risks / Trade-offs

- Unqualified development builds report unknown even when compiled successfully.
  This prevents an updater from accepting their source identity.
- Metadata is build provenance, not an authenticity mechanism. The updater must
  still verify its exact archive and dependency closure under the install contract.
- Clipboard access can fail. Keep selectable full text and report the failure.

## Migration Plan

No data migration. Existing installs keep their existing response until upgraded.
Source acceptance is separate from the installed readback owned by issue #115.
