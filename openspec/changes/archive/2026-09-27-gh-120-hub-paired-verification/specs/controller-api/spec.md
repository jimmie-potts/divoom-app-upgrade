## ADDED Requirements

### Requirement: Simulator writer counts
In simulator mode, `GET /api/device/simulator` SHALL return the simulator writer's per-kind admitted and successful operation counts since startup, without contacting a device. In device mode the route SHALL answer 404. Trace: issue #120 and Hub #495's single-command assertion.

#### Scenario: One command reaches the writer
- **WHEN** a display brightness command succeeds and the same request is repeated
- **THEN** the route reports one admitted and one successful brightness operation

#### Scenario: Device mode
- **WHEN** the route is read in device mode
- **THEN** it answers 404 `not-found` and no device request is sent
