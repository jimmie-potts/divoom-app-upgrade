## 1. Paging and identifiers

- [x] 1.1 Write failing pager tests for one session per page, ten-second rotation through every session and 20-character identifiers, keeping the sort, filter and clamping cases. Then change the page size and width and verify the tests pass.

## 2. Font and renderer

- [x] 2.1 Write failing tests that the 5×7 alphabet covers every label character plus its own marker outside the alphabet, and that identifiers wrap at a separator or at ten characters. Then add the font and wrapping and verify the tests pass.
- [x] 2.2 Write failing renderer tests for the one-session layout: every activity, attention, notice, uncertainty and health state differs in shape or words; an attention page has two frames that differ only in the tile and chip; every other page, including the empty page, has one frame. Then replace the row renderer and verify the tests pass.

## 3. Rendition and writer

- [x] 3.1 Write failing service and presentation tests showing that a rendition carries `frames`, `frameDelayMs` and `rgb` equal to the first frame, and that a two-frame rendition reaches the fake device as one two-frame upload at 500 ms under the existing cadence and guards. Then update `DashboardService`, `MonitorPresentation` and `Player.uploadDashboard` and verify the unit and integration tests pass.

## 4. Previews and qualification

- [x] 4.1 Animate the Monitor tab preview from the rendition frames and show every frame in the committed preview. Update the browser tests to compare every canvas frame with the renderer RGB. Verify with `npm run test:browser`.
- [x] 4.2 Extend the synthetic examples so that every legend state appears, update the fixture hashes and regenerate `docs/examples/agent-dashboard.html`. Verify with the unit and browser tests.
- [x] 4.3 Redraw the qualification fixtures in the one-session layout with a two-frame pulse case, and let the tool upload an optional pulse frame. Verify with the qualification unit, transport and browser tests.

## 5. Documentation and delivery

- [x] 5.1 Replace the layout table and legend in `docs/agent-monitoring.md` with one short table, and add ADR 0020. It records the layout, the attention-only pulse and which transport the evidence supports. Verify by inspection.
- [x] 5.2 Run `npm run check`, `npm run test:browser`, `npm run check:workflow` and `npm run test:workflow`. Then synchronize the specs and archive this change.
