## 1. Reading and card

- [x] 1.1 Write failing tests for the playback envelope parser, the view (playing, paused, stale, failed read, aged out, unavailable, stopped, inactive, unknown) and the card layout (markers, status word, wrapping, truncation, accents, punctuation, stale dimming). Then implement the view, the card and the font additions.
- [x] 1.2 Write failing tests for the configuration loader and the reader against a loopback server: a valid read, wrong source, invalid shape, oversized body, redirect, timeout and one-at-a-time polling. Then implement them.

## 2. Presentation

- [x] 2.1 Write failing tests with the fake device, player and manual clock for the Monitor pop-up: the card for 10 s then the dashboard, attention present or arriving, stale reads and same-track hiccups. Then implement it.
- [x] 2.2 Write failing tests for the Media setting: Off, Pop-up resume, Whole song resume, manual action, screen-off, mode change, upload failure, and a non-playing playlist. Then implement the takeover.

## 3. API and browser

- [x] 3.1 Write failing integration tests for the `nowPlaying` view object, the protected setting route, persistence across restart, and an unchanged native integration snapshot. Then wire the reader, settings and routes.
- [x] 3.2 Write a failing browser test for the setting control, state and preview. Then add the panel group.

## 4. Documentation and delivery

- [x] 4.1 Document the configuration, the behavior and the evidence boundary in the monitoring and UI docs. Verify by inspection.
- [x] 4.2 Run `npm run check` and `npm run test:browser`. Then synchronize the specs and archive this change.
