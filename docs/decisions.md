# Decisions

- [ADR 0001: Development workflow](decisions/0001-development-workflow.md) records the accepted repository setup.

- [ADR 0002: Local simulator foundation](decisions/0002-application-foundation.md) records package boundaries, startup and configuration.

- [ADR 0003: Serialized simulator adapter](decisions/0003-device-adapter.md) records writer ownership, cancellation and timing estimates.

- [ADR 0004: Opt-in HTTP protocol experiments](decisions/0004-http-protocol-spike.md) records the source/physical acceptance boundary.

Future issues must record timing estimation, renderer/profile limits, dependency
licensing, and LAN security choices here through linked ADRs. Those application
decisions have not been finalized by the repository bootstrap.

- [ADR 0005: Bounded media rendering and immutable outputs](decisions/0005-media-rendering.md)

- [ADR 0006: SQLite catalog and reference-safe media lifecycle](decisions/0006-library-persistence.md)

- [ADR 0007: Deterministic playback and durable paused recovery](decisions/0007-playback.md)

- [ADR 0008: Local controller API and replay identity](decisions/0008-controller-api.md)

- [ADR 0009: Browser state and command recovery](decisions/0009-controller-ui.md) records draft ownership, reconnect and command identity handling.

- [ADR 0010: Shared agent-device-hub adoption](decisions/0010-shared-agent-device-hub.md)

- [0011: Offline local recovery](decisions/0011-offline-local-recovery.md) records consistent backup and fresh-directory restore.

- [ADR 0012: Opt-in physical application adapter](decisions/0012-physical-application-adapter.md) records immutable startup configuration, smoke limits and uncertainty pause.

- [ADR 0016: One selected shared monitor owner](decisions/0016-shared-monitor-host.md) records durable hosting, source selection and migration.

- [ADR 0013: Shared controller API](decisions/0013-hub-controller-api.md) records native admission and feed ownership.

- [ADR 0015: Dashboard transport and cadence](decisions/0015-dashboard-qualification.md) selects complete RGB frames and a configurable 1000 ms interval for downstream integration, with bounded physical evidence and recovery limits.

- [ADR 0018: Monitor and Media share the existing writer](decisions/0018-monitor-display-ownership.md) records explicit activation, selected view, finite commands and recovery, amended by #77 to restore a saved Monitor selection at device startup.
