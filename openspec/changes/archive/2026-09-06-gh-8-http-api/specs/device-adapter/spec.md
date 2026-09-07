## MODIFIED Requirements

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
