'use client';
import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, setWorkerUrl, NavigationControl, GeolocateControl, Marker, LngLatBounds, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import { Layers, RotateCcw, Search, Trash2 } from 'lucide-react';
import type { Geometry } from '@/lib/types';
import type { Copy } from '@/lib/i18n';
import { centroid, openRing, parseLatLon, polygonAreaHa, perimeterKm } from '@/lib/geo';

type Place = { display_name: string; lon: string; lat: string; boundingbox?: string[] };
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export default function FieldMap({ geometry, editing = false, onChange, t }: { geometry?: Geometry; editing?: boolean; onChange?: (g: Geometry) => void; t: Copy }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const areaMarker = useRef<Marker | null>(null);
  const callback = useRef(onChange);
  const current = useRef(geometry);
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  callback.current = onChange;
  current.current = geometry;
  const ring = openRing(geometry?.coordinates[0] || []);
  const area = polygonAreaHa(ring);

  useEffect(() => {
    if (!container.current) return;
    setWorkerUrl('/maplibre-worker.mjs');
    let m: MapLibreMap;
    try {
      m = new MapLibreMap({
        container: container.current, center: [34.466, 49.622], zoom: 12, maxZoom: 19, attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            satellite: { type: 'raster', tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: '© Esri, Maxar, Earthstar Geographics' },
            labels: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
            streets: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 },
          },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#d8dfcd' } },
            { id: 'satellite', type: 'raster', source: 'satellite' },
            { id: 'labels', type: 'raster', source: 'labels' },
            { id: 'streets', type: 'raster', source: 'streets', layout: { visibility: 'none' } },
          ],
        },
      });
    } catch { setError(true); return; }
    map.current = m;
    m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    if (editing) m.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 15 } }), 'bottom-right');
    m.on('error', event => { if (!String((event as unknown as { error?: { message?: string } }).error?.message || '').includes('tile')) setError(true); });
    m.once('style.load', () => {
      m.addSource('boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'field-fill', type: 'fill', source: 'boundary', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#f2c94c', 'fill-opacity': .32 } });
      m.addLayer({ id: 'field-line', type: 'line', source: 'boundary', paint: { 'line-color': '#ffd84d', 'line-width': 3, 'line-dasharray': editing ? [2, 1.4] : [1, 0] } });
      const initial = openRing(current.current?.coordinates[0] || []);
      if (initial.length >= 3) { const bounds = new LngLatBounds(); initial.forEach(p => bounds.extend(p as [number, number])); m.fitBounds(bounds, { padding: 65, duration: 0, maxZoom: 16 }); }
      setReady(true);
    });
    if (editing) {
      m.getCanvas().style.cursor = 'crosshair';
      m.doubleClickZoom.disable();
      m.on('click', (e: MapLayerMouseEvent) => { const next = [...openRing(current.current?.coordinates[0] || []), [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))]]; callback.current?.({ type: 'Polygon', coordinates: [[...next, next[0]]] }); });
    }
    return () => { markers.current.forEach(marker => marker.remove()); markers.current = []; areaMarker.current?.remove(); areaMarker.current = null; m.remove(); map.current = null; };
  // Map lifetime follows editing mode; geometry is updated separately.
  }, [editing]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const pts = openRing(geometry?.coordinates[0] || []);
    const features: GeoJSON.Feature[] = pts.length >= 3 ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } }] : pts.length === 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }] : [];
    (m.getSource('boundary') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features });
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    if (editing) pts.forEach((p, index) => {
      const el = document.createElement('div'); el.className = 'vertex-handle';
      const marker = new Marker({ element: el, draggable: true }).setLngLat(p as [number, number]).addTo(m);
      marker.on('drag', () => { const updated = openRing(current.current?.coordinates[0] || []).map(point => [...point]); const position = marker.getLngLat(); updated[index] = [position.lng, position.lat]; (m.getSource('boundary') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: updated.length >= 3 ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...updated, updated[0]]] } }] : [] }); });
      marker.on('dragend', () => { const updated = openRing(current.current?.coordinates[0] || []).map(point => [...point]); const position = marker.getLngLat(); updated[index] = [Number(position.lng.toFixed(6)), Number(position.lat.toFixed(6))]; callback.current?.({ type: 'Polygon', coordinates: [[...updated, updated[0]]] }); });
      markers.current.push(marker);
    });
    areaMarker.current?.remove(); areaMarker.current = null;
    const center = centroid(pts);
    if (pts.length >= 3 && center) {
      const label = document.createElement('div'); label.className = 'area-label'; label.textContent = `${polygonAreaHa(pts).toFixed(1)} га`;
      areaMarker.current = new Marker({ element: label }).setLngLat(center).addTo(m);
    }
    if (!editing && pts.length >= 3) { const bounds = new LngLatBounds(); pts.forEach(p => bounds.extend(p as [number, number])); m.fitBounds(bounds, { padding: 65, maxZoom: 16, duration: 600 }); }
  }, [geometry, ready, editing]);

  useEffect(() => { const m = map.current; if (m && ready) { m.setLayoutProperty('satellite', 'visibility', satellite ? 'visible' : 'none'); m.setLayoutProperty('labels', 'visibility', satellite ? 'visible' : 'none'); m.setLayoutProperty('streets', 'visibility', satellite ? 'none' : 'visible'); } }, [satellite, ready]);

  function flyTo(lon: number, lat: number, bbox?: string[]) {
    const m = map.current; if (!m) return; setPlaces([]);
    if (bbox?.length === 4) m.fitBounds([[Number(bbox[2]), Number(bbox[0])], [Number(bbox[3]), Number(bbox[1])]], { maxZoom: 15, duration: 900 });
    else m.flyTo({ center: [lon, lat], zoom: 15, duration: 900 });
  }
  async function search(e: React.FormEvent) {
    e.preventDefault(); setSearchError('');
    const coords = parseLatLon(query); if (coords) { flyTo(coords[0], coords[1]); return; }
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=uk,en&q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error();
      const found: Place[] = await response.json();
      if (!found.length) setSearchError('Нічого не знайдено. Спробуйте село, район або координати «49.62, 34.46».');
      else if (found.length === 1) flyTo(Number(found[0].lon), Number(found[0].lat), found[0].boundingbox);
      else setPlaces(found);
    } catch { setSearchError('Пошук недоступний. Введіть координати «широта, довгота».'); }
    finally { setSearching(false); }
  }

  return <div className={`map-wrap${editing ? ' map-wrap-editing' : ''}`}>
    <div ref={container} className="map-canvas" aria-label={t.map} />
    {error && <div className="map-error" role="status">{t.mapFailed}</div>}
    {editing && <form className="map-search" role="search" onSubmit={search}>
      <input aria-label="Пошук місця" placeholder="Пошук: село, район або 49.62, 34.46" value={query} onChange={e => setQuery(e.target.value)} />
      <button type="submit" aria-label="Знайти" disabled={searching}><Search size={16} /></button>
      {places.length > 0 && <ul>{places.map(p => <li key={`${p.lat},${p.lon}`}><button type="button" onClick={() => flyTo(Number(p.lon), Number(p.lat), p.boundingbox)}>{p.display_name}</button></li>)}</ul>}
      {searchError && <p role="status">{searchError}</p>}
    </form>}
    <button type="button" className="map-layer" onClick={() => setSatellite(!satellite)}><Layers size={16} />{satellite ? t.satellite : t.streets}</button>
    {editing && <div className="map-edit-controls">
      <button type="button" disabled={!ring.length} onClick={() => { const next = ring.slice(0, -1); callback.current?.({ type: 'Polygon', coordinates: [next.length ? [...next, next[0]] : []] }); }}><RotateCcw size={15} />{t.undo}</button>
      <button type="button" disabled={!ring.length} onClick={() => callback.current?.({ type: 'Polygon', coordinates: [[]] })}><Trash2 size={15} />{t.clear}</button>
    </div>}
    <div className="map-caption"><span className="boundary-key" />{ring.length >= 3 ? `${area.toFixed(1)} га · периметр ${perimeterKm(ring).toFixed(2)} км · ${ring.length} вершин` : editing ? 'Клацайте по краях поля на знімку — площа порахується автоматично' : t.boundaries}</div>
  </div>;
}
