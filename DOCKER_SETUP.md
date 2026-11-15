# Running on macOS

1. Install and launch [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) for your CPU. Check with `docker info`. On Apple Silicon the official PostGIS image runs under amd64 emulation.
2. In the project folder: `./fieldshift start`.
3. Open http://localhost:8080. API docs: http://localhost:8080/api/docs.
4. Optionally add the demo farm: `./fieldshift seed`. Seeding does not run on every start; sample boundaries are clearly labelled.
5. Stop with `./fieldshift stop`. The database volume is kept.

The first start downloads images and builds dependencies, so it needs internet and free disk space. Secrets are generated automatically in `.runtime/prod.env` (mode 0600) and are excluded from Git and the Docker build context. Do not delete that file while the volume exists — the password must stay the same.

Development: `./fieldshift --mode dev start`. It has its own secrets, Compose project and volume on the same port 8080, so stop prod first. Frontend and backend sources are mounted for hot reload. Prod uses a standalone Next.js build with no source bind mounts.

An existing native macOS database is never switched or deleted. To copy its data into the container: `./fieldshift import-local --confirm-replace` (backs up the container database first; needs a compatible `pg_dump`). Alternative: `./fieldshift restore /absolute/path/file.dump --confirm-replace`.

The platform is reachable only from this Mac: the gateway binds to 127.0.0.1, and database and backend ports are not published. Phone access needs a separately configured trusted HTTPS endpoint.
