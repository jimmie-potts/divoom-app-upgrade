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
GIF decoding is specified in [media-rendering](../openspec/specs/media-rendering/spec.md);
persistence is specified in [library-persistence](../openspec/specs/library-persistence/spec.md).
Local startup, backup/recovery and an optional Linux user service are supported;
see [local operations](local-operations.md). Source support does not establish a
current installation. Node 24 and OpenSpec 1.12.0 remain the tooling selections.

Start with 30 seconds per image, three total plays per GIF, repeat enabled,
shuffle disabled, fit with black padding, and nearest-neighbor scaling. Handoff
sections 5-8 define proposed contracts and evidence boundaries. In particular,
three plays means three total executions; playback timing is estimated from
rendered frame delays. Pause stops advancement, resume restarts the item, and
stop leaves the last content displayed. The [playback specification](../openspec/specs/playlist-playback/spec.md) now
defines controls, immutable snapshots, generation cancellation, shuffle history
and paused recovery for the backend library.

GitHub issues own delivery acceptance criteria and dependencies. Translate their
outcomes into observable OpenSpec scenarios as each feature becomes ready, linking
each scenario to its issue criterion. The handoff remains immutable historical
context; reviewed capability specs take precedence for delivered requirements.
Do not create a competing status table here. The [application-foundation spec](../openspec/specs/application-foundation/spec.md)
is authoritative for delivered startup, storage configuration and readiness. The
device-adapter spec is authoritative for the [fake operation boundary](../openspec/specs/device-adapter/spec.md).
The [device-http-spike spec](../openspec/specs/device-http-spike/spec.md) covers
opt-in transport experiments, with physical acceptance still separate. The
remaining handoff capabilities are proposed behavior, not implementation evidence.

The application serves the [controller UI](controller-ui.md) and health API. The media
package renders files, and the library package persists metadata and playlists.
The playback package orchestrates immutable sessions and paused recovery.
The [controller API](api.md) exposes media, playlist and player operations with
SSE. Startup defaults to simulator mode; explicit validated device activation
uses the dated smoke profile through the same player and writer. The responsive media library, editor, player and settings UI uses those routes. M1 separates simulator/adapter source work
from physical observation, allowing simulator-backed M2-M5 work when hardware is
unavailable. An incompatible or unacceptable hardware result requires a user
decision before further hardware integration. M6 requires physical evidence;
software completion never closes its hardware acceptance issue.

The [hardware evidence](hardware-validation.md) records a bounded Pixoo64 smoke
test with unknown firmware and early loading screens. Broader limits, precise
play counts and phone access remain unverified.
The handoff's follow-on areas now belong to their current GitHub issues.
Scheduling, routines and timezone policy belong to
[Hub #45](https://github.com/jimmie-potts/agent-device-hub/issues/45);
[Pixoo #13](https://github.com/jimmie-potts/divoom-app-upgrade/issues/13) retains
the Media-mode command precondition and show-one-rendition extension, with
rendition discovery owned by
[Pixoo #96](https://github.com/jimmie-potts/divoom-app-upgrade/issues/96).


## Shared agent monitoring direction

The accepted [hub integration plan](hub-integration.md) uses shared provider
qualification, agent state and controller/MCP contracts from agent-device-hub.
Pixoo owns consumer integration, media/playback, its 64x64 renderer and one
device writer. The selected session source supports an embedded shared core or
a remote owner; switching owners requires an explicit ownership migration.
Pixoo adopts the [released lifecycle contract](agent-monitoring-vocabulary.md)
and [consumer requirements](agent-monitoring.md). The opt-in monitor runtime and
browser panel provide explicit Monitor/Media selection, owner-backed labels/notices
and one selected view for preview/display.

Startup defaults to simulator mode, where enabling monitoring does not activate
presentation. In explicit device mode, startup restores a saved Monitor selection
when the screen is requested on
([#77](https://github.com/jimmie-potts/divoom-app-upgrade/issues/77)). Screen-on
alone does not resume playback or monitoring. Installation and physical acceptance
remain separate; see the [dated evidence](hardware-validation.md#issue-77-user-service-installation).
