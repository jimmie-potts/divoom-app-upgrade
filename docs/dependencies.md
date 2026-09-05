# Foundation dependencies

Versions below are pinned in workspace manifests and the lockfile. Licenses were
read from installed package metadata on September 5, 2026. Transitive packages
and their recorded metadata are in package-lock.json. No community Pixoo code,
GIF decoder, sharp or SQLite driver is included in this foundation.

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
| `zod` | 4.5.4 | MIT | @pixoo/core |

Node 24 satisfies the selected runtime/tooling engine requirements. Fastify 5
and its static plugin are validated together through injection, process and
browser tests. Vite 7 and its React plugin build the React 19 application.
The pinned lockfile audit reported zero known vulnerabilities at this check;
that is a point-in-time result, not a guarantee of future advisory status.

References: [Fastify static compatibility](https://github.com/fastify/fastify-static),
[Vite requirements](https://vite.dev/guide/), [Vitest guide](https://vitest.dev/guide/).
