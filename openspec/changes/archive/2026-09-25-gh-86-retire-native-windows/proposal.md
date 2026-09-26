## Why

[Issue #86](https://github.com/jimmie-potts/divoom-app-upgrade/issues/86): the Windows application CI job times out now and then at Vitest's 5000 ms default. Reruns pass, Ubuntu passes, and each failure blocks merges or turns main red. The app runs in WSL: the owner chose WSL as the primary workflow and the installed backend is a systemd user service there. Native Windows was only a documented fallback for when a Windows browser cannot reach WSL loopback. On 2026-09-25 the owner chose to retire native Windows as a supported runtime and drop the Windows CI jobs instead of tuning timeouts.

## What Changes

- **BREAKING (owner decision on #86):** native Windows is no longer a documented or supported way to run the backend. Linux/WSL is the only supported host.
- Remove `windows-latest` from the Workflow and Application CI jobs. CI keeps three Ubuntu jobs.
- Remove native Windows runtime instructions from README and docs. Keep the checks for reaching the WSL backend from a Windows browser or client.
- Leave existing `win32` code branches in place, unsupported and unverified.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-operations`: documentation describes Windows-to-WSL reachability checks without a native Windows alternative.

## Impact

`.github/workflows/ci.yml`, README, local operations, device application, local MCP, development, SDLC and agent monitoring documents, the issue templates and a new ADR 0021. No application code, test, dependency, schema, API or persisted-format change. Agent-client routes from Windows to the WSL backend (`local-mcp-controls`, `monitor-setup-integration`) are unchanged.
