## Context

The released Hub lifecycle package is the canonical metadata contract. Pixoo already vendors a released MCP archive with a source receipt, and its default application checks execute Vitest integration tests on Linux and Windows. See proposal.md for motivation and the capability delta for consumer requirements.

## Goals / Non-Goals

Make contract installation and validation reproducible without authenticated GitHub access during npm installation. Publish requirements for later Pixoo composition while leaving existing server and browser behavior intact.

## Decisions

- Vendor the exact released archive with its SHA-256/source receipt and pin a root development dependency to that archive. The npm lock adds its integrity. This follows the existing MCP artifact convention. A sibling-checkout import or branch URL would not provide a delivered dependency; a live release URL would require repository credentials during CI setup.
- Run the original shared fixture corpus through the installed upstream validator and verify every manifest hash. Keep cases in the upstream archive. Duplicated JSON/provider logic would drift; a reimplemented validator would divide contract ownership.
- Document each Pixoo consumer mapping and unsupported signal explicitly. These are source consumer requirements for later embedding/rendering, not implemented state or UI features.
- Preserve the existing accepted ADR ownership direction and update its pointers to delivered contract adoption. No new owner, storage database, collector or device writer is created.

## Risks / Trade-offs

- Release hosting can change assets. The committed source receipt and archive checksum identify the accepted bytes; installation and tests must reject mismatches.
- A schema-valid observation does not establish truth or installed compatibility. The capability matrix retains evidence levels and later acceptance owners.
- Contract source can evolve independently. Upgrades require reviewed version, fixture and provenance changes; unsupported versions remain rejected.

## Migration Plan

No live migration applies. Source consumers install the committed archive through npm ci. Reverting this adoption returns only development dependencies and documents to the prior state. Later runtime ownership transitions require their own delivered APIs and explicit installation authorization.
