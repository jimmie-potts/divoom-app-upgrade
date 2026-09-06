# Device HTTP spike Specification

## Purpose

Provide bounded, independently implemented HTTP experiments for a specifically authorized Pixoo, with software evidence separated from physical acceptance.

## Requirements

### Requirement: Pinned and bounded transport
The transport SHALL require an explicit canonical RFC1918 IPv4 address and send JSON only to HTTP port 80 at /post. It SHALL reject hostnames, public addresses, alternate ports/paths, redirects, excessive response bodies and invalid JSON. Successful HTTP status and a numeric zero device error_code SHALL both be required. Errors SHALL distinguish HTTP, device rejection, malformed protocol and offline transport without exposing raw response content. This covers issue #4 criterion 1.

#### Scenario: Destination validation
- **WHEN** configuration supplies a public address, hostname, URL or ambiguous IP spelling
- **THEN** construction fails before any network request

#### Scenario: Response validation
- **WHEN** a server returns a redirect, HTTP failure, nonzero device error, missing error_code, oversized body or malformed response
- **THEN** the request fails with its corresponding typed outcome and follows no redirect

### Requirement: Serialized protocol operations
The adapter SHALL implement read-only probe, uploadAnimation, setBrightness and setScreen with one writer per instance. It SHALL snapshot and validate all frames against an explicit profile before requests, obtain one animation ID, then send sequential complete frames with that ID and ascending offsets. Controls SHALL wait for upload completion. An unverified smoke profile SHALL be labeled provisional and reject unsupported timing or frame counts without truncation. This covers criteria 1 and 3.

#### Scenario: Upload transaction
- **WHEN** a two-frame uniform animation and a control are submitted together
- **THEN** the adapter obtains the ID, sends both RGB/base64 frames in order, then sends the control, and reports estimated readiness separately from observed visibility

#### Scenario: Unsupported animation
- **WHEN** an animation exceeds the selected profile or has unsupported variable delays
- **THEN** it fails before any request with no implicit truncation or timing conversion

### Requirement: Interrupted requests preserve writer ownership
The adapter SHALL honor generation invalidation, AbortSignal and submission-relative deadlines for queued and active requests. It SHALL prevent subsequent stale frames, report possible prior effects once a mutating request is sent, and retain the writer until the local request is closed. It SHALL not retry or reset automatically. This covers criteria 1 and 3.

#### Scenario: Cancel during a request
- **WHEN** an upload is cancelled while a frame request is in flight
- **THEN** the result reports possible prior effects, no later frames are sent, and the next transaction waits for local request closure

### Requirement: Explicit experiment stages and evidence
Hardware tooling SHALL separate a read-only probe from opt-in static, known-GIF, ten-transition, screen-control and bounded animation-ID-reset stages. It SHALL require an explicit IP and display-change acknowledgement for mutating stages, stop on first failure, and leave simulator startup unchanged. Reports SHALL omit private identifiers and distinguish HTTP results from user-observed output. No device shall be contacted by default or by automated CI. Physical acceptance remains in issue #4. This covers criteria 2-5.

#### Scenario: Missing opt-in
- **WHEN** a mutating command lacks display-change acknowledgement
- **THEN** it exits before creating a transport or contacting a device

#### Scenario: Controlled smoke evidence
- **WHEN** an authorized smoke stage runs
- **THEN** it records the exact synthetic fixture and bounded command sequence, with timings marked estimated and visible output awaiting user assessment

#### Scenario: Hardware unavailable
- **WHEN** IP, authorization, reachability or user observation is missing
- **THEN** software checks may complete but hardware acceptance stays open and explicitly unverified
