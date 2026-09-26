## 1. CI

- [x] 1.1 Remove `windows-latest` from the Workflow and Application jobs in `.github/workflows/ci.yml`; verify the PR run and the merged main run each show exactly three successful jobs.

## 2. Documentation

- [x] 2.1 Remove native Windows runtime instructions from README, local operations, device application and local MCP documents, keeping Windows-to-WSL reachability checks; verify a repository search finds no PowerShell runtime steps outside archived changes.
- [x] 2.2 Update CI job lists in development and SDLC documents and the issue templates, update the agent-monitoring test note, and add ADR 0021.

## 3. Delivery

- [x] 3.1 Run Node 24 `npm run check`, synchronize and archive the `local-operations` delta, and pass both workflow checks. Keep review and CI evidence in the PR.

## Acceptance evidence

Node 24.21.0 `npm run check` passed: 631 tests in 69 files, plus both workflow checks. No application code or test changed, so there is no red run to record. A repository search outside archived changes finds no PowerShell runtime steps; the remaining PowerShell text covers only reaching the WSL backend from a Windows client. The three-job PR run and merged main run are recorded in the PR.
