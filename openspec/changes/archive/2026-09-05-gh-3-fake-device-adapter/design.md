## Context

See proposal.md for motivation. The device package currently exports only a disconnected descriptor used by the health route. There is no existing adapter contract or persistent state to migrate. Design is required because this change introduces queue ownership, timing and cancellation boundaries.

## Goals / Non-Goals

**Goals:** Make operation ordering, failures and elapsed time directly inspectable through a fake that implements the future transport boundary.

**Non-Goals:** Firmware encoding, channel parsing, resets, physical start telemetry, playback timers, cross-process device locking, persistent records and HTTP control routes.

## Decisions

- Keep the four operations in a transport-neutral DeviceAdapter interface. Add a read-only generation and an invalidation operation so the future controller can retire all old work atomically. Use a monotonically increasing safe integer, not caller-provided arbitrary generation changes. A controller can retain its session ID separately.
- One FakeDeviceAdapter instance owns one FIFO writer. Every upload holds it through all frames. Each operation has one result and timing record; frame/control effects carry the operation ID. This is simpler to inspect than independent promises for each frame. The future backend must own a single instance per configured device.
- Use complete Uint8Array RGB frames and positive integer effective delays. Copy inputs at submission and records at inspection. No base64, HTTP payload, animation ID or device limits enter this internal contract. Brightness 0-100 is the application domain, to be mapped by a verified transport later.
- Inject a clock with now() and cancellable scheduled callbacks. The default uses performance.now() and setTimeout; tests provide a manual clock. Timeouts run from submission, so backlog time counts. At an equal deadline, timeout wins. This bounds individual requests without making a long queue hide expiry.
- Record queued, started and completed times, with null start for never-started requests. Compute wait and service durations separately. Successful upload returns completed time plus configured ready delay as an estimate. The ready delay does not occupy the writer or imply a playback event.
- The fake exposes online/offline injection and a one-shot upload failure at a frame index. Fixed per-step latency is configurable. It records only completed effects; failures/cancellation retain partial effects and return possible prior effects. Stop/skip policy and retries belong to playback, not the adapter.
- Cancellation, timeout and generation invalidation remove queued work and cancel active callbacks before releasing the writer. Generation checks at writer entry and each effect prevent stale work from completing, even when invalidation releases the queue synchronously. No attempt is made to reverse a completed frame.
- Invalid operation data returns invalid-input without effects. Invalid fake construction/fault-injection parameters throw synchronously as test setup errors. Defaults are zero artificial latency/ready delay and a 5000ms per-operation timeout. These are simulator settings, not hardware observations.

## Risks / Trade-offs

- Copying animation bytes costs memory. Keep this fake in-memory and feed bounded synthetic fixtures; renderer budgets and production backpressure belong to later issues.
- A fake cannot establish physical cancellation or timing. Return possible prior effects and keep hardware acceptance open under #4.
- Instance serialization does not enforce a host lock. The later backend must own the sole device writer; this change introduces no live device worker.

## Migration Plan

Export the new API beside the existing disconnected descriptor. Existing health/UI imports remain compatible. There is no persisted state, schema migration or deployment. Reverting source removes the unused adapter without changing startup behavior.
