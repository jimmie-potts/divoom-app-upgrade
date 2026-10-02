# gif-qualification Specification

## Purpose

Provide bounded, reproducible GIF frame-count and timing experiments without treating transport acknowledgment as visible-device qualification.

## Requirements

### Requirement: Fixed experiments with explicit physical admission
The tool SHALL default to offline previews. Physical execution SHALL require an explicit private target, display-replacement and exclusive-writer flags, owner/model/firmware metadata, an exact clean source revision, and the application target lock. It SHALL preserve brightness and screen settings and send no reset, retries or recovery writes. Trace: issue #55 AC3–AC4.

#### Scenario: No physical opt-in
- **WHEN** the tool runs without physical opt-in, even with a target environment variable
- **THEN** it produces previews and sends no physical request

### Requirement: Bounded count and timing stages
The physical sequence SHALL contain A:20×500 ms, B:20×100 ms, C:2 frames at 200/800 ms, D:2 frames at 800/200 ms, E:2×500 ms; respective post-upload holds SHALL be 30/10/10/10/10 seconds. Probe SHALL be bounded by five seconds, each upload by fifteen seconds and the whole run by 180 seconds. Failure or cancellation SHALL stop subsequent stages. Receipts SHALL distinguish requested delays, complete frame hashes, request results and absent visible observations. Trace: issue #55 AC3–AC5.

#### Scenario: Failure after a possible write
- **WHEN** an upload fails or is cancelled after submission
- **THEN** the receipt preserves its outcome and no later stage or automatic restoration is sent
- **AND** no observed production profile is inferred from transport success
