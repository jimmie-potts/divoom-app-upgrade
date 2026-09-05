# Product direction

The [September 5 handoff](reference/2026-09-05-agent-handoff.md) is the preserved
planning reference. Its kickoff paragraph is historical task text, not an
instruction to start application implementation during repository setup. The
user separately authorized GitHub publication and the delivery workflow recorded
in [ADR 0001](decisions/0001-development-workflow.md).

Accept the handoff's MVP direction: one local backend, responsive browser UI,
explicitly configured Pixoo, original media preservation, and simulator support.
Use TypeScript, React/Vite, Fastify, SQLite, sharp plus a tested GIF decoder,
framework-independent playback, SSE, Vitest, and Playwright as the stack direction.
Foundation versions and licenses are recorded in [dependencies](dependencies.md).
GIF decoding, persistence and deployment remain future issue decisions. Node 24
and OpenSpec 1.12.0 remain the tooling selections.

Start with 30 seconds per image, three total plays per GIF, repeat enabled,
shuffle disabled, fit with black padding, and nearest-neighbor scaling. Handoff
sections 5-8 define proposed contracts and evidence boundaries. In particular,
three plays means three total executions; playback timing is estimated from
rendered frame delays. Pause stops advancement, resume restarts the item, and
stop leaves the last content displayed. The full controls, immutable playback
snapshot, generation cancellation, shuffle history, and recovery semantics remain
in section 6 and must be carried into issue-linked specs before implementation.

GitHub issues own delivery acceptance criteria and dependencies. Translate their
outcomes into observable OpenSpec scenarios as each feature becomes ready, linking
each scenario to its issue criterion. The handoff remains immutable historical
context; reviewed capability specs take precedence for delivered requirements.
Do not create a competing status table here. The [application-foundation spec](../openspec/specs/application-foundation/spec.md)
is authoritative for delivered startup, storage configuration and readiness. The
remaining handoff capabilities are proposed behavior, not implementation evidence.

The M0 foundation serves a simulator status page and health API; it does not
implement media or playback. M1 separates simulator/adapter source work
from physical observation, allowing simulator-backed M2-M5 work when hardware is
unavailable. An incompatible or unacceptable hardware result requires a user
decision before further hardware integration. M6 requires physical evidence;
software completion never closes its hardware acceptance issue.

No firmware behavior, model variant, frame limit, loading delay, precise play
count, actual phone access, or hardware compatibility has been verified here.
[Hardware evidence](hardware-validation.md) will record dated observations.
The handoff's six follow-on areas remain deferred GitHub issues.
