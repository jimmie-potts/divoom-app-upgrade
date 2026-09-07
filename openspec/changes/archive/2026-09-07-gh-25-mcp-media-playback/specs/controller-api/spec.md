## ADDED Requirements

### Requirement: Shared media and player admission
HTTP and MCP player operations SHALL use the same application request identity, command semantics and retained outcomes. Existing HTTP commands SHALL preserve their payload and response behavior. Expected-revision starts and temporary-media starts SHALL be available as strict shared command variants. Schema failures SHALL precede identity reservation; admitted domain failures SHALL remain replayable. Trace: issue #25 shared-command and replay criteria.

#### Scenario: HTTP and MCP replay
- **WHEN** one transport submits a playback operation and another repeats its canonical intent with the same identity
- **THEN** only one operation executes and both receive projections of the same retained result

#### Scenario: Invalid shape and domain failure
- **WHEN** a request has unknown fields or an admitted request selects a missing rendition
- **THEN** the malformed shape consumes no identity while the admitted missing-rendition failure remains the original result for its identity
