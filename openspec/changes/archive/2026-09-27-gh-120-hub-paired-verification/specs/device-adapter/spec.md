## ADDED Requirements

### Requirement: Writer operation counts
The fake adapter SHALL count, per operation kind, the operations its writer admitted to its queue and those that completed successfully. The counts SHALL be kept when diagnostic history is disabled, SHALL NOT retain frames or records, and SHALL be returned as a copy. Invalid input and work refused before admission SHALL NOT count as admitted.

#### Scenario: Counts without history
- **WHEN** history is disabled and a brightness change succeeds, an invalid brightness is rejected, a queued brightness change is retired by a new generation and a probe succeeds
- **THEN** the counts report two admitted and one successful brightness operation and one admitted and successful probe, while frame and operation histories stay empty
