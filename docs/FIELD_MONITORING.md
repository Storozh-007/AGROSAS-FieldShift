# Field monitoring and crop rotation

The farm workspace opens on crop rotation. The field owner can confirm five seasonal crop records, compare their baseline with soil recovery and drought resilience strategies using the existing NASA POWER climate evaluator, then inspect spectral changes under **Спостереження**. Irrigation decisions and the editable 3D farm remain separate tabs.

## Implemented data path

- USDA NASS CDL: five previous calendar years, representative interior samples (up to five) via the official CropScape GetCDLValue service. Sample agreement is not classification accuracy. The connector covers continental USA; other regions use manual history. Unknown crop codes stay unmapped. Spring wheat is distinct from winter wheat; scoring currently shares wheat assumptions.
- Sentinel-2 L2A / Earth Search: up to 80 recent scenes in a period of at most one year; tile cloud cover below 60%. Ten indices: NDVI, NDMI, NDRE, RECI, GCI, EVI, SAVI, MSAVI, NDWI, NBR. Native spectral resolution is 10 or 20 m, with bounded display grids; no invented detail. SCL masks cloud, shadow, snow and missing pixels. Numerical values and provenance persist in migration 0005.
- Date comparison: identical geographic grids and the intersection of valid pixels. Mean change and fractions above/below 0.1 use that common mask. Timelapse plays downloaded observations; a seasonal chart does not bridge gaps exceeding 45 days.
- Bare soil review: monthly NDVI below 0.2 at at least 60% valid field coverage flags a month for review, rather than declaring erosion or bare soil as fact. Unsampled months remain unknown.
- VRA: quantile classes of actual valid spectral cells, clipped to the field polygon. Constant values can produce fewer classes. Users enter rates, units and prices. Budgets use observed zone area only; missing cells receive no rate. GeoJSON includes source provenance; it is not certified machinery ISO-XML or a fertilizer prescription.
- ECMWF IFS 0.25° / Open-Meteo: on-demand 14-day regional forecast. Generic frost/heat/wind flags do not diagnose crop diseases. Missing provider values stay unavailable.

## Access and persistence

All field endpoints use the existing organization authorization. USDA import remains a draft until a user confirms crop history. Confirmed records update the existing baseline rotation input. Non-NDVI indices never populate the legacy NDVI overview. Provider failures produce explicit unavailable states rather than generated measurements.

## Still requires separate integration

EOS proprietary crop/yield ML, disease diagnosis, insurance damage valuation, contamination detection, calibrated BBCH/yield forecasting, PlanetScope 3 m and commissioned 30 cm imagery, certified terminal exports, and multi-user roles are not implemented by this release. Their availability must not be implied by the interface or screenshots. Regional satellite products do not become precise field sensors through display resampling.

## Validation

Numeric tests cover common pixel comparison, grid mismatch/no-data rejection, clipped non-overlapping zones, default-zero rates, USDA crop mapping, confirmed history persistence, invalid seasons and authorization. Raster tests verify reflectance offset application, cloud masking and JSON serialization. Browser tests cover five-season confirmation/reload, all ten index choices, separate observation and 3D views, existing irrigation workflow and satellite playback.

Verified on 2026-11-14: backend 35 tests, frontend 26 unit tests, production browser suite 28 tests passed. The real North Dakota FTW 653283 example returned NDVI 0.3362 on November 13 (100% field coverage), NDMI -0.2208 and NDRE 0.2358. Comparing October 29 to November 13 used 3,894 common cells and returned mean NDVI change +0.0989; independent full-scene means are deliberately not used for this difference. Three clipped quantile zones were returned. USDA returned five seasonal sample classifications, and the forecast provider returned 14 available days. These are observation-specific verification results, not guarantees for other dates or fields.

## Field experience corrections

USDA classifications now populate the season controls immediately and retain their USDA origin. Reimporting cannot replace farmer-confirmed seasons. Sowing dates are optional; dates outside the season and preceding autumn are rejected. Previously cached USDA histories are applied only where no farmer confirmation exists.

The orbital field map uses the same boundary-clipped imagery as the 3D field, rather than displaying global GIBS tiles over surrounding land. Polygon holes are transparent. Scientific indices retain their formulas but are presented through farmer tasks (crop cover, water in plants, early seedlings, open water); selecting another index loads its selected scene automatically when needed.

The first irrigation calculation can prepare the missing pump, reservoir, irrigation line and power connection. It remains a saved planning scenario, not physical hardware activation. The model keeps actual shortages and does not generate sensor records.

The editable 3D scene now includes a combine, detailed tractor wheels/cab, corrugated grain storage, curved crop leaves, wind motion, soil cross-section and gravel surfaces. A complete-farm preset is available through the editor's undoable draft workflow. Existing layouts are not silently replaced. New scenes include thirteen editable objects and start at approximate local noon for a usable daylight view; the date/time controls remain available. This is an editable scenario, not a photogrammetric reconstruction of existing assets.
