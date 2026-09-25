## 1. Identifier rule

- [x] 1.1 Write failing unit tests for the short identifier: four unlabeled IDs with a shared prefix give four different ID tails, labels that differ only at the end stay distinct, short labels and IDs are shown whole, and unsupported characters, including `…` itself, become `?`. Then implement the rule and verify the tests pass.
- [x] 1.2 Write a failing renderer test that the marker glyph differs from every alphabet glyph and that a truncated row draws it. Then add the glyph to the shared text renderer, outside the label alphabet, and verify the test and the unchanged now-playing tests pass.

## 2. Examples and documentation

- [x] 2.1 Add four unlabeled sessions with a shared ID prefix to the synthetic examples, assert their rows show four different identifiers, update the fixture hashes and regenerate `docs/examples/agent-dashboard.html`. Verify with the unit and browser tests.
- [x] 2.2 Describe the identifier rule, the marker and the residual collision limits in `docs/agent-monitoring.md` and the preview legend. Verify by inspection.

## 3. Delivery

- [x] 3.1 Run `npm run check`, `npm run test:browser`, `npm run check:workflow` and `npm run test:workflow`. Then synchronize the spec and archive this change.
