## 1. Product support

- [x] 1.1 `registerCredential` stores only the digest of a supplied token and refuses malformed tokens and reused ids or digests; red on the missing export, then green.
- [x] 1.2 Fake adapter admitted and successful counts per kind survive disabled history; `GET /api/device/simulator` reports them in simulator mode and answers 404 in device mode; red on the absent counts and route, then green.

## 2. Paired plug-in

- [x] 2.1 `hub-feed` input and `hub-paired` seed: remote configuration for `verify-owner`, controller digest, no local sessions, and fixed-line refusals for a bad input or token file that write nothing.
- [x] 2.2 Launch pairing and guard: only `hub-paired` declares the Hub port and enables the controller with its default identity; every launch sets the paired list; the ready line announces `controller` from that launch on.
- [x] 2.3 Pairing-aware `no-physical-transport` and the `hub-feed` check, proven by guarded processes above the test backstop, including the negative control where a paired launch reaches an installed port, another port and a device.
- [x] 2.4 A paired server against a stand-in Hub feed, with the test as the Hub's controller caller: rejected, current, stale and recovered feed; one `brightness.set` reaches the writer; reseed to a standalone scenario.
- [x] 2.5 `hub-sessions` passes and `control-hub-feed-stale` fails through `runCaptureStep` against the stand-in Hub; the feature map and development guide describe the pairing convention.

## 3. Shared core and delivery evidence

- [x] 3.1 Vendor the released `@jimmie-potts/app-verify` 1.1.0 archive with its checksum and source receipt, and pin it in the consumer test.
- [x] 3.2 Local real-unit run from a clean candidate: standalone reference steps, then `hub-paired` against a stand-in Hub feed and controller caller, doctor, handoff, controls after handoff and stop.
- [x] 3.3 `npm run check`, `npm run test:browser` and both workflow checks pass without credentials or devices; synchronize and archive the change.
