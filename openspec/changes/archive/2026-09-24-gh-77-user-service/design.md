## Context

The baseline is 0ca009c. `registerMonitor` loads `agent-monitor/presentation.json` and builds `MonitorPresentation`, which activates only through an explicit mode command (`configure`). Activation pauses Player, captures its generation and sets `active`; `tick()` then submits the newest rendition through `Player.uploadDashboard` and the adapter's queue. A failed upload calls `suspend()` and nothing retries. `main.ts` already closes the app on SIGINT/SIGTERM, which drains Player and in-flight transport, closes the catalog and releases the device lock.

The owner already runs `codex-nanoleaf-monitor.service` as a systemd user unit on the same WSL host (`Restart=on-failure`, `WantedBy=default.target`, `UMask=0077`, linger off).

## Goals / Non-Goals

**Goals:** a supported user-service setup with hub settings; device startup that restores a saved Monitor selection through the existing writer; verified graceful stop.

**Non-Goals:** Windows-side autostart after a full Windows reboot (revisit when the owner wants the service up without opening a terminal), screen-on or device-reboot recovery (#76), cloud isolation (#83), native Windows service, installer scripts, installing the service on the owner's host.

## Decisions

- **Restore reuses activation, not a command.** `MonitorPresentation.restore()` runs on the presentation queue: when the loaded mode is Monitor it suspends, pauses Player, captures the generation and activates only if that generation is unchanged and the screen is requested on. It does not save, because the configuration was just read. The command ledger and configuration revision are untouched, so no client request identity is invented. `registerMonitor` awaits it before the listener opens, and only when `ControlService.mode` is `device`. Uploads then follow the ordinary `tick()` cadence and generation guards.
- **Failure handling is unchanged.** The first startup upload is an ordinary transmission. Failure or uncertainty suspends participation and records `lastOutcome`; there is no retry. Recovery is an explicit Show monitor or mode command.
- **Screen-off stays off.** Restore requires `requestedScreenOn`. Player persists that value with saved playback context. Without a saved session the requested screen state is not retained across restart; that is existing Player behavior and belongs with screen-on recovery in #76.
- **Service runs node directly.** `ExecStart` names an absolute Node 24 and the installed checkout's `apps/server/dist/main.js`, so SIGTERM reaches the backend without npm in between. Settings live in a private `EnvironmentFile` (`%h/.config/pixoo-playlist-controller/service.env`, mode 0600). `Restart=on-failure`, `RestartSec=10`, `StartLimitIntervalSec=120` and `StartLimitBurst=3` bound restart loops, such as a `busy` owner conflict or a configuration error. `TimeoutStopSec=30` exceeds the 5-second transport deadline, so drain completes before SIGKILL. `UMask=0077` matches the Nanoleaf unit.
- **Startup timing.** Linger stays an installation choice. Without linger the user manager starts with the first WSL session, as Nanoleaf does today; `loginctl enable-linger` starts it with the distribution. That is a host setting for the separately authorized installation.

## Risks / Trade-offs

- A crash restart in device mode repeats the startup restore. It sends the newest complete picture, not a replay, and the start limit bounds repetition. The owner chose restored presentation over passive restart.
- Network not ready at the first upload suspends monitoring. The operator recovers with Show monitor; #76 owns broader recovery.
- The template carries placeholders, so a copy without edits fails to start. The unit test checks that the example environment loads through `loadConfig`; `systemd-analyze --user verify` on a filled copy is recorded as local evidence.

## Migration Plan

No data migration. The installation step replaces the manual launcher with the service. Rollback is `systemctl --user disable --now` followed by the previous manual launcher on the same data directory.
