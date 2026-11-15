# AGROSAS Orbital Workspace · 13 November 2026

## User experience

Open `/dashboard`: the farm overview starts with a large interactive globe. The selected field has a glowing, keyboard-accessible flag. Selecting the flag flies to the field boundary in the same MapLibre camera; “На орбіту” returns to the globe.

The detailed field view displays the actual stored field name, area, current crop, soil type/pH, irrigation availability, geometry-derived coordinates and available NASA POWER climate summaries. The field dossier can be hidden, the basemap can be switched, the field can be fitted to the viewport, and the workspace supports fullscreen. Boundaries are vector geometry, not painted into a screenshot.

`/earth` and `/satellites` use the same spatial workspace. The public landing page also uses a real globe instead of the earlier CSS illustration. The supplied transparent AGROSAS logo is used unchanged.

## Rendering and provenance

- MapLibre GL 6 globe projection and local worker. Imagery: Esri World Imagery; alternative basemap: OpenStreetMap. Attribution is displayed.
- Satellite and orbit catalog is explicitly MODELLED / DEMO. SGP4 positions from the existing illustrative catalog are rendered above the Earth in normalized Earth-centered coordinates, with altitude and horizon visibility. These are not current operational TLEs or satellite coverage guarantees.
- Raster source native maximum zoom: 19. Camera fit caps at 18. Rendering uses native device pixels up to DPR 2; the Retina test checks the real canvas-to-CSS ratio. Image detail is limited by the provider's local coverage; image acquisition date is not verified.
- No invented NDVI heatmaps or soil-moisture zones. HLS values are shown only when verified observations exist; NASA POWER is labeled as regional gridded climate, not measurements within the field. The existing vegetation KPI marks demonstration observations as DEMO.
- Coordinates are computed from the supplied boundary, not cadastral data. Example boundaries remain labeled.

Reference: https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/

## Validation

- TypeScript: PASS.
- Vitest: 6 tests PASS.
- Desktop/mobile browser suite: 8 tests PASS, including the orbit → field → orbit journey, collapsible dossier, language continuity, standalone Earth, mobile layout, native Retina pixels and transparent logo.
- Local Next.js production build using Webpack: PASS.
- Production standalone preview uses the existing private backend environment; generated runtime files and credentials are excluded from Git.

Reproduce UI checks against a running preview:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm --prefix frontend run test:e2e -- --grep 'Landing|Dashboard|Earth renders|mobile fields|AGROSAS branding|dashboard beacon|mobile orbit|retina canvas'
```

The original Docker workflows remain available through `./fieldshift start` when Docker Engine is running. This iteration verified a local standalone production build; it did not publish an internet deployment.
