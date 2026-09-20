# ADR 0013: Shared controller boundary in the existing backend

Status: Accepted for issue #37 source implementation.

The hub needs the released controller wire contract while Pixoo already owns
its library, player, replay identities and physical queue. A second controller
writer or independent replay sequence would permit conflicting client effects.

Expose explicitly enabled `/controller/v1` routes in the existing backend. Use
its private machine credential store with per-principal read/control scopes.
Keep native route exceptions narrow and retain browser Host/Origin protections.
Startup configuration owns neutral identity; callers never provide destinations.

All command sources share the existing ledger and player. Native envelopes keep
revision/generation guards in their replay fingerprint. Reuse player/library
execution helpers after admission, and retain the adapter's cancellation and
possible-effects semantics. Track catalog revisions to guard native media
selection and pass the selected revision into atomic capture.

Use a separate bounded feed for shared contract envelopes so existing browser
SSE remains compatible. Reauthorize streams before delivery and on a one-second
interval. Disable the native endpoint by removing its activation flag and
restarting. No data migration or second state database is introduced.

Contract v1 cannot express all local media tools. Advertise the implemented
subset and leave mode/filter integration to #33. Fake-backed source tests do
not establish installation, actual hub-client behavior or physical accuracy.
