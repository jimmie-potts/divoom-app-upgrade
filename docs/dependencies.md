# Foundation dependencies

Versions below are pinned in workspace manifests and the lockfile. Licenses were
read from installed package metadata on September 5, 2026. Transitive packages
and their recorded metadata are in package-lock.json. No community Pixoo SDK or external SQLite npm driver is included. Media dependencies were
added and their installed license files/metadata checked September 6, 2026.

| Package | Version | License | Used by |
| --- | --- | --- | --- |
| `@eslint/js` | 10.0.1 | MIT | divoom-app-upgrade |
| `@fastify/static` | 10.1.3 | MIT | @pixoo/server |
| `@fission-ai/openspec` | 1.12.0 | MIT | divoom-app-upgrade |
| `@playwright/test` | 1.63.0 | Apache-2.0 | divoom-app-upgrade |
| `@types/node` | 24.13.3 | MIT | divoom-app-upgrade |
| `@types/react` | 19.2.18 | MIT | @pixoo/web |
| `@types/react-dom` | 19.2.7 | MIT | @pixoo/web |
| `@vitejs/plugin-react` | 5.2.0 | MIT | @pixoo/web |
| `eslint` | 10.10.0 | MIT | divoom-app-upgrade |
| `fastify` | 5.12.3 | MIT | @pixoo/server |
| `globals` | 16.5.0 | MIT | divoom-app-upgrade |
| `react` | 19.2.8 | MIT | @pixoo/web |
| `react-dom` | 19.2.8 | MIT | @pixoo/web |
| `typescript` | 5.9.3 | Apache-2.0 | divoom-app-upgrade |
| `typescript-eslint` | 8.69.0 | MIT | divoom-app-upgrade |
| `vite` | 7.3.6 | MIT | @pixoo/web |
| `vitest` | 3.2.7 | MIT | divoom-app-upgrade |
| `zod` | 4.5.4 | MIT | @pixoo/core, @pixoo/library |

Node 24 satisfies the selected runtime/tooling engine requirements. Fastify 5
and its static plugin are validated together through injection, process and
browser tests. Vite 7 and its React plugin build the React 19 application.
The pinned lockfile audit reported zero known vulnerabilities at this check;
that is a point-in-time result, not a guarantee of future advisory status.

References: [Fastify static compatibility](https://github.com/fastify/fastify-static),
[Vite requirements](https://vite.dev/guide/), [Vitest guide](https://vitest.dev/guide/).

## Media dependencies

| Package | Version | Installed license metadata | Role |
| --- | --- | --- | --- |
| sharp | 0.35.4 | Apache-2.0 | PNG/JPEG decoding, orientation, transforms and effective PNG previews |
| gifuct-js | 2.1.2 | MIT | GIF patch decompression and interlacing |
| js-binary-schema-parser | 2.0.3 | MIT | Pinned transitive GIF parser |
| @img/sharp-linux-x64 | 0.35.4 | Apache-2.0 | Linux native binding; platform variants are locked |
| @img/sharp-libvips-linux-x64 | 1.3.3 | LGPL-3.0-or-later | Prebuilt libvips and bundled dependencies; retain bundled notices |

The direct dependencies are exact pins; the lockfile pins native/platform and
transitive packages. The libvips package carries third-party license notices.
Source-only validation does not produce a redistributed application bundle;
packaging in M5 must preserve these notices and review its distribution format.

[sharp 0.35.4 source](https://github.com/lovell/sharp/tree/7f1a0a22cc285fe180766f4935d50b55af6e8432)
and [gifuct-js 2.1.2 source](https://github.com/matt-way/gifuct-js/tree/c497192922d79acc537ec9f4796dfa2d89aaa13a)
identify the evaluated revisions. See [decoder fixture evidence](media-rendering.md#decoder-evidence-and-licenses).

## Persistence runtime

`@pixoo/library` uses Node 24 bundled `node:sqlite`; no additional driver is
installed. [Node 24 documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
labels the API release candidate. This choice and its locking assumptions are
recorded in [ADR 0006](decisions/0006-library-persistence.md). Runtime packaging
must retain Node's bundled notices alongside the media dependency notices.

## API multipart parsing

`@fastify/multipart` 10.1.1 is pinned for the server, with MIT license metadata.
Its lockfile-pinned parser is `@fastify/busboy`. The API tests exercise part and
byte limits before publication. [Official plugin documentation](https://github.com/fastify/fastify-multipart) describes stream consumption and file-size errors.
