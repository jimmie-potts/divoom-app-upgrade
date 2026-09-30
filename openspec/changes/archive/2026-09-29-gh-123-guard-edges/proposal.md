## Why

[Issue #123](https://github.com/jimmie-potts/divoom-app-upgrade/issues/123) closes three edges that the final reviews of [PR #121](https://github.com/jimmie-potts/divoom-app-upgrade/pull/121) left in the verification transport guard. Code can overwrite `process.execPath`, and a fork that falls back to it then starts another program unguarded. An empty or null `execPath` is refused, although Node reads it as `process.execPath`. A `data:` URL worker's record stores its URL-encoded source in the private transport log. The served app reaches none of these today.

## What Changes

- A fork is allowed only when the program Node would run, `execPath` or `process.execPath` when `execPath` is falsy, resolves to the Node binary that loaded the guard. That checked path is passed to Node.
- A worker started from a URL other than `file:`, such as a `data:` URL, is recorded by scheme only, never by its URL or source.
- The requirement names `data:` URL workers, which already run under the guard, and states how records name forks and workers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulator-verification`: the guarded code execution requirement defines the fork's program as Node reads it and forbids worker source in records.

## Impact

Only `scripts/verify/transport-guard.ts`, its boundary tests and the verification guide change. Forks of Node through a symlink, file-based workers and name-only refusal records keep their behavior. Hostile in-process code (side-effecting `toString`, internal bindings, native addons) stays out of scope, as #121 documented. Installed services, device behavior and public APIs are unaffected.
