# Infrastructure verification — 12 November 2026

## Passed

- Compose production and development: build, one-command start, health checks.
- Production Next.js standalone: Webpack build, TypeScript and generation of every page.
- Backend pytest on a separate `fieldshift_test` database, including live NASA POWER, CRUD, the analytics engine, recommendations, IoT and safety APIs.
- Frontend unit tests and Playwright through http://localhost:8080: landing/dashboard, every route and Swagger, identical data via direct API and Next proxy, cross-origin write blocking, field create/delete, WebGL globe pause/resume, mobile layout, NASA POWER series, strategies and climate-scenario recalculation in the browser.
- Import of existing fields from a local PostgreSQL into Docker; the source database stayed intact.
- Backup (`pg_dump` custom format), restore into a temporary database, field count and PostGIS check; temporary database removed.
- Full stop/start: fields and geometry preserved, all pages respond.
- Development HMR through Caddy and FastAPI hot reload.
- Only the gateway port is published, bound to 127.0.0.1:8080.
- CLI syntax checks and `git diff --check`.

## Fixes found by real runs

- Docker credential helper added to the CLI `PATH` on macOS.
- `satellite.js` pinned to 6.0.2 (v7 pulled Node/WASM modules into the browser bundle); `npm audit`: 0 vulnerabilities.
- Production and development build with Webpack instead of a hanging Turbopack path.
- PostgreSQL health check uses TCP so migrations never start against the temporary init server.
- Caddy Origin matcher fixed; write checks run before terminal proxy handlers.
- Restore keeps PostGIS extension DDL and no longer tries to drop the base extension when topology/tiger depend on it.
- `--confirm-replace` parsing fixed; Vitest and Playwright separated.
- Esri basemap attribution corrected; map borders load on `style.load` regardless of raster tile availability.

## Limits

The local stack serves one organisation without public multi-user auth and was not deployed to the internet. Science-source availability depends on the adapters and outbound internet; missing observations are never replaced with measurements. Prod and dev use separate databases and secrets; moving data is a snapshot, not a sync.
