# ADR 0002: Local simulator foundation

Status: Accepted. Date: September 5, 2026. Scope: issue #2.

Use npm workspaces and strict TypeScript project references. Core owns shared
validation and domain contracts; device owns transport; media owns rendering;
server composes them; web consumes public schemas. Their initial exports cover
only readiness, disconnected simulator status and canvas dimensions. No native
media or persistence dependency is installed before its implementing issue.

Compile to ESM and serve the built React/Vite page with Fastify from one process
and origin. The simulator command builds then starts; a separate start command
uses existing output. A separate frontend dev server and hot reload are optional
future conveniences, not prerequisites for this foundation.

Use environment-only PIXOO_DATA_DIR, PIXOO_PORT and PIXOO_MODE. Bind to
127.0.0.1; accept only simulator mode. Validate external storage before listening,
including existing symlink ancestors and Git checkout markers. Do not expose the
storage path via the health endpoint or static root. This prevents accidental
source writes, not races against a hostile local filesystem actor.

GET /api/health describes server readiness separately from disconnected device
status. The UI validates this shared schema and offers a retry after failed or
invalid responses. It must not present simulator readiness as device evidence.

No existing database or deployment needs migration. Application data survives
process shutdown. Reverting this source change restores the workflow-only
bootstrap; deployment and real-device acceptance remain separate.
