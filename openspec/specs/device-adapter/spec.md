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
The adapter SHALL accept nonempty animations of complete 64 by 64 frames, each containing 12288 row-major RGB bytes and a positive finite integer effective delay in milliseconds. It SHALL reject invalid frames and controls before recording effects, preserve all frames/delays, and snapshot accepted input before asynchronous work. Brightness SHALL be an integer from 0 through 100; screen state SHALL be boolean. Records returned for inspection SHALL not permit mutation of adapter-owned state. This covers criteria 1 and 3; these are application contracts, not firmware limits.

#### Scenario: Synthetic frame fidelity
- **WHEN** a synthetic multiframe RGB animation is uploaded and caller input is subsequently modified
- **THEN** recorded frames retain every originally submitted byte in row-major RGB order and the original effective delays

#### Scenario: Invalid input
- **WHEN** a frame is short, an animation is empty, a delay is invalid, or a control is outside its accepted domain
- **THEN** the result is invalid-input and there are no command effects

### Requirement: One serialized operation writer
One adapter instance SHALL execute submitted operations in FIFO order with each upload occupying the writer for all its frames. Probe and controls SHALL wait behind the active upload. Successful, failed and interrupted operations SHALL release the writer. This covers criteria 2 and 3.

#### Scenario: Concurrent animations and controls
- **WHEN** two animations and a brightness command are submitted concurrently
- **THEN** all frames from the first animation precede the second animation, and the brightness command follows both without interleaving

#### Scenario: Failure recovery
- **WHEN** an injected upload failure interrupts one transaction
- **THEN** its result distinguishes upload-failed from offline, retains already recorded frames, and allows the next valid operation to proceed without automatic retries

### Requirement: Cancellation and generation boundaries
Each operation SHALL carry the current generation and a positive finite timeout. The timeout SHALL cover queue wait and execution. Abort cancellation, deadline expiry, and generation invalidation SHALL settle both queued and active work, prevent remaining fake effects, and distinguish cancelled, timeout and stale-generation results. Generation invalidation SHALL advance the generation and prevent old callbacks from succeeding. Results SHALL disclose possible prior effects after a partial upload; cancellation SHALL not claim to undo already applied device work. This covers criteria 1 and 2.

#### Scenario: Queued timeout or cancellation
- **WHEN** an operation expires or is cancelled while another upload owns the writer
- **THEN** it settles without waiting for that upload and records no effects

#### Scenario: Active interruption
- **WHEN** an upload is cancelled, times out or becomes stale after one frame
- **THEN** it retains that frame as possible prior effects, records no later frames, and never returns success from an old callback

#### Scenario: New generation
- **WHEN** the generation advances during an active upload with queued old work
- **THEN** all old work settles as stale-generation and new-generation work can complete

#### Scenario: Offline recovery
- **WHEN** simulated connectivity is lost and later restored
- **THEN** operations fail with offline while unavailable, and explicitly submitted fresh work can succeed after recovery without replaying failed commands
