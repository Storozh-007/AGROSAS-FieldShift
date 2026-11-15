# Operations

| Command | What it does |
|---|---|
| `./fieldshift start` | Build, start, wait for health checks and verify the routes |
| `./fieldshift stop` | Stop without removing volumes |
| `./fieldshift restart` | Restart and verify the routes |
| `./fieldshift status` | State of every service, including migrations |
| `./fieldshift logs [service]` | Last 150 lines, then follow |
| `./fieldshift doctor` | Compose config, statuses, PostGIS, API and pages |
| `./fieldshift update` | Backup, rebuild, migrate and start. A failed migration is not rolled back automatically: read the logs and restore a compatible backup if needed |
| `./fieldshift seed` | Idempotent load of the demo farm |
| `./fieldshift backup` | Custom-format `pg_dump` into `backups/`, mode 0600 |
| `./fieldshift restore /absolute/path/backup.dump --confirm-replace` | Back up the current database, stop writers, restore in a transaction, start again |

Startup order: the database becomes healthy, a one-off `migrate` service applies Alembic, and only then backend, frontend and gateway start. If a migration fails, startup stops; `./fieldshift logs migrate` shows why. Never run `docker compose down -v` — it deletes the data.

Keep `backups/` and `.runtime/<mode>.env` in protected external storage; database backups do not include server secrets. If `APP_TOKEN` leaks, replace it and recreate the services. To change `POSTGRES_PASSWORD`, change the PostgreSQL role password first — editing the env file alone does not change the password inside an existing volume.

## Checks after startup

- `./fieldshift test` builds a separate test image and runs the backend pytest suite on a separate `fieldshift_test` database. Some tests call live NASA/ERA5 services and need internet.
- Frontend: `cd frontend && npm test && npm run typecheck`.
- Browser tests: `PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e` after `./fieldshift seed`.
- `python3 scripts/verify_infrastructure.py` verifies backup/restore into a temporary database, then stops/starts production and compares fields with the initial snapshot.
- `node scripts/verify_hmr.mjs` (dev mode only) changes the settings title, checks hot reload through Caddy, restores the file and triggers a backend reload.

## If Docker reports a read-only file system

This happens when the disk is almost full (`metadata_v2.db: read-only file system`). Free several GB (10 GB recommended), restart Docker Desktop and run `./fieldshift start` again. Do not use "Reset to factory defaults" or delete volumes to fix low disk space — that can destroy other databases. `docker builder prune -af` after `update` reclaims build cache.

Restore keeps installed PostGIS extensions: application tables are restored transactionally from a filtered TOC, so a local database can move into the official image with dependent topology/tiger extensions in place.
