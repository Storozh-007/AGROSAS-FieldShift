# Global workspace verification — 13–14 November 2026

- Local PostgreSQL migration 0004 applied; original fields retained.
- 12 FTW example polygons imported idempotently, with 8 USA, 2 Europe and 2 Ukraine. NASA POWER April–September 2025 downloaded for all 12 examples with complete provider coverage.
- Backend: 30 pytest tests passed on a separate migrated and seeded PostgreSQL database. Additional connection-ID validation was checked with the five global-feature tests.
- Frontend: TypeScript and 19 Vitest tests passed. Next.js webpack production build completed.
- Official SMAP, Landsat 8, Landsat 9, Terra, Suomi NPP and ISS model assets loaded in Chromium; no JavaScript page errors in this model sweep.
- Live CelesTrak response returned 12 configured NORAD records. NASA RSS returned 10 headlines; NWS response was available. These are provider availability checks, not evidence of an alert or satellite acquisition for a particular field.
- GIBS field image smoke checks: SMAP and SRTM returned image coverage; IMERG returned an empty image for the selected field/date and was correctly marked no-data.
- Browser checks cover precise object identity, undo/delete, saved cable graphs, pump isolation, crop persistence, solar/night behaviour, storage/blackout, mission-to-layer navigation, mobile widths, map beacons, and native canvas resolution. Gateway-only tests run through port 8080 rather than the direct Next.js port.

Known limits: FTW boundaries are model outputs, operator/crop defaults are educational, coarse satellite products remain coarse when zoomed, historical ISS models can differ from current hardware, and orbital proximity does not confirm imaging. Water/data cables are schematic; the electrical circuit model and energy balance are computational. ECOSTRESS and several supplied regional resources require further product/API integration and are shown as such.

Docker release: production backend/frontend images rebuilt and deployed through the single-origin gateway on port 8080. Migration 0004 applied to container databases. The development backend also recovered with the updated dependency image. Twelve verified NASA POWER histories were copied additively to matching example source IDs in the production database; no existing observation was replaced.

Final single-origin Chromium run: all 23 Playwright scenarios passed in 2.7 minutes against the updated Docker gateway, including pointer dragging/undo, mission-layer navigation, NASA history, mobile layout and Retina rendering. Final backend run: 30 passed. Final Vitest run: 19 passed.
