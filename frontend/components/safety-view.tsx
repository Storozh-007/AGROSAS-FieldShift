'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  ShieldAlert,
  PhoneCall,
  Zap,
  Wifi,
  Radio,
  Fuel,
  BatteryCharging,
  CheckCircle2,
  ExternalLink,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import type { ResilienceStatus, Lang } from '@/lib/types';
import type { Copy } from '@/lib/i18n';

export default function SafetyView({ t, lang }: { t: Copy; lang: Lang }) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    'ch-1': true,
    'ch-2': true,
  });

  const safetyQuery = useQuery({
    queryKey: ['safety'],
    queryFn: () => api<ResilienceStatus>('/safety?region=Полтавська+область'),
  });

  const data = safetyQuery.data;

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Primary Resilience Header */}
      <section className="card" style={{ padding: '1.5rem', background: '#FFFFFF', borderRadius: 16 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="icon-chip"
              style={{ background: '#EAF4E6', color: '#176B45', padding: '10px', borderRadius: 12 }}
            >
              <ShieldCheck size={28} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0B3D2E' }}>{t.safetyTitle}</h2>
                <span className="tag green" style={{ fontWeight: 600 }}>
                  UKRAINE RESILIENCE
                </span>
              </div>
              <p className="muted small" style={{ marginTop: '0.25rem' }}>{t.safetyBody}</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <a href="https://dsns.gov.ua/" target="_blank" rel="noreferrer">
              {t.safetyLink} <ExternalLink size={14} />
            </a>
          </Button>
        </div>
      </section>

      {/* Grid: Air Alert + Backup Power + Connectivity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Air Alert Status */}
        <article className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: 14 }}>
          <div className="flex items-center justify-between">
            <span className="eyebrow" style={{ color: '#738078' }}>
              {t.airAlert}
            </span>
            <span className="tag green" style={{ fontSize: '0.72rem' }}>
              {data?.air_alert.is_active ? 'ТРИВОГА' : 'БЕЗ ТРИВОГИ'}
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0B3D2E' }}>
              {data?.air_alert.is_active ? 'Увага! Повітряна тривога' : t.alertSafe}
            </h3>
            <p className="micro muted" style={{ marginTop: '0.4rem', lineHeight: 1.45 }}>
              {data?.air_alert.disclaimer || 'Орієнтуйтеся на офіційні канали цивільного захисту.'}
            </p>
          </div>
        </article>

        {/* Backup Power */}
        <article className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: 14 }}>
          <div className="flex items-center justify-between">
            <span className="eyebrow" style={{ color: '#738078' }}>
              {t.backupPowerTitle}
            </span>
            <span className="tag green" style={{ fontSize: '0.72rem' }}>
              МЕРЕЖА 220V
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }} className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <Fuel size={14} /> Дизель-генератор:
              </span>
              <strong style={{ color: '#176B45' }}>
                {data?.backup_power.generator_fuel_hours ?? 64} {t.fuelHoursLeft}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <BatteryCharging size={14} /> Акумуляторна станція:
              </span>
              <strong style={{ color: '#176B45' }}>
                {data?.backup_power.battery_soc_pct ?? 95}% ({data?.backup_power.battery_storage_kwh ?? 14.5} кВт·год)
              </strong>
            </div>
          </div>
        </article>

        {/* Communications */}
        <article className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: 14 }}>
          <div className="flex items-center justify-between">
            <span className="eyebrow" style={{ color: '#738078' }}>
              {t.connectivityStatus}
            </span>
            <span className="tag green" style={{ fontSize: '0.72rem' }}>
              ONLINE
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }} className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <Wifi size={14} /> Starlink Internet:
              </span>
              <strong style={{ color: '#176B45' }}>
                {data?.connectivity.starlink.latency_ms ?? 34} ms (99.8% uptime)
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <Radio size={14} /> 4G LTE Cellular:
              </span>
              <strong style={{ color: '#176B45' }}>Оперативно (Kyivstar/VF)</strong>
            </div>
          </div>
        </article>
      </div>

      {/* Safety Checklist & Emergency Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personnel Field Safety Checklist */}
        <section className="card" style={{ padding: '1.5rem', background: '#FFFFFF', borderRadius: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0B3D2E', marginBottom: '0.25rem' }}>
            {t.checklistTitle}
          </h3>
          <p className="muted small" style={{ marginBottom: '1.25rem' }}>
            Обов'язковий інструктаж перед початком польових робіт
          </p>

          <div className="space-y-3">
            {(data?.checklist || []).map(item => {
              const isChecked = !!checkedItems[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: 10,
                    background: isChecked ? '#f4f8f2' : '#f9faf7',
                    border: isChecked ? '1px solid #d4e7cd' : '1px solid #eef2ea',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(item.id)}
                    style={{ marginTop: 3, accentColor: '#176B45' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center justify-between">
                      <strong style={{ fontSize: '0.9rem', color: '#17251C' }}>{item.title}</strong>
                      <span className={`tag ${item.mandatory ? 'amber' : ''}`} style={{ fontSize: '0.65rem' }}>
                        {item.mandatory ? t.mandatory : t.optional}
                      </span>
                    </div>
                    <p className="micro muted" style={{ marginTop: '0.25rem', lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Emergency Hotlines */}
        <section className="card" style={{ padding: '1.5rem', background: '#FFFFFF', borderRadius: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0B3D2E', marginBottom: '0.25rem' }}>
            {t.emergencyHotlines}
          </h3>
          <p className="muted small" style={{ marginBottom: '1.25rem' }}>
            Офіційні екстрені контакти та служби оперативного реагування
          </p>

          <div className="space-y-3">
            {(data?.contacts || []).map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'between',
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  background: '#f8f9f5',
                  border: '1px solid #e8ede5',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2">
                    <strong style={{ fontSize: '0.95rem', color: '#0B3D2E' }}>{c.phone}</strong>
                    <span className="muted small">· {c.title}</span>
                  </div>
                  <p className="micro muted" style={{ marginTop: '0.2rem' }}>
                    {c.description}
                  </p>
                </div>
                <Button asChild variant="outline" style={{ marginLeft: '0.75rem' }}>
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1.5">
                    <PhoneCall size={14} /> {t.callNow}
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
