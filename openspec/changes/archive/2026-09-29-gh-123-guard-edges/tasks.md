## 1. Guard edges

- [x] 1.1 Add a boundary test behind the existing backstop, against a test-owned listener, and observe it fail on the current guard; retain the actual red result for the empty `execPath`, the overwritten `process.execPath` fork and the logged `data:` worker source.
- [x] 1.2 Check a fork's program as Node reads it against the Node binary captured at load, and record non-file worker modules by scheme only; verify the new test passes, symlinked Node and file workers stay guarded, refusals stay name-only, and reverting either fix fails the test.

## 2. Guidance and delivery validation

- [x] 2.1 Update the verification guide's transport guard description; verify it matches the implementation.
- [x] 2.2 Run all applicable source, browser and workflow checks and retain real results.
- [x] 2.3 Synchronize the modified requirement and archive this change before final independent review; verify the resulting specification inventory.
