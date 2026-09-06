## 1. Persistent catalog

- [x] 1.1 Add the isolated library workspace and transactional migrations; verify fresh, upgraded, failed and incompatible schemas with SQLite fixtures.
- [x] 1.2 Integrate private renderer output and immutable catalog metadata; verify original preservation, changed-transform identity and restart readback.

## 2. Playlists and lifecycle

- [x] 2.1 Implement named playlist operations and validated policies with stable item IDs; verify repeated assets, reorder, duplicates and stale-revision rollback.
- [x] 2.2 Persist session references and safe deletion jobs; verify protected deletion, explicit release, partial cleanup failure and restart retry.
- [x] 2.3 Enforce storage ownership and recover owned staging; verify competing owners, process-exit lock release and unrelated-file preservation.

## 3. Delivery

- [x] 3.1 Document API, migrations, ownership and limitations; pass application/browser/workflow checks as input to specification sync/archive and independent review.
