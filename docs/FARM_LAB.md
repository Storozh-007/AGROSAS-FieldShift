# AGROSAS OS — Farm Lab

Implemented 13 November 2026. Open `/farm-lab`, or use the **FARM LAB / 3D** navigation link. The field dossier opens the same model with `?field=<id>`.

## Orbital overview

Sun and Moon directions are calculated with [Astronomy Engine](https://github.com/cosinekitty/astronomy), using geocentric vectors, the equator of date and Greenwich sidereal time. A terminator shades the night hemisphere. The Moon label shows illuminated fraction. The time slider and accelerated clock move both bodies and the satellite illustration. Distances are compressed and screen indicators are constrained to the available viewport; this is not a scale model of the solar system. Satellite TLEs remain illustrative, not a live catalog.

## Field exploration

The existing original-resolution imagery, field boundary, field dossier and NASA seasonal context remain available. Three PLAN markers suggest positions inside the boundary for a soil probe, weather station and irrigation module. They link to Farm Lab. They are not surveyed locations or installed-device claims. No unverified spatial NDVI or soil-moisture heatmap is generated.

## Interactive 3D farm

The scene uses Three.js, native pixel density up to 2, antialiasing and shadow maps. Drag to orbit, pinch/scroll to zoom, select scene labels or module cards to inspect equipment. The supplied field boundary keeps its shape/aspect in a local schematic coordinate system. Infrastructure placement, crop rows, roads and surrounding terrain are illustrative.

Seven modules provide changing values: solar generation, battery charge, irrigation/tank, modeled soil moisture, weather scenario, base farm load and connectivity architecture. Resource particles reflect active solar, power and irrigation paths. Actual device records and saved telemetry are shown separately under **Підключені пристрої** with timestamps and DEMO provenance. Simulator values are never written to telemetry.

## Scenario rules and units

- Photovoltaic power, kW: installed capacity × max(0, sin(solar altitude)) × (1 − 0.85 × cloud fraction) × 0.86. Solar altitude uses date and field coordinates. This is an educational model without panel azimuth, tilt, shading, temperature or irradiance calibration.
- Demand, kW: configured base load plus active pump load. Battery output covers deficits first, followed by grid imports when available. Unserved demand is displayed when grid and battery cannot cover the load. Surplus charges the battery, exports when grid is available, or is curtailed.
- Battery capacity, kWh: charging and discharging are limited to 0.5C, 95% efficiency in each direction, and available/remaining energy. Initial SOC is 55%, or zero at zero capacity. Changing capacity resets the scenario state and session counters.
- Pump: 2.5 m³/hour per rated kW, subject to water available and supplied power. The tank starts with 150 m³. With insufficient electricity, the simplified model scales pump supply with the fraction of total demand served.
- Irrigation depth, mm: water volume / (field hectares × 10). A 0.3 m root zone means one percentage point of volumetric moisture represents 3 mm water. Configured rain adds water; evaporation is max(0, sin(solar altitude)) × 0.25 mm/hour. Moisture is bounded to 5–45%. This is not a calibrated soil model or irrigation recommendation.
- Session counters integrate generated/delivered/imported/unserved/curtailed electricity in kWh and water in m³. Changing the date/time explores another condition; reset the session to start a new experiment.

Simulation begins paused. Play uses ×1, ×60 or ×600 simulated seconds per second. Configuration is stored locally per field in browser localStorage; no project equipment is created automatically. Hardware sizing and all modeled outputs require calibration before operational use.

## Verification

Frontend unit tests cover celestial geometry, night-time generation, cloud/capacity responses, electrical balance, storage limits, pumping limits, boundary marker placement and persisted input validation. Browser tests cover scene rendering, module selection, energy controls, blackout behavior, mobile layout and celestial time controls, alongside the existing orbital navigation and branding suite.

Telemetry reads now join each measurement to its device organization. An isolated PostgreSQL/PostGIS test verifies that even an explicit foreign device ID returns no other organization's records.

## Crop models, editor and decision workflow

The November 13 extension adds instanced crop models for all nine supported crops. Wheat/barley have ears, maize/sorghum have tall stalks and leaves, sunflower has visible flower heads, and legumes/rapeseed have bush/flower forms. Growth stage and rendering density are explicitly user-controlled. **Оглянути культуру** moves the camera into the plot. Growth visualization is illustrative and is not inferred from NDVI or the calendar.

The per-field editor supports adding/removing/clearing inventory, pointer dragging, numeric placement, rotation, scale, capacity, enabled state and device-record links. Scene coordinates are schematic, not surveyed coordinates. The initial seven items are a starter layout, not a claim of installed equipment. Saved designs live in PostgreSQL and use optimistic revisions; concurrent overwrites are rejected. Module energy capacities sum into the simulator and planner. Local changes must be saved before generating a server plan.

A real ECMWF IFS 0.25° forecast, accessed through Open-Meteo with attribution, is distinct from historical NASA POWER. Forecast retrieval is cached for at most 15 minutes; failures return an unavailable state rather than fabricated weather. The 72-hour heuristic ranks low-rain hours by incoming solar radiation and respects pump throughput and available water. It compares a morning baseline under the same weather and planned water budget; blackout constraints can make actual delivered water differ. Soil deficit and energy shortages remain visible even when a schedule is proposed. It is not a calibrated irrigation prescription or a global optimum. Accepted plans are recalculated against the cached/current forecast and the saved design, then retained with inputs, model version, design revision and weather provenance. Outcomes are explicitly user reported.

The satellite evidence tab searches actual Sentinel-2 L2A acquisitions via Earth Search and reads only field windows from public COG assets. The calculation masks SCL classes other than 4/5/6, applies provider BOA offset provenance once, clips the true boundary and produces an image overlay. Cloud gaps are transparent. Missing BOA provenance stops calculation. Known upstream offset metadata inconsistencies remain a limitation; item-level `earthsearch:boa_offset_applied` is retained in provenance. Native source pixels are 10 m; displays are capped at 512×512 with the resulting cell size shown. The output contains modified Copernicus Sentinel data, attributed by year. Catalog metadata alone is never converted into an invented NDVI value; the legacy HLS example series remains explicitly DEMO.

All supplied resource families are listed with coverage and access links. POWER, Sentinel-2 field raster calculation, and the additional ECMWF forecast route have working integrations. Other listed resources are catalog references, not claims of downloaded data. U.S.-only products are not substituted for Ukrainian field measurements. See DEVICE_GATEWAY.md for the real-data ingest path and the current hardware limitation.

Primary implementation references:
- https://github.com/Element84/earth-search
- https://github.com/Element84/earth-search/issues/23
- https://github.com/Element84/earth-search/issues/71
- https://open-meteo.com/en/docs/ecmwf-api
- https://www.fao.org/4/x0490e/x0490e00.htm
