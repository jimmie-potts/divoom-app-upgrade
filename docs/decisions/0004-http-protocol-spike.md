# ADR 0004: Opt-in HTTP protocol experiments

Status: Accepted for source tooling. Date: September 5, 2026. Scope: issue #4.

Add a separately invoked HTTP adapter using Node's native HTTP client. Keep
normal application startup simulator-only. Pin a canonical RFC1918 IPv4, port
80 and `/post`; bound responses and reject redirects. Use no third-party device
SDK. [Protocol provenance](../protocol-spike.md) records the references and gaps.

The real writer waits for local request closure before starting another operation.
This differs from the fake's cancellable in-memory callback. A sent mutation may
already have applied, so interruption reports possible effects without rollback.

Read an animation ID, then send complete frames sequentially with that ID. Do
not reset or retry automatically. Separate read-only probe from individually
acknowledged static, GIF, transition, control and ID-reset stages. Profile limits
are explicit provisional experiment bounds; physical observations must justify
any claim of hardware support. Reject unsupported timing rather than converting
it implicitly.

The generated GIF and paired RGB frames are original synthetic fixtures. Browser
decoding validates the fixture, while fake servers validate the protocol sequence.
Neither supplies a physical observation. Source acceptance can be merged with
hardware acceptance still open in issue #4. There is no deployment or migration.
