## Context

See proposal.md. Hub #8 supplies source-tested Linux/WSL setup APIs and a reproducible archive at f6bee907e06177c6dc8abde0075d73cc391784e9. Pixoo owns its credential CLI, simulator, monitor HTTP endpoint and UI. Live client qualification is still absent.

## Goals / Non-Goals

Verify the shared package against this Pixoo revision with disposable state and document the exact operator boundary. Do not implement another installer, change lifecycle normalization or enable personal hooks. No new lasting architecture decision: ADR 0010 already assigns installation tooling to Hub.

## Decisions

- Vendor the unchanged reproducible Hub archive as a development dependency with hash/source receipt. This follows the existing shared-package convention and avoids registry credentials or an unpinned sibling checkout. A new Pixoo installer would duplicate Hub ownership.
- Use a Linux-only integration fixture that starts the existing simulator on an ephemeral loopback port. Windows application checks retain their existing coverage; this Linux SDK fixture explicitly skips on Windows rather than claiming native support.
- Exercise the real setup SDK, credential CLI, hook process and monitor transport. Synthetic client JSON is sufficient for packaging but cannot qualify actual client trust or event delivery.
- Keep live acceptance in the issue and hardware record. The source change can archive after its own source tasks pass; archiving never closes the issue's live criteria.

## Risks / Trade-offs

- Credential authority is sensitive. Fixtures use temporary private directories and synthetic tokens, verify revocation, and preserve unrelated configuration.
- The archive bundles more than setup. It is a development-only dependency and is not loaded by normal application startup.
- Source and real-client behavior can differ. Keep qualification false in operator examples until the named owner records the required coverage or an explicitly accepted degraded mode.
- Performance #61 remains open. No fixture duration is an installed hook or event-to-visible performance qualification.

## Migration Plan

No installed migration occurs. The operator guide refers to Hub's fenced state-owner handoff and latest-state rollback. Personal operations require the reviewed paths, diff, versions, owner and separate authorization.
