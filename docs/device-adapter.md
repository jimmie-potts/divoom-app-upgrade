# Device adapter

`@pixoo/device` exports `DeviceAdapter` and `FakeDeviceAdapter`. The fake is an
in-memory test component. It performs no network requests and is not connected to
the browser's controls. The status page still reports no physical display.

```ts
import { FakeDeviceAdapter } from '@pixoo/device';

const device = new FakeDeviceAdapter({ latencyMs: 5, readyDelayMs: 10 });
const result = await device.probe({ generation: device.generation });
if (result.ok) console.log(result.value); // simulator available, connected: false

const cancelledGeneration = device.generation;
device.invalidateGeneration();
const stale = await device.setScreen(false, { generation: cancelledGeneration });
// stale.ok is false; stale.code is 'stale-generation'.
```

## Operations and ownership

The four operations are `probe`, `uploadAnimation`, `setBrightness` and
`setScreen`. Each takes a generation, optional AbortSignal and optional timeout.
Keep one adapter instance per configured device in the future backend. That
instance owns the FIFO writer. Uploads occupy it for the entire frame sequence;
probes, brightness and screen commands cannot interrupt a transaction.

`invalidateGeneration()` increments the generation and settles old active and
queued work as stale. Callers must submit the new generation explicitly. Abort
or timeout affects one request. Invalidation provides the future player a way
to retire old work; it does not implement stop, skip, pause or recovery policy.
Screen-off here is only an adapter command. The future player must also pause
orchestration according to the playback requirements.

An animation contains a nonempty `frames` array. Each frame has `rgb`, a
Uint8Array of 12288 bytes, and a positive safe-integer `delayMs`. Pixels are
64 by 64, row-major, with R, G and B bytes in that order. Input is copied at
submission, including every frame and effective delay. No truncation,
resampling, base64 or protocol encoding occurs. Brightness accepts integer
percentages 0-100 and screen accepts a boolean. These are application inputs;
firmware mapping and capability limits still require the hardware spike.

## Timing and results

A result is either `{ ok: true, value, generation, timing }` or
`{ ok: false, code, priorEffects, generation, timing }`. Control success has an
undefined value. Failure codes distinguish invalid-input, offline, upload-failed,
cancelled, timeout and stale-generation. There are no automatic retries.

Times are monotonic milliseconds in the injected clock's domain. They are not
wall-clock dates and cannot be compared across process restarts. `timing`
contains submission, nullable start, completion, queue wait and service duration.
An operation cancelled before writer entry has null start and zero service time.
The default 5000ms timeout covers queue wait as well as execution. At a shared
effect/deadline timestamp, the deadline wins.

Upload success adds `estimatedReadyAtMs`, completion time plus the configured
ready delay. This estimate is separate from service duration, does not hold the
writer, and is never a claim that content became visible. No playback event or
finite-play guarantee is fabricated.

## Deterministic tests and faults

Inject `Clock` with monotonic `now()` and `schedule(delayMs, callback)`, returning
an idempotent cancellation function. Callbacks must be asynchronous, even at
zero delay. The default clock uses performance.now and native timers; long
intervals are split to avoid native timer overflow. Tests use a manual clock.

`latencyMs` is the artificial delay per frame or non-upload operation, default
zero. `readyDelayMs` defaults to zero. Both must be finite and nonnegative.
These are simulator settings, not observed device timings.

`setOnline(false)` makes subsequent operation steps fail with offline; set it
true and explicitly submit fresh work to recover. `failNextUpload(index)` marks
the zero-based frame where the next valid animation submission fails before
recording that frame. It defaults to index zero, follows that submission into
the queue, and is consumed once. If the animation never reaches the index, the
fault never fires. Another call replaces the pending fault. Invalid injection
parameters throw as test setup errors.

`effects` returns completed frame, brightness and screen effects with operation
ID, generation and time. `operations` returns completed operation summaries in
completion order, which can differ from submission order when queued work is
cancelled. Both return defensive copies. A failed operation reports possible
prior effects when it already recorded a frame; it never claims to undo them.
Cancelled timers cannot add later effects or change a settled result.

History is in memory for the lifetime of a fake instance. Create a new instance
for each test/session rather than using it as a persistent event store. The
synthetic fixtures in tests/helpers/rgb-fixtures.ts encode row, column and frame
identity without external artwork.

Physical transport, response parsing, device timing and display acceptance remain
unverified under issue #4. The fake tests establish software behavior only.
