# ADR 0021: Linux and WSL are the only supported hosts

Status: Accepted for [issue #86](https://github.com/jimmie-potts/divoom-app-upgrade/issues/86).
The owner chose this on 2026-09-25.

## Decision

The backend and its development tooling run on Linux or WSL. Native Windows is
no longer a documented runtime alternative, and CI no longer runs on
`windows-latest`. CI keeps Workflow checks, Application checks and Simulator
browser checks on Ubuntu.

Windows stays in scope as a client of the WSL backend: a Windows browser, Codex
or Claude reaching WSL loopback. The reachability checks in
[local operations](../local-operations.md#windows-and-wsl-reachability) and the
client routes in [agent monitoring](../agent-monitoring.md) and
[local MCP](../local-mcp.md) are unchanged.

Existing `win32` code branches stay. They are small and have no current
maintenance cost, but they are unsupported and no CI host exercises them.

## Context

Issue #10 documented native Windows as a fallback in case Windows could not
reach WSL loopback. The owner has since chosen WSL as the primary workflow
([hardware validation](../hardware-validation.md)) and runs the installed
backend as a WSL user service. Meanwhile the Windows Application job timed out
at Vitest's 5000 ms default in at least eight runs between 2026-09-10 and
2026-09-25, each passing on Ubuntu and usually on rerun. Issue #86 records them.

## Alternatives

- **Raise Vitest timeouts** (the original #86 plan). Rejected by the owner: it
  keeps paying CI time and flake risk for a host nobody runs.
- **Drop only the Windows jobs and keep the native Windows docs.** Rejected: it
  would document a runtime that nothing verifies.

## Consequences

Windows-specific path, lock and process regressions will not be detected.
Revisit when a Windows host that cannot run WSL needs the backend, or a second
native host is required.
