## Context

See proposal.md for the three edges. The guard wraps `child_process.fork` and `worker_threads.Worker` through the public API. Node's `fork` runs `options.execPath || process.execPath`. A worker accepts an absolute or relative path, or a `URL` object with the `file:` or `data:` scheme, and the guard's `--import` preload runs before either module.

## Goals / Non-Goals

Close the executable fallback and the source leak without changing which forks and workers run. Defending against hostile in-process code, such as a `process.execPath` getter that changes between reads, stays out of scope as #121 documented.

## Decisions

- Resolve `realpath(process.execPath)` once, when the guard loads. That is the Node binary running the guard. A fork computes the program the way Node does, `options.execPath || process.execPath`, and is allowed only when its real path equals that captured binary. A symlink to Node still resolves to it. The alternative of always passing the captured path was rejected because it would silently replace a caller's symlinked `execPath`.
- Pass the checked path to Node as `execPath`, so the program checked is the program run. Without a hostile getter Node would read the same value, so this is a narrow guarantee rather than a tested behavior.
- Name a worker's module by base name when it has no URL scheme or has `file:`, and as `<scheme-url>`, for example `<data-url>`, otherwise. Recording only the scheme keeps any future URL form from leaking content.

## Risks / Trade-offs

- [A `data:` worker becomes less identifiable in the log] → the log still shows that a worker started, from which process and under the guard; source never belongs in a private runtime log.
- [A fork via a path that later stops resolving] → an unresolvable path is compared as given and refused unless it equals the captured Node path; refusal is the safe failure.

## Migration Plan

Source-only change delivered through review and CI. No installed state or run data changes. The transport log format keeps its fields; only the `module` value of non-file workers changes.
