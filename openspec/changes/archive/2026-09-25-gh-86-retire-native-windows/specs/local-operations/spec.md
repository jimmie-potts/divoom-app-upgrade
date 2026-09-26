## MODIFIED Requirements

### Requirement: Backend lifetime is independent of the browser
Documented native startup SHALL serve production UI and API from one loopback
origin, retain external data across graceful shutdown, and keep orchestration
running after all browser pages close while the host and process remain awake.
Documentation SHALL describe Windows-to-WSL reachability checks. Linux/WSL is the
supported host; documentation SHALL NOT present native Windows as a runtime
alternative. Source delivery SHALL NOT install services or change networking
policy. Trace: issue #10 startup and browser lifetime criteria; issue #86 host scope.

#### Scenario: Browser closes during playback
- **WHEN** a browser starts a bounded playlist and closes before it finishes
- **THEN** the backend continues advancing the playlist and reports the resulting state to a later client
