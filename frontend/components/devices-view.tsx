'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Radio, Wifi, Battery, BatteryCharging, Plus, Play, RefreshCw, Cpu, Activity, Clock, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import type { Device, SensorMeasurement, Field, Lang } from '@/lib/types';
import type { Copy } from '@/lib/i18n';

export default function DevicesView({
  fields,
  selectedFieldId,
  t,
  lang,
}: {
  fields: Field[];
  selectedFieldId?: string;
  t: Copy;
  lang: Lang;
}) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState<Device['device_type']>('soil_moisture');
  const [serial, setSerial] = useState('');
  const [connectivity, setConnectivity] = useState<Device['connectivity']>('cellular_4g');
  const [fieldId, setFieldId] = useState(selectedFieldId || fields[0]?.id || '');
  const [msg, setMsg] = useState('');

  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () => api<Device[]>('/devices'),
  });

  const telemetryQuery = useQuery({
    queryKey: ['telemetry'],
    queryFn: () => api<SensorMeasurement[]>('/telemetry?limit=40'),
  });

  const simulateMutation = useMutation({
    mutationFn: () => api('/telemetry/simulate', { field_id: fieldId || fields[0]?.id, days: 7 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['telemetry'] });
      setMsg(t.simulatedSuccess);
      setTimeout(() => setMsg(''), 4000);
    },
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api('/devices', {
        name,
        device_type: deviceType,
        serial_number: serial,
        connectivity,
        field_id: fieldId || null,
        battery_pct: 100,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setShowAdd(false);
      setName('');
      setSerial('');
      setMsg(t.saved);
      setTimeout(() => setMsg(''), 4000);
    },
  });

  const devices = devicesQuery.data || [];
  const telemetry = telemetryQuery.data || [];

  function formatTime(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString(lang === 'uk' ? 'uk-UA' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: '2-digit', month: '2-digit' });
  }

  const deviceTypeNames: Record<string, string> = {
    soil_moisture: lang === 'uk' ? 'Датчик вологості ґрунту' : 'Soil moisture probe',
    soil_temperature: lang === 'uk' ? 'Датчик температури ґрунту' : 'Soil temperature sensor',
    weather_station: lang === 'uk' ? 'Польова метеостанція' : 'Field weather station',
    rain_gauge: lang === 'uk' ? 'Електронний опадомір' : 'Digital rain gauge',
    lora_gateway: lang === 'uk' ? 'LoRaWAN шлюз / ретранслятор' : 'LoRaWAN Gateway',
  };

  const metricNames: Record<string, string> = {
    moisture_pct: lang === 'uk' ? 'Вологість' : 'Moisture',
    temp_c: lang === 'uk' ? 'Температура' : 'Temperature',
    rainfall_mm: lang === 'uk' ? 'Опади' : 'Rainfall',
    solar_w_m2: lang === 'uk' ? 'Сонячна радіація' : 'Solar radiation',
    ec_ds_m: lang === 'uk' ? 'Електропровідність' : 'EC',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF', borderRadius: 16 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="icon-chip" style={{ background: '#EAF4E6', color: '#176B45', padding: '6px', borderRadius: 10 }}>
                <Cpu size={22} />
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0B3D2E' }}>{t.deviceTitle}</h2>
            </div>
            <p className="muted small" style={{ marginTop: '0.25rem' }}>{t.deviceSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              disabled={simulateMutation.isPending || fields.length === 0}
              onClick={() => simulateMutation.mutate()}
            >
              <Play size={15} /> {simulateMutation.isPending ? t.loading : t.simulateBtn}
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} /> {t.addDeviceBtn}
            </Button>
          </div>
        </div>
        {msg && (
          <p className="tag green" style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> {msg}
          </p>
        )}
      </div>

      {/* Devices List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {devicesQuery.isPending ? (
          [1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 160 }} />)
        ) : devices.length === 0 ? (
          <div className="card empty col-span-3">
            <Cpu size={36} className="muted" />
            <h3>{t.noData}</h3>
          </div>
        ) : (
          devices.map(dev => (
            <article key={dev.id} className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: 14 }}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="tag green" style={{ fontSize: '0.75rem' }}>
                    {dev.connectivity.toUpperCase()}
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '0.4rem', color: '#0B3D2E' }}>
                    {dev.name}
                  </h3>
                  <p className="micro muted">{deviceTypeNames[dev.device_type] || dev.device_type}</p>
                </div>
                <span
                  className="status-dot"
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: dev.status === 'online' ? '#176B45' : '#D9534F',
                  }}
                  title={dev.status}
                />
              </div>

              <div className="space-y-2 text-xs" style={{ marginTop: '1rem', borderTop: '1px solid #f0f4ee', paddingTop: '0.75rem' }}>
                <div className="flex justify-between text-muted">
                  <span>{t.deviceSerial}:</span>
                  <strong style={{ color: '#17251C', fontFamily: 'monospace' }}>{dev.serial_number}</strong>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>{t.batteryLevel}:</span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#176B45' }}>
                    <Battery size={14} /> {dev.battery_pct != null ? `${Math.round(dev.battery_pct)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>{t.lastPing}:</span>
                  <span>{formatTime(dev.last_seen_at)}</span>
                </div>
              </div>

              {dev.is_demo && (
                <div style={{ marginTop: '0.75rem' }}>
                  <span className="tag" style={{ background: '#f0f3eb', color: '#738078', fontSize: '0.68rem' }}>
                    DEMO SIMULATOR
                  </span>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Telemetry Stream */}
      <section className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF', borderRadius: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0B3D2E' }}>{t.telemetryTitle}</h3>
            <p className="muted small">In-situ measurements vs space-borne reanalysis</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['telemetry'] });
            }}
          >
            <RefreshCw size={14} />
          </Button>
        </div>

        {telemetry.length === 0 ? (
          <p className="muted small">{t.noData}. Натисніть «{t.simulateBtn}» для перегляду демо-потоку.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8ece5', color: '#738078', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Час / Дата</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Показник</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Значення</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Пристрій</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Походження</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.slice(0, 15).map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f2f5ef' }}>
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{formatTime(m.timestamp)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: '#0B3D2E' }}>
                      {metricNames[m.metric] || m.metric}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>
                      {m.value} {m.unit}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#738078' }}>
                      {devices.find(d => d.id === m.device_id)?.name || m.device_id.slice(0, 8)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span className={`tag ${m.is_demo ? '' : 'green'}`} style={{ fontSize: '0.7rem' }}>
                        {m.is_demo ? 'СИМУЛЯЦІЯ' : 'ФІЗИЧНИЙ ДАТЧИК'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Device Modal */}
      {showAdd && (
        <div className="modal-backdrop">
          <section role="dialog" aria-modal="true" className="editor" style={{ maxWidth: 520 }}>
            <header>
              <div>
                <p className="eyebrow">FIELDSHIFT / IoT</p>
                <h2>{t.addDeviceBtn}</h2>
              </div>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </Button>
            </header>
            <form
              onSubmit={e => {
                e.preventDefault();
                addMutation.mutate();
              }}
              className="space-y-4"
              style={{ padding: '1rem 0' }}
            >
              <label>
                {t.name}
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ґрунтовий зонд №3" />
              </label>

              <div className="form-row">
                <label>
                  {t.deviceType}
                  <select value={deviceType} onChange={e => setDeviceType(e.target.value as any)}>
                    <option value="soil_moisture">Датчик вологості ґрунту</option>
                    <option value="soil_temperature">Датчик температури ґрунту</option>
                    <option value="weather_station">Метеостанція</option>
                    <option value="rain_gauge">Опадомір</option>
                    <option value="lora_gateway">LoRaWAN шлюз</option>
                  </select>
                </label>
                <label>
                  {t.connectivityStatus}
                  <select value={connectivity} onChange={e => setConnectivity(e.target.value as any)}>
                    <option value="cellular_4g">4G LTE Cellular</option>
                    <option value="starlink">Starlink Satellite</option>
                    <option value="lorawan">LoRaWAN Mesh</option>
                  </select>
                </label>
              </div>

              <label>
                {t.deviceSerial}
                <input required value={serial} onChange={e => setSerial(e.target.value)} placeholder="FS-SM-2026-XXX" />
              </label>

              <label>
                {t.selectedField}
                <select value={fieldId} onChange={e => setFieldId(e.target.value)}>
                  {fields.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>

              <footer>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={addMutation.isPending || !name || !serial}>
                  {addMutation.isPending ? t.saving : t.save}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
