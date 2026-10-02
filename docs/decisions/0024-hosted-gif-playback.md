# ADR 0024: Hosted GIF playback through the existing writer

Status: accepted for implementation by the issue #55 wrap-up request; physical
application acceptance remains an independent delivery gate.

## Context

The raw frame-upload path does not provide the measured long-loop behavior of
the completed hosted GIF experiments. One global palette without local palettes
removed the observed first-frame substitution in the controlled fixture.

## Decision

Add an explicitly selected hosted profile without changing prior profiles.
Encode effective multi-frame renditions losslessly, retaining uniform delays and
repeated frames. Use the existing FIFO adapter to publish a bounded capability
URL and send one file-play command. The application owns the file listener and
its lifetime. The control API remains on loopback. See the
[operator contract](../device-application.md#hosted-gif-playback) for exact bounds,
readiness, failure behavior and hosting requirements.

## Consequences

Animations exceeding 256 combined effective colors remain previewable but cannot
use this lossless transport. No automatic quantization or uncertain fallback is
permitted. A completed transfer is not a visible-start event. Player deadlines
remain estimates. Stop cannot halt an already downloaded device loop. WSL NAT
requires a separately owned reachable route; persistent installation is not
implied by source support or a temporary physical test.
