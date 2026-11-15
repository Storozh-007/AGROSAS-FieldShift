'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Save } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import { cropNames, type Copy } from '@/lib/i18n';
import type { Field, Geometry, Lang } from '@/lib/types';
const FieldMap = dynamic(() => import('./field-map'), { ssr: false });
export default function FieldEditor({ field, t, lang, onClose, onSaved }: { field?: Field; t: Copy; lang: Lang; onClose: () => void; onSaved: (f: Field) => void }) {
  const [name, setName] = useState(field?.name || '');
  const [geometry, setGeometry] = useState<Geometry>(field?.geometry || { type: 'Polygon', coordinates: [[]] });
  const [soil, setSoil] = useState(field?.soil_type || 'unknown');
  const [ph, setPh] = useState(field?.soil_ph?.toString() || '');
  const [irrigation, setIrrigation] = useState(field?.irrigation || false);
  const [crops, setCrops] = useState(field?.crop_history || ['wheat', 'maize', 'sunflower']);
  const [geojson, setGeojson] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function save(e: React.FormEvent) { e.preventDefault(); setPending(true); setError(''); try { const saved = await api<Field>(field ? `/fields/${field.id}` : '/fields', { name, geometry, soil_type: soil, soil_ph: ph ? Number(ph) : null, irrigation, crop_history: crops, priorities: field?.priorities || { water: 30, soil: 30, resilience: 25, economy: 15 } }, field ? 'PUT' : 'POST'); onSaved(saved); } catch (e) { setError((e as Error).message); } finally { setPending(false); } }
  function importGeo(value: string) { setGeojson(value); if (!value.trim()) return; try { const obj = JSON.parse(value); const geom = obj.type === 'Feature' ? obj.geometry : obj; if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates?.[0]) || geom.coordinates[0].length < 4) throw Error(); setGeometry(geom); setError(''); } catch { setError(t.geoError); } }
  return <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="editor-title" className="editor"><header><div><p className="eyebrow">FIELDSHIFT / {t.fields}</p><h2 id="editor-title">{field ? t.edit : t.addField}</h2></div><Button variant="ghost" onClick={onClose} aria-label={t.cancel}><X /></Button></header><form onSubmit={save}><div className="editor-grid"><div className="form-fields"><label>{t.name}<input autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><div className="form-row"><label>{t.soil}<select value={soil} onChange={e => setSoil(e.target.value)}>{(['unknown', 'loam', 'clay', 'sand'] as const).map(key => <option key={key} value={key}>{t[key]}</option>)}</select></label><label>{t.ph}<input type="number" min="3" max="10" step="0.1" value={ph} onChange={e => setPh(e.target.value)} /></label></div><label className="checkbox-label"><input type="checkbox" checked={irrigation} onChange={e => setIrrigation(e.target.checked)} />{t.irrigation}</label><label>{t.cropHistory}</label><div className="crop-inputs">{crops.map((crop, i) => <div key={i}><span>{i + 1}</span><select aria-label={`${t.cropHistory} ${i + 1}`} value={crop} onChange={e => setCrops(crops.map((c, j) => j === i ? e.target.value : c))}>{Object.entries(cropNames[lang]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{crops.length > 1 && <button type="button" aria-label={`${t.delete} ${i + 1}`} onClick={() => setCrops(crops.filter((_, j) => j !== i))}><X size={15} /></button>}</div>)}</div><Button type="button" variant="outline" disabled={crops.length >= 8} onClick={() => setCrops([...crops, 'wheat'])}>+ {t.rotation}</Button><label>{t.geojson}<textarea aria-label="GeoJSON" rows={3} value={geojson} onChange={e => importGeo(e.target.value)} placeholder='{"type":"Polygon","coordinates":[…]}' /></label></div><div><h3>{t.draw}</h3><p className="muted small">{t.drawHint}</p><FieldMap geometry={geometry} editing onChange={setGeometry} t={t} /><p className="muted small">{t.points}: {Math.max(0, geometry.coordinates[0].length - 1)} · WGS84 / EPSG:4326</p></div></div>{error && <p role="alert" className="error">{error}</p>}<footer><Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t.cancel}</Button><Button type="submit" disabled={pending || geometry.coordinates[0].length < 4}><Save size={16} />{pending ? t.saving : t.save}</Button></footer></form></section></div>;
}
