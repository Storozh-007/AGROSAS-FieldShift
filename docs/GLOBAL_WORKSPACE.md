# AGROSAS OS — global farm workspace

## Problem and workflow

The workspace helps a farmer compare crop water needs with available power and irrigation infrastructure, locate evidence requiring inspection, and understand where each observation came from. It combines a configurable farm plan, connected electrical circuits, a 72-hour weather-based planner, and satellite context. A visualization is not a diagnosis or a confirmed satellite acquisition.

## Modular constructor

Each part has one persistent ID and one rendered instance. The 16-part catalogue includes crops, soil probes, weather stations, solar arrays, storage, pumps, wind turbines and infrastructure. Users can move, rotate, scale, duplicate, delete, undo, redo, connect compatible ports, and save revisions. Connections survive reloads; deleting a part removes incident connections. Power is balanced independently for connected islands, so an isolated pump cannot borrow power from another circuit. Water and data links are qualitative schematic connections; the app does not calculate pipe pressure or radio coverage.

The scene board is a schematic farm plan, not a survey. Crop and growth settings are scenarios unless explicitly backed by observations. The turbine uses a simplified wind response rather than a certified production curve. Hardware presets reference METER TEROS 12, Davis Vantage Pro2 and Bergey EXCEL 15; selecting a preset does not establish ownership or install a sensor.

## Earth observations

NASA GIBS supplies 11 image products: SMAP surface/root-zone context, IMERG, MODIS/VIIRS vegetation, MODIS temperature, GLDAS soil moisture, SRTM relief, HLS Landsat/Sentinel reflectance and GEDI canopy context. Product dates resolve against advertised availability intervals. Field images are clipped to the entire polygon. Native resolution, date, legend, missing coverage and attribution remain visible. Zooming enlarges original pixels and does not invent finer measurements.

Existing Sentinel-2 evidence computes NDVI from source bands with pixel-quality filtering. Low-index evidence points can anchor annotations in the 3D plot. The review is an explainable rule engine: it identifies disconnected equipment, energy deficits, stale telemetry and limited observation coverage. It is not an LLM diagnosis. ECOSTRESS and the remaining supplied USDA/ESA resources are listed with access and coverage requirements; a resource link is not a completed integration.

## Missions and time

The mission library contains 12 mission/instrument entries, official sources, specifications, videos and direct links to relevant field layers. Six local official NASA/JPL models are reused where appropriate. Other models are explicitly schematic. ECOSTRESS and GEDI are instruments on ISS; SRTM is historical. Current VIIRS context uses NOAA-20; Suomi NPP is marked archival.

Current orbit elements come from CelesTrak, with source, epoch and age. SGP4 propagates positions at UTC. Elements older than seven days are not used by the mission and field pass viewers. A nominal swath intersection is a geometric proximity estimate, not proof of acquisition. The separate solar-system playground uses Astronomy Engine planet directions with compressed distances. Its Moon, ISS and comet are illustrative and labeled accordingly.

## Farms and events

Twelve FTW model-derived boundaries: eight USA, two Europe, two Ukraine. Full source polygons, IDs and licensing are documented in GLOBAL_FIELD_SOURCES.md. Imports are idempotent. Farm operators and crop assignments are explicitly educational scenarios. Optional reported production/jobs/local supply statistics are user declarations; no national economic contribution is fabricated.

NASA RSS provides project-relevant headlines. NOAA NWS warning polygons intersect actual field geometries to identify affected fields. Missing warning geometry is reported as unknown. There is no claim of operational warning coverage for Europe/Ukraine. Provider errors and freshness are exposed.

## Operations

Run Alembic through revision 0004 before starting the API. Public catalogues and geometry snapshots are packaged with the backend. Provider requests have timeouts and bounded caches; keys stay server-side. NASA POWER season histories are stored per field, independently of graphical satellite overlays. External providers can be delayed or unavailable; the UI reports this rather than substituting fabricated observations.
