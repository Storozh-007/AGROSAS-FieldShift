# AGROSAS OS redesign · 12 November 2026

- Public branding: AGROSAS OS / Team Astrology, using the owner's supplied logo and team illustration.
- New root landing page; functional workspace remains at /dashboard.
- Shared navy, cyan and lime palette across the dashboard, forms, navigation and mobile interface.
- Mobile landing inspected at 390×844, without horizontal overflow.
- Ukrainian/English copy; chosen language persists into the workspace.
- TypeScript and 6 unit tests passed. Browser checks passed for landing, dashboard, WebGL Earth and mobile fields; branding/language navigation has its own browser test.
- MapLibre worker is served locally from /maplibre-worker.mjs; field boundaries render correctly with the satellite map.
- Local preview: http://127.0.0.1:3000. Existing local FastAPI/PostgreSQL remain in use for this preview.
- Previous Docker infrastructure tests are recorded in INFRASTRUCTURE_VERIFICATION.md. Docker Engine is currently stopped and the host disk is nearly full again, so the latest redesign has not been rebuilt in Docker. No public deployment was performed.
- GitHub main contains a clean source snapshot based on the remote LICENSE commit; local credentials, backups and the earlier local token-containing history were excluded.
