# Deployment architecture

Browser → Caddy :8080 → Next.js :3000 / FastAPI :8000 → PostgreSQL 17 + PostGIS.

Caddy keeps the `/api` prefix when proxying; `/api/docs` and `/api/openapi.json` are served by FastAPI. The legacy `/api/backend/*` path stays compatible through the server-side Next.js proxy. The auth token is added on the server and never shipped in client JavaScript. The browser uses relative paths; HMR/WebSocket traffic is proxied by Caddy.

Single local user/organisation: the gateway grants demo access to the API. This is not multi-user authentication. Do not expose this stack to the internet without real authentication, organisation isolation and HTTPS.

Production-like setup: multi-stage images, non-root frontend/backend, `no-new-privileges`, closed database/backend ports, persistent volume, health checks and restart policies. Frontend dependencies are pinned by `package-lock.json`; Python uses version ranges, so a reproducible public release should pin a full lock and image digests.

For a VPS you also need: DNS and a domain, HTTPS in Caddy, a secret manager, proper authentication, restricted access, offsite backups and monitoring — only then change the gateway bind from loopback. No GPU is needed on the server: Three.js/WebGL run in the browser.

Live NASA, ERA5 and orbit data need outbound internet. Unavailable sources are reported as unavailable and never replaced with made-up measurements.
