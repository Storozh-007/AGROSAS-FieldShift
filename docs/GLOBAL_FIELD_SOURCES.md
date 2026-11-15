# Global field geometry reference snapshot

Retrieved 13 November 2026 from the [Fields of The World global dataset](https://source.coop/ftw/global-data), published by Taylor Geospatial and Microsoft AI for Good under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Primary dataset documentation: [vector collection](https://data.source.coop/ftw/global-data/predictions/vectors/collection.json), [vector README](https://data.source.coop/ftw/global-data/predictions/vectors/README.md), [project](https://fieldsofthe.world/).

The snapshot contains twelve complete source GeoParquet polygons: eight in the United States, two elsewhere in Europe, and two in Ukraine. Coordinates were neither clipped to a vector tile nor simplified. The selection used bounding-box filters, observation year 2025, one exterior ring, valid Polygon geometry, fewer than 900 vertices, and source areas between 10 and 90 hectares. From candidates in each reference region, a polygon with area near 40 ha was chosen. This is a demonstration portfolio selection, not a representative statistical sample.

**These are model-derived remote-sensing field units, not surveyed legal/cadastral parcels or ownership records.** FTW uses the PRUE model with Sentinel-2 median composites at nominal 10 m resolution. Boundary errors, omissions, merged fields and seasonal changes remain possible. A clear image overlay does not make the source boundary survey accurate. Users should verify/edit a boundary against suitable current imagery or their own survey before operational use.

Every feature in `backend/app/data/global_fields.geojson` retains the upstream field ID, source asset URL, country/subdivision values, determination timestamp/method, source area, and confidence. Geodesic area in hectares is additionally calculated using WGS84. Timestamps are normalized to UTC.

The confidence score is provider-estimated reliability sampled from a **500 m confidence grid** and rescaled to 0–100; it is **not individual-polygon positional accuracy**. U.S. selections have null confidence because the confidence product is sparse outside its supported/training coverage. Null is retained and must be displayed as unavailable, not zero or an invented score.

The dataset provides no owner identity, farm business, crop species, actual yield, jobs or national economic contribution for these features. Those fields remain null/unknown. Any displayed crop, equipment or operator assigned by an application user must be identified as user-declared or demonstration content, separate from this boundary source.

| Country | Reference region | Source field ID | WGS84 area (ha) | Source confidence | Vertices |
| --- | --- | --- | ---: | ---: | ---: |
| US | Iowa | 309620 | 39.90 | unavailable | 141 |
| US | Nebraska | 400307 | 39.56 | unavailable | 15 |
| US | Kansas | 867069 | 40.40 | unavailable | 293 |
| US | Illinois | 211114 | 40.25 | unavailable | 95 |
| US | California | 1397875 | 39.45 | unavailable | 65 |
| US | Texas | 1821157 | 38.22 | unavailable | 61 |
| US | Minnesota | 357897 | 38.30 | unavailable | 131 |
| US | North Dakota | 653283 | 39.38 | unavailable | 97 |
| FR | Centre-Val de Loire | 186496 | 36.42 | 96.42 | 355 |
| DE | Saxony-Anhalt | 15902 | 40.25 | 98.72 | 91 |
| UA | Poltava region | 244057 | 39.73 | 95.36 | 273 |
| UA | Vinnytsia region | 209228 | 39.05 | 94.50 | 379 |

Total selected WGS84 area: **470.91 ha**. This is monitored reference area, not production or national benefit.

Extraction used DuckDB HTTP range reads against the per-state/per-country GeoParquet assets. No whole-country file was saved locally. The application consumes the small static GeoJSON and does not need DuckDB at runtime. Each feature records its exact source URL.

Attribution: Contains modified Fields of The World (FTW) data, Taylor Geospatial and Microsoft AI for Good, CC BY 4.0. Modification consists of selecting individual full polygons, adding application reference labels and geodesic areas, and normalizing metadata timestamps; polygon coordinates are retained unchanged.
