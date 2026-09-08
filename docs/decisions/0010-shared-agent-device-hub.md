# ADR 0010: Adopt shared agent status and controller contracts

Status: Accepted direction; implementation pending. Scope: issue #36.

Adopt the hub's canonical architecture through [the integration guide](../hub-integration.md).
Keep Pixoo's media/player/rendering and physical writer here. Move shared
qualification, state interpretation, contracts and MCP infrastructure ownership
to agent-device-hub; existing monitoring/MCP issues now own consumer integration.

Initially embed the reusable core in the existing backend. Standalone hosting
is a later one-owner migration, with private databases, preserved source/session
identity and explicit rollback. Preserve legacy Nanoleaf behavior until verified
cutover; no personal installation changes are part of this decision.

The current user request supersedes the earlier independent-collector planning
constraint. This changes future ownership/dependencies, not delivered runtime
behavior, simulator defaults or physical acceptance. No product spec delta
applies to this documentation/backlog update.

## Contract adoption

Issue #29 adopts the released Hub lifecycle schema and fixtures through the
[vocabulary mapping](../agent-monitoring-vocabulary.md) and
[consumer requirements](../agent-monitoring.md). Shared code remains in Hub
packages. This source adoption changes no installed collector or running state
owner. The embedded host and remote session-source boundary remain issue #31.
