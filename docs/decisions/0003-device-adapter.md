# ADR 0003: Serialized simulator adapter

Status: Accepted. Date: September 5, 2026. Scope: issue #3.

The device package owns a four-operation adapter contract and an in-memory fake.
One instance owns a FIFO writer. A full animation occupies one transaction so
frames from separate animations and control commands cannot interleave. A future
backend must retain one instance per configured device; this source introduces
no process lock or physical worker.

Use complete copied RGB frames and effective delays as application inputs.
Keep firmware payload fields and hardware profiles out of the fake contract.
This lets later renderer and player tests run without assuming device behavior.

Use an injected monotonic clock and submission-relative deadlines. Queue wait
counts toward timeout; service time and estimated readiness remain separate.
An upload estimate is completion plus configured ready delay and does not emit
a playback event. The future player owns dwell scheduling and recovery.

Generation invalidation retires old active and queued work. Cancellation and
timeouts settle a single operation. All paths release the writer and retain
completed effects, with explicit possible-prior-effects results after partial
uploads. None of these results establish physical cancellation or reverse a
command that a real device might already have applied.

The fake has deterministic latency and offline/upload failure injection, no
retries and no persistent history. Independent per-frame promises were rejected
because controls could interleave uploads. Wall-clock timing was rejected
because clock changes would make elapsed-time tests and playback estimates
unreliable. There is no data migration or deployment; rollback removes the
unused library while preserving the foundation's health and UI behavior.
