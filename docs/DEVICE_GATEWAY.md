# Device → decision → result

1. Register the actual device under **Обладнання та датчики**, assign its field and retain its returned ID. A 3D object is an inventory/planning item; it does not register a physical sensor automatically.
2. In Farm Lab, add a probe/weather station, choose that device in **Привʼязаний пристрій**, and save the design. Labels show saved readings with DEVICE, DEMO or stale provenance. Readings older than six hours are marked stale. The device table refreshes every 15 seconds.
3. On a trusted local gateway, set `APP_TOKEN` privately in its environment and optionally `AGROSAS_API_URL` (default `http://127.0.0.1:8000`). Run `.venv/bin/python scripts/ingest_sensor.py`, feeding newline-delimited JSON from your real adapter, for example:

```json
{"device_id":"YOUR_REGISTERED_DEVICE_ID","metric":"moisture_pct","value":24.8,"unit":"%","timestamp":"2026-11-13T12:00:00Z"}
```

The timestamp and value above are an illustrative payload, not measurements. Replace both with the sensor reading. Supported metrics: moisture_pct, temp_c, rainfall_mm, ec_ds_m, solar_w_m2. POST `/api/telemetry` accepts the same schema and bearer authentication. Keep the application token on the trusted gateway/server, not in browser code or publicly deployed sensor firmware. A gateway should accept only devices it trusts.

4. Under **План на 72 години**, a non-demo soil-moisture record from the last six hours can explicitly initialize the scenario. Initial moisture otherwise remains a user-supplied assumption. The soil property and root-zone assumptions must still be checked: a single probe does not establish the whole field's soil profile.
5. Calculate the conditional plan, inspect shortages and assumptions, and save it to the journal. Journal completion and actual water/energy figures are user reports; they are not automatically verified metering.

The application does not send pump commands. There is no attached physical sensor in this development session; the adapter and authenticated ingest route are ready for connection. Sensor calibration, field placement and network transport are deployment-specific.
