## 1. Release and planning inputs

- [x] 1.1 Pin contracts 1.2.0 and its trusted receipt; verify archive/manifest hashes and the full receipt corpus using the semantic validator.
- [x] 1.2 Add the owning command and focused validation to development guidance/CI; demonstrate a failing read-only plan or manifest test before implementing its behavior.
- [x] 1.3 Implement clean merged-source preparation, complete release inventory and exact read-only plan/status; verify dirty/unknown source, unsafe links, tampering, same-SHA conflict and baseline/configuration drift refusals.

## 2. Installation and recovery

- [x] 2.1 Qualify target writes and previous-code reopening of the durable closure; verify compatible latest-state recovery and refusal of unknown/incompatible formats before any stop.
- [x] 2.2 Implement exclusive ownership, durable intent/barrier, verified writer exit, complete backup, first adoption and atomic switch; test concurrent starts, stop/backup failures and each interrupted migration boundary.
- [x] 2.3 Implement bounded process/health verification, compatible rollback, semantic receipt finalization and protected retention; test wrong identity, candidate failure, failed recovery and finalization failure without replay/pruning.

## 3. Delivery guidance and validation

- [x] 3.1 Replace the in-place operations procedure and stale installation claims; add the installation declaration and conditional shared-claim pointer using writing-for-agents, and verify plan-first/standing-authority/physical-boundary routing by inspection.
- [x] 3.2 Run one real packaged disposable upgrade/recovery scenario with fake service control, required full application/browser/workflow checks, then synchronize and archive the completed source change before independent review. Retain installed and physical acceptance separately when their real evidence is pending.

Source qualification: the complete packaged simulator passed upgrade and recovery after a candidate write, preserving the latest record. Application checks passed (932 tests, one host-only skip); browser checks passed (85 tests, three intentional duplicate skips). Installed acceptance remains pending: the copied established legacy runtime cannot reopen the newer GIF and hosted media-profile records, so routine adoption refuses before outage. Resolving that recovery baseline is a separate decision; these source checks do not waive compatibility or establish physical acceptance.
