## MODIFIED Requirements

### Requirement: Guarded code execution
A fork of Node and every worker thread started from a file or `data:` URL module SHALL run under the same guard, even when the caller replaces `execArgv` or `env`, with fork options honored as Node reads them. A fork's program SHALL be the one Node would run, its `execPath` or, when that is empty or absent, `process.execPath`, and SHALL resolve to the Node binary that loaded the guard; a later change to `process.execPath` SHALL NOT change which program is allowed. Every other public process start SHALL be refused and recorded, including a fork of another program and an eval worker. Records SHALL name a program or a file module by its base name, and any other worker module only by its URL scheme, never by its URL or source. The launch SHALL empty `NODE_OPTIONS`. The guard is not a sandbox against hostile code already in the process (side-effecting `toString`, internal bindings, native addons).

#### Scenario: Forked children and workers
- **WHEN** a guarded process forks a child with replaced arguments and environment, as the media worker does, or with an undefined argument list before its options, or starts a worker with an empty `execArgv`
- **THEN** each child or worker keeps its options, its connection is refused and recorded, and an upload still renders in the guarded media worker

#### Scenario: Node read as Node reads it
- **WHEN** a guarded process forks with an empty or null `execPath`, forks with a symlink to the Node binary as `execPath`, or starts a worker from a `data:` URL
- **THEN** each child or worker runs under the guard, its connection is refused and recorded, and the worker's record names only its `data` scheme, never its source

#### Scenario: Other process starts
- **WHEN** a guarded process calls each other public way to start or replace a process, forks another program as `execPath`, overwrites `process.execPath` with another program and then forks, or starts an eval worker
- **THEN** every call is refused and recorded without the eval source, and nothing it would have started runs or reaches the network

#### Scenario: Inherited preload
- **WHEN** the caller's `NODE_OPTIONS` imports a module, for the server or for a forked child
- **THEN** that module never runs
