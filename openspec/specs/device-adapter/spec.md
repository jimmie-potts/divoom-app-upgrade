# Device adapter Specification

## Purpose

Provide a deterministic device boundary for simulator-backed rendering and playback development while keeping physical display evidence separate.

## Requirements

### Requirement: Typed simulator operations and timing
The adapter SHALL expose probe, animation upload, brightness and screen operations with typed success/failure results. Results SHALL carry generation, submission/start/completion times and separate queue/service durations from an injectable monotonic clock. Upload success SHALL report an estimated ready time, never a hardware playback event. This covers issue #3 criterion 1.

#### Scenario: Simulator readiness
- **WHEN** a fake probe succeeds
- **THEN** its result identifies simulator availability and no physical connection

#### Scenario: Loading estimate
- **WHEN** an upload completes after artificial latency
- **THEN** its timing separates queue wait and upload time, and its ready estimate includes the configured additional ready delay without claiming visible playback

### Requirement: Complete immutable RGB transactions
The adapter SHALL accept nonempty animations of complete 64 by 64 frames, each containing 12288 row-major RGB bytes and a positive finite integer effective delay in milliseconds. It SHALL reject invalid frames and controls before recording effects, preserve all frames/delays, and snapshot accepted input before asynchronous work. Brightness SHALL be an integer from 0 through 100; screen state SHALL be boolean. Records returned for inspection SHALL not permit mutation of adapter-owned state. Diagnostic frame and operation history SHALL be enabled by default. A runtime SHALL be able to explicitly disable history, leaving inspection records empty while preserving accepted frames, operation results, FIFO ordering, timing and cancellation. This covers criteria 1 and 3; the runtime option also supports issue #8 bounded simulator startup. These are application contracts, not firmware limits.

#### Scenario: Synthetic frame fidelity
- **WHEN** a synthetic multiframe RGB animation is uploaded with default diagnostic recording and caller input is subsequently modified
- **THEN** recorded frames retain every originally submitted byte in row-major RGB order and the original effective delays

#### Scenario: Invalid input
- **WHEN** a frame is short, an animation is empty, a delay is invalid, or a control is outside its accepted domain
- **THEN** the result is invalid-input and there are no command effects

#### Scenario: Long-lived simulator without history
- **WHEN** the runtime explicitly disables diagnostic recording and submits repeated uploads
- **THEN** frame and operation inspection histories remain empty without changing upload results or writer behavior

### Requirement: One serialized operation writer
One adapter instance SHALL execute submitted operations in FIFO order with each upload occupying the writer for all its frames. Probe and controls SHALL wait behind the active upload. Successful, failed and interrupted operations SHALL release the writer. This covers criteria 2 and 3.

#### Scenario: Concurrent animations and controls
- **WHEN** two animations and a brightness command are submitted concurrently
- **THEN** all frames from the first animation precede the second animation, and the brightness command follows both without interleaving

#### Scenario: Failure recovery
- **WHEN** an injected upload failure interrupts one transaction with diagnostic recording enabled
- **THEN** its result distinguishes upload-failed from offline, retains already recorded frames, and allows the next valid operation to proceed without automatic retries

### Requirement: Cancellation and generation boundaries
Each operation SHALL carry the current generation and a positive finite timeout. The timeout SHALL cover queue wait and execution. Abort cancellation, deadline expiry, and generation invalidation SHALL settle both queued and active work, prevent remaining fake effects, and distinguish cancelled, timeout and stale-generation results. Generation invalidation SHALL advance the generation and prevent old callbacks from succeeding. Results SHALL disclose possible prior effects after a partial upload; cancellation SHALL not claim to undo already applied device work. This covers criteria 1 and 2.

#### Scenario: Queued timeout or cancellation
- **WHEN** an operation expires or is cancelled while another upload owns the writer
- **THEN** it settles without waiting for that upload and records no effects

#### Scenario: Active interruption
- **WHEN** an upload with diagnostic recording enabled is cancelled, times out or becomes stale after one frame
- **THEN** it retains that frame as possible prior effects, records no later frames, and never returns success from an old callback

#### Scenario: New generation
- **WHEN** the generation advances during an active upload with queued old work
- **THEN** all old work settles as stale-generation and new-generation work can complete

#### Scenario: Offline recovery
- **WHEN** simulated connectivity is lost and later restored
- **THEN** operations fail with offline while unavailable, and explicitly submitted fresh work can succeed after recovery without replaying failed commands

### Requirement: Writer operation counts
The fake adapter SHALL count, per operation kind, the operations its writer admitted to its queue and those that completed successfully. The counts SHALL be kept when diagnostic history is disabled, SHALL NOT retain frames or records, and SHALL be returned as a copy. Invalid input and work refused before admission SHALL NOT count as admitted.

#### Scenario: Counts without history
- **WHEN** history is disabled and a brightness change succeeds, an invalid brightness is rejected, a queued brightness change is retired by a new generation and a probe succeeds
- **THEN** the counts report two admitted and one successful brightness operation and one admitted and successful probe, while frame and operation histories stay empty

### Requirement: Bounded hosted file operation
An explicitly selected hosted profile SHALL encode multi-frame effective RGB losslessly using one global palette, no local palettes or transparency, disposal 1, and every repeated frame. The existing FIFO SHALL own preparation, one Device/PlayTFGif command and bounded transfer wait. It SHALL use no retry or transport fallback after uncertain effects. Prepared bytes SHALL be exposed only under an expiring random capability on a separate file-only listener, with one active file, at most 10 MiB, a 15-second lifetime, ten requests and five file lengths of transfers. Cancellation, replacement and shutdown SHALL revoke access. Control authentication SHALL remain unchanged. Trace: issue #55 AC4–AC6.

#### Scenario: Complete transfer
- **WHEN** the device acknowledges file play and a complete GET response finishes within the operation deadline
- **THEN** the adapter returns estimated readiness at completion plus 1000 ms without claiming visible output
- **AND** the player bases duration and total-plays accounting on that estimate

#### Scenario: Missing fetch or cancelled transfer
- **WHEN** a hosted command has been submitted but transfer cannot complete before cancellation, stale generation or the deadline
- **THEN** the outcome reports possible effects and the player pauses without replay or fallback
- **AND** the URL is revoked while an already downloaded device loop may continue

#### Scenario: File-only listener
- **WHEN** a client requests a catalog route, unknown path, expired file or unsupported method on the file listener
- **THEN** no private media or control route is exposed
- **AND** only the exact current capability can serve prepared bytes through bounded GET or HEAD requests
