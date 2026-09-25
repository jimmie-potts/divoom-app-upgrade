## Why

[Issue #77](https://github.com/jimmie-potts/divoom-app-upgrade/issues/77) keeps the installed Pixoo app running across PC and WSL restarts with the settings the shared hub needs. Today the app runs as a manual foreground process. After a restart BUNNY reports the controller unavailable and agent status stops. The runbook also omits the controller flag, and startup never restores Monitor presentation, so someone has to send an explicit Monitor command every time.

## What Changes

- Add a systemd user-service template and a private environment example that start the built backend in device mode with monitoring, the controller flag and the controller identity. The service restarts on failure with a bounded start limit and stops with SIGTERM so the player drains.
- Document install, upgrade, rollback and removal of the service, and add the controller flag to the installed runbook.
- **BREAKING (owner decision on #77):** device-mode startup restores a saved Monitor selection through the existing serialized adapter. Simulator startup, Media mode and a retained screen-off request stay passive. A failed startup transmission suspends monitoring until explicit activation, with no automatic retry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-monitor-controls`: device startup restores a saved Monitor selection; restart in simulator mode and screen-on stay passive.
- `local-operations`: an optional documented user service for the installed backend; source delivery still installs nothing.

## Impact

`MonitorPresentation` gains a startup restore used only in device mode. Examples gain a service template and environment file. Local operations, agent monitoring, device application and playback documentation change, and ADR 0018 is amended. No dependency, schema, API or persisted-format change. Installing the service on the owner's host and the WSL-restart check are separately authorized. Screen-on and device-reboot recovery remain [#76](https://github.com/jimmie-potts/divoom-app-upgrade/issues/76).
