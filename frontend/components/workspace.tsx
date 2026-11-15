'use client';
import { useEffect, useState } from 'react';
import Brand from './brand';
import RotationPlanner from './rotation-planner';
import ClimateTimeMachine from './climate-time-machine';
import EquipmentSensors from './equipment-sensors';
import DataSources from './data-sources';
import FieldPicker from './field-picker';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Leaf,
  Droplets,
  Sprout,
  ShieldCheck,
  LayoutDashboard,
  Map,
  Layers,
  Satellite,
  Orbit,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Thermometer,
  Download,
  Check,
  Menu,
  Globe,
  LoaderCircle,
  Pencil,
  Trash2,
  Info,
  X,
  Cpu,
  Share2,
} from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import { messages, strategyNames, cropNames, limitations } from '@/lib/i18n';
import type {
  Field,
  Dataset,
  Evaluation,
  Lang,
  Weights,
  VegetationObservation,
  AiExplanation,
} from '@/lib/types';

const FarmEarthExplorer = dynamic(() => import('./farm-earth-explorer'), { ssr: false, loading: () => <div className="farm-earth-placeholder skeleton" /> });

const FieldMap = dynamic(() => import('./field-map'), {
  ssr: false,
  loading: () => <div className="map-skeleton skeleton" />,
});
const FieldEditor = dynamic(() => import('./field-editor'), { ssr: false });
const ClimateChart = dynamic(() => import('./climate-chart'), { ssr: false });
const DevicesView = dynamic(() => import('./devices-view'), { ssr: false });
const SafetyView = dynamic(() => import('./safety-view'), { ssr: false });
const AiExplanationDialog = dynamic(() => import('./ai-explanation-dialog'), { ssr: false });

type View = 'overview' | 'fields' | 'analysis' | 'climate' | 'devices' | 'sources' | 'safety';

const defaultWeights: Weights = { water: 30, soil: 30, resilience: 25, economy: 15 };

export default function Workspace({ initialView = 'overview' }: { initialView?: View }) {
  const client = useQueryClient();
  const [lang, setLang] = useState<Lang>('uk');
  const [view, setView] = useState<View>(initialView);
  useEffect(() => {
    const sync = () => { const routes: Record<string, View> = { '/': 'overview', '/dashboard': 'overview', '/fields': 'fields', '/analysis': 'analysis', '/climate': 'climate', '/devices': 'devices', '/sources': 'sources', '/safety': 'safety' }; setView(routes[window.location.pathname] || initialView); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [initialView]);
  const [selectedId, setSelectedId] = useState('');
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('field');if(id)setSelectedId(id)},[]);
  const [editor, setEditor] = useState<Field | 'new' | null>(null);
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [online, setOnline] = useState(true);
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [temp, setTemp] = useState(0);
  const [rain, setRain] = useState(0);
  const [mode, setMode] = useState<'history' | 'scenario'>('history');
  const [showAiModal, setShowAiModal] = useState(false);

  const lastYear = new Date().getFullYear() - 1;
  const [start, setStart] = useState(`${lastYear}-04-01`);
  const [end, setEnd] = useState(`${lastYear}-09-30`);
  const [datasetId, setDatasetId] = useState('');

  const t = messages[lang];

  useEffect(() => {
    const saved = localStorage.getItem('fieldshift-language');
    if (saved === 'uk' || saved === 'en') setLang(saved);
    const change = () => setOnline(navigator.onLine);
    change();
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);

  const fieldsQuery = useQuery({
    queryKey: ['fields'],
    queryFn: () => api<Field[]>('/fields'),
  });

  const fields = fieldsQuery.data || [];
  const selected = fields.find(f => f.id === selectedId) || fields[0];

  useEffect(() => {
    if (selected) {
      setWeights(selected.priorities || defaultWeights);
      setDatasetId('');
      setTemp(0);
      setRain(0);
    }
  }, [selected?.id]);

  const observations = useQuery({
    queryKey: ['observations', selected?.id],
    queryFn: () => api<Dataset[]>(`/fields/${selected!.id}/observations`),
    enabled: !!selected,
  });

  const vegetationQuery = useQuery({
    queryKey: ['vegetation', selected?.id],
    queryFn: () => api<VegetationObservation[]>(`/fields/${selected!.id}/vegetation`),
    enabled: !!selected,
  });

  const dataset = observations.data?.find(d => d.id === datasetId) || observations.data?.[0];
  const latestVegetation = vegetationQuery.data?.[vegetationQuery.data.length - 1];

  const [debounced, setDebounced] = useState({ weights, temp: 0, rain: 0 });
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setDebounced({
          weights,
          temp: mode === 'scenario' ? temp : 0,
          rain: mode === 'scenario' ? rain : 0,
        }),
      180
    );
    return () => clearTimeout(timer);
  }, [weights, temp, rain, mode]);

  const validWeights = Object.values(debounced.weights).some(w => w > 0);

  const evaluation = useQuery({
    queryKey: ['evaluation', selected?.id, dataset?.id, debounced],
    queryFn: () =>
      api<Evaluation>('/scenarios/evaluate', {
        field_id: selected!.id,
        dataset_id: dataset!.id,
        weights: debounced.weights,
        temperature_delta: debounced.temp,
        precipitation_delta: debounced.rain,
      }),
    enabled: !!selected && !!dataset && validWeights,
    retry: false,
  });

  const aiRecommendation = useQuery({
    queryKey: ['ai-recommendation', selected?.id, dataset?.id, debounced, lang],
    queryFn: () =>
      api<{ evaluation: Evaluation; explanation: AiExplanation }>(
        `/recommendations?lang=${lang}`,
        {
          field_id: selected!.id,
          dataset_id: dataset!.id,
          weights: debounced.weights,
          temperature_delta: debounced.temp,
          precipitation_delta: debounced.rain,
        }
      ),
    enabled: !!selected && !!dataset && validWeights,
    retry: false,
  });

  const result = evaluation.data;
  const explanation = aiRecommendation.data?.explanation;

  const downloadPower = useMutation({
    mutationFn: () => api(`/nasa/power`, { field_id: selected!.id, start, end }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['observations', selected?.id] });
      await client.invalidateQueries({ queryKey: ['evaluation', selected?.id] });
      await client.invalidateQueries({ queryKey: ['ai-recommendation', selected?.id] });
      setDatasetId('');
      setToast(t.loaded);
    },
  });

  const syncHls = useMutation({
    mutationFn: () => api(`/nasa/hls`, { field_id: selected!.id }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['vegetation', selected?.id] });
      setToast(t.hlsSynced);
    },
  });

  const removeField = useMutation({
    mutationFn: (id: string) => api(`/fields/${id}`, undefined, 'DELETE'),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['fields'] });
      setToast(t.deleted);
    },
  });

  const nav: { id: View; icon: typeof Leaf; label: string }[] = [
    { id: 'overview', icon: LayoutDashboard, label: t.overview },
    { id: 'fields', icon: Map, label: t.fields },
    { id: 'analysis', icon: Sprout, label: t.analysis },
    { id: 'climate', icon: Orbit, label: t.climate },
    { id: 'devices', icon: Cpu, label: t.devices },
    { id: 'sources', icon: Satellite, label: t.sources },
  ];

  const criterionLabels: Record<keyof Weights, string> = {
    water: t.waterPriority,
    soil: t.soilPriority,
    resilience: t.resiliencePriority,
    economy: t.economyPriority,
  };

  function navigate(v: View) {
    window.history.pushState(null, '', ({ overview: '/dashboard', fields: '/fields', analysis: '/analysis', climate: '/climate', devices: '/devices', sources: '/sources', safety: '/safety' })[v]);
    setView(v);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB');
  }

  function exportGeoJson() {
    if (!selected) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selected.geometry, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${selected.name.replace(/\s+/g, '_')}_boundary.geojson`);
    dlAnchorElem.click();
  }

  const sourceForm = (
    <section className="card source-form">
      <div className="section-heading">
        <div className="icon-chip">
          <Satellite size={21} />
        </div>
        <div>
          <h3>NASA POWER</h3>
          <p className="muted small">{t.dataHint}</p>
        </div>
      </div>
      <div className="date-controls">
        <label>
          {t.from}
          <input
            aria-label={t.from}
            type="date"
            value={start}
            max={end}
            min="1981-01-01"
            onChange={e => setStart(e.target.value)}
          />
        </label>
        <label>
          {t.to}
          <input
            aria-label={t.to}
            type="date"
            value={end}
            min={start}
            max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
            onChange={e => setEnd(e.target.value)}
          />
        </label>
        <Button
          disabled={!selected || !online || downloadPower.isPending || !start || !end}
          onClick={() => downloadPower.mutate()}
        >
          {downloadPower.isPending ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}
          {downloadPower.isPending ? t.loading : dataset ? t.refresh : t.connect}
        </Button>
      </div>
      {downloadPower.isError && (
        <p className="error" role="alert">
          {t.error}: {downloadPower.error.message}
        </p>
      )}
      <p className="micro muted">{t.nasaHint}</p>
    </section>
  );

  const recommendationCard = (
    <section className="recommendation">
      <div className="recommendation-top">
        <span>
          <Sparkles size={17} /> FIELD INTELLIGENCE
        </span>
        <span className="ai-badge">{result ? result.model_version : 'NASA POWER'}</span>
      </div>
      <h2>{result ? strategyNames[lang][result.recommended] : t.startInsight}</h2>
      <p>
        {result
          ? `${t.strongest}: ${criterionLabels[result.explanation.strongest_contribution]}. ${t.margin}: +${result.explanation.margin} ${lang === 'uk' ? 'бала' : 'pts'}.`
          : t.startInsightBody}
      </p>
      {result && <p className="small">{t.nextMeasurement}</p>}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {result && explanation && (
          <button
            onClick={() => setShowAiModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              color: '#0B3D2E',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={15} style={{ color: '#176B45' }} /> {t.explained}
          </button>
        )}
        <button onClick={() => navigate(result ? 'analysis' : 'sources')}>
          {result ? t.openAnalysis : t.connect}
          <ArrowRight size={18} />
        </button>
      </div>
      <div className="recommendation-orbit" />
    </section>
  );

  return (
    <div className="app-shell">
      {/* Sidebar Desktop */}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <Link className="brand" href="/welcome">
          <Brand/>
        </Link>
        <Link className="orbital-nav-link" href="/earth"><Orbit size={16}/><span>EARTH OBSERVATORY</span><ArrowUpRight size={13}/></Link>
        <Link className="orbital-nav-link farm-lab-nav" href="/farm-lab"><Sprout size={16}/><span>FARM LAB / 3D</span><ArrowUpRight size={13}/></Link>
        <Link className="orbital-nav-link farm-lab-nav" href="/farm-lab#plan"><Droplets size={16}/><span>WATER × ENERGY / 72H</span><ArrowUpRight size={13}/></Link>
        <Link className="orbital-nav-link farm-lab-nav" href="/missions"><Satellite size={16}/><span>MISSION OBSERVATORY</span><ArrowUpRight size={13}/></Link><Link className="orbital-nav-link farm-lab-nav" href="/network"><Orbit size={16}/><span>GLOBAL FARMS / NEWS</span><ArrowUpRight size={13}/></Link><div className="farm-switch">
          <span className="farm-avatar">AG</span>
          <div>
            <strong>AGROSAS Global Farms</strong>
            <small>USA · Europe · Ukraine</small>
          </div>
          <ChevronDown size={14} />
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map(n => (
            <button
              key={n.id}
              className={view === n.id ? 'active' : ''}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {view === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`safety-nav ${view === 'safety' ? 'active' : ''}`}
            onClick={() => navigate('safety')}
          >
            <ShieldCheck size={18} />
            {t.safety}
            <span>UA</span>
          </button>
          <div className="space-note">
            <Orbit size={24} />
            <strong>From Space to Soil.</strong>
            <p>{t.independence}</p>
          </div>
          <div className="profile">
            <div className="profile-avatar">FS</div>
            <div>
              <strong>Team Astrology</strong>
              <small>{t.localMode}</small>
            </div>
          </div>
        </div>
      </aside>

      {menu && <button className="sidebar-scrim" aria-label={t.cancel} onClick={() => setMenu(false)} />}

      <div className="main-shell">
        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb">
            <button className="mobile-menu" aria-label={t.more} onClick={() => setMenu(!menu)}>
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === 'safety' ? t.safety : nav.find(n => n.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <i />
              {t.localMode}
            </span>
            <button
              className="language-button"
              onClick={() => { const next = lang === 'uk' ? 'en' : 'uk'; localStorage.setItem('fieldshift-language', next); setLang(next); }}
              aria-label="Change language"
            >
              <Globe size={16} />
              {lang.toUpperCase()}
            </button>
            <div className="top-avatar">FS</div>
          </div>
        </header>

        <main>
          {!online && <p role="status" className="notice">{t.offline}</p>}

          <div className={`page-heading ${view === 'overview' ? 'mission-page-heading' : ''}`}>
            <div>
              <p className="eyebrow">{view === 'overview' ? t.greeting : 'FIELDSHIFT / EARTH OS'}</p>
              <h1>
                {view === 'overview'
                  ? t.overview
                  : view === 'safety'
                  ? 'Ukraine Resilience'
                  : nav.find(n => n.id === view)?.label}
              </h1>
              <p className="muted">
                {view === 'overview'
                  ? t.subtitle
                  : view === 'analysis'
                  ? t.modelDisclaimer
                  : view === 'climate'
                  ? t.scenarioHint
                  : view === 'devices'
                  ? t.deviceSubtitle
                  : t.scope}
              </p>
            </div>
            <Button onClick={() => setEditor('new')}>
              <Plus size={18} />
              {t.addField}
            </Button>
          </div>

          {fieldsQuery.isError ? (
            <div className="card empty">
              <h2>{t.error}</h2>
              <p>{fieldsQuery.error.message}</p>
              <Button onClick={() => fieldsQuery.refetch()}>{t.retry}</Button>
            </div>
          ) : fieldsQuery.isPending ? (
            <div className="loading-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          ) : (
            <>
              {selected && (
                <div className="field-toolbar">
                  <FieldPicker fields={fields} value={selected.id} onChange={setSelectedId} label={t.choose} compact/>
                  <span className="muted small">
                    {fields.length} {t.fields.toLowerCase()}
                    <span className="separator">/</span>
                    {fields.reduce((sum, f) => sum + f.area_ha, 0).toFixed(1)} {t.hectares}
                  </span>
                </div>
              )}

              {!selected && !['safety', 'sources', 'devices'].includes(view) ? (
                <section className="card empty">
                  <Map size={42} />
                  <h2>{t.emptyFields}</h2>
                  <p>{t.emptyFieldsHint}</p>
                  <Button onClick={() => setEditor('new')}>
                    <Plus size={17} />
                    {t.addField}
                  </Button>
                </section>
              ) : (
                <>
                  {/* ================= VIEW: OVERVIEW ================= */}
                  {view === 'overview' && selected && (
                    <>
                      <section className="farm-purpose"><div><span className="eyebrow">WATER × ENERGY / FIELD OPERATIONS</span><h2>{lang==='uk'?'Сівозміна, яка витримає наступний сезон.':'Irrigate on time. Save water. Prepare for outages.'}</h2><p>{lang==='uk'?'Перевірте історію культур, порівняйте три стратегії й простежте зміни поля. Перетворіть спостереження на план робіт.':'Match the forecast, water reserve and equipment. Find feasible irrigation windows, save an action and review the result.'}</p></div><Link className="button button-primary" href={`/farm-lab?field=${selected.id}`}>{lang==='uk'?'Скласти план дій':'Build my action plan'}<ArrowRight size={16}/></Link></section><div className="overview-grid orbital-overview">
                        <section className="card map-card orbital-map-card">
                          <div className="section-heading spread">
                            <div><p className="eyebrow">MISSION / FARM OVERVIEW</p><h2>{lang === 'uk' ? 'Від орбіти — до вашого поля' : 'From orbit to your field'}</h2></div>
                            <span className="orbital-source-status"><span className="status-dot"/>ESRI IMAGERY / NASA POWER</span>
                          </div>
                          <FarmEarthExplorer fields={fields} selected={selected} onSelect={setSelectedId} lang={lang} dataset={dataset} evaluation={result} vegetation={latestVegetation} onLoad={() => downloadPower.mutate()} loading={downloadPower.isPending} onOpen={() => navigate('fields')} />
                        </section>

                        <div className="insight-column">
                          {recommendationCard}

                          <section className="card source-mini">
                            <div className="section-heading spread">
                              <h3>{t.sources}</h3>
                              <button className="icon-button" aria-label={t.sources} onClick={() => navigate('sources')}>
                                <ArrowUpRight size={18} />
                              </button>
                            </div>
                            <div>
                              <Satellite size={17} />
                              <span>
                                NASA POWER<small>{t.sourcePower}</small>
                              </span>
                              <span className={`tag ${dataset ? 'green' : ''}`}>
                                {dataset ? `${Math.round(dataset.coverage * 100)}%` : '—'}
                              </span>
                            </div>
                            <div>
                              <Layers size={17} />
                              <span>
                                NASA HLS<small>{t.sourceHls}</small>
                              </span>
                              <span className={`tag ${latestVegetation ? 'green' : ''}`}>
                                {latestVegetation ? `NDVI ${latestVegetation.ndvi_mean}` : t.notConnected}
                              </span>
                            </div>
                            <div>
                              <Droplets size={17} />
                              <span>
                                NASA SMAP<small>{t.sourceSmap}</small>
                              </span>
                              <span className="tiny muted">{t.notConnected}</span>
                            </div>
                          </section>
                        </div>
                      </div>

                      <div className="kpi-grid">
                        <Kpi
                          icon={<Leaf />}
                          label={t.vegetation}
                          value={latestVegetation ? `${latestVegetation.ndvi_mean}` : '—'}
                          foot={latestVegetation ? `${latestVegetation.is_demo ? 'DEMO · ' : ''}${latestVegetation.satellite} · ${latestVegetation.scene_date}` : t.noVegetation}
                        />
                        <Kpi
                          icon={<Droplets />}
                          label={result ? t.rain : t.water}
                          value={result ? `${result.climate.precipitation_mm}` : '—'}
                          unit={result ? 'mm' : ''}
                          foot={result ? `${t.season} · ${result.climate.seasons.join(', ')}` : t.noMoisture}
                          blue
                        />
                        <Kpi
                          icon={<ShieldCheck />}
                          label={t.risk}
                          value={result ? `${result.climate.stress_index}` : '—'}
                          foot={
                            result
                              ? `${t.relativeRisk} · ${result.scenario.conditional ? t.scenario : t.history}`
                              : t.noData
                          }
                        />
                        <Kpi
                          icon={<Sprout />}
                          label={t.rotation}
                          value={result ? result.recommended : 'S1'}
                          foot={result ? strategyNames[lang][result.recommended] : t.cropHistory.split(':')[0]}
                        />
                      </div>

                      {dataset ? (
                        <section className="card chart-card">
                          <div className="section-heading spread">
                            <div>
                              <h2>{t.climateHistory}</h2>
                              <p className="muted small">
                                {t.monthly} · {dataset.start} — {dataset.end}
                              </p>
                            </div>
                            <button className="text-link" onClick={() => navigate('climate')}>
                              {t.climate}
                              <ArrowUpRight size={16} />
                            </button>
                          </div>
                          <ClimateChart dataset={dataset} t={t} />
                          <p className="micro muted">
                            NASA POWER · {t.downloaded}: {formatDate(dataset.downloaded_at)} · {t.quality}:{' '}
                            {Math.round(dataset.coverage * 100)}%
                          </p>
                        </section>
                      ) : (
                        sourceForm
                      )}
                    </>
                  )}

                  {/* ================= VIEW: FIELDS (Field Explorer) ================= */}
                  {view === 'fields' && selected && (
                    <>
                      <section className="card map-card">
                        <div className="section-heading spread">
                          <div>
                            <h2>{selected.name}</h2>
                            <p className="muted small">
                              {selected.area_ha} {t.hectares} · {selected.is_demo ? t.exampleBoundary : t.userBoundary}
                            </p>
                          </div>
                          <div className="button-group">
                            <Button variant="outline" onClick={exportGeoJson} title="Export GeoJSON">
                              <Share2 size={15} /> GeoJSON
                            </Button>
                            <Button
                              variant="outline"
                              disabled={syncHls.isPending}
                              onClick={() => syncHls.mutate()}
                            >
                              <Layers size={15} /> {syncHls.isPending ? t.loading : t.syncHlsBtn}
                            </Button>
                            <Button variant="outline" onClick={() => setEditor(selected)}>
                              <Pencil size={15} />
                              {t.edit}
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={removeField.isPending}
                              onClick={() => {
                                if (confirm(t.deleteConfirm)) removeField.mutate(selected.id);
                              }}
                            >
                              <Trash2 size={16} />
                              {t.delete}
                            </Button>
                          </div>
                        </div>

                        <FieldMap geometry={selected.geometry} t={t} />

                        {latestVegetation && (
                          <div
                            style={{
                              padding: '0.75rem 1rem',
                              background: '#f4f8f2',
                              borderTop: '1px solid #e2ebd9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.85rem',
                            }}
                          >
                            <span>
                              <strong>{latestVegetation.is_demo?'HLS · DEMO':'Спектральні дані'}:</strong> {latestVegetation.satellite} · {latestVegetation.scene_date}
                            </span>
                            <span className="tag green">
                              Mean NDVI: {latestVegetation.ndvi_mean} (min {latestVegetation.ndvi_min} / max{' '}
                              {latestVegetation.ndvi_max})
                            </span>
                          </div>
                        )}

                        <div className="map-footer">{t.mapCredit}</div>
                      </section>

                      <section className="card field-details">
                        <div>
                          <p className="eyebrow">{t.soil}</p>
                          <h3>{t[selected.soil_type as 'loam'] || t.unknown}</h3>
                          <p className="muted small">pH: {selected.soil_ph ?? '—'}</p>
                        </div>
                        <div>
                          <p className="eyebrow">{t.rotation}</p>
                          <div className="crop-sequence">
                            {selected.crop_history.map((c, i) => (
                              <span key={i}>
                                {cropNames[lang][c] || c}
                                {i < selected.crop_history.length - 1 && <ChevronRight size={13} />}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="eyebrow">{t.downloaded}</p>
                          <p>{formatDate(selected.updated_at)}</p>
                        </div>
                      </section>
                      {removeField.isError && <p className="error">{removeField.error.message}</p>}
                      {sourceForm}
                    </>
                  )}

                  {/* ================= VIEW: ANALYSIS · CLIMATE · DEVICES · SOURCES ================= */}
                  {view === 'analysis' && selected && <div className="monitoring-studio"><RotationPlanner key={selected.id} field={selected} /></div>}
                  {view === 'climate' && selected && <div className="monitoring-studio"><ClimateTimeMachine key={selected.id} field={selected} /></div>}
                  {view === 'devices' && (
                    <>
                      {selected && <div className="monitoring-studio"><EquipmentSensors key={selected.id} field={selected} /></div>}
                      <details className="monitoring-studio devices-legacy"><summary>Мої зареєстровані пристрої та CSV‑телеметрія</summary>
                        <DevicesView fields={fields} selectedFieldId={selected?.id} t={t} lang={lang} />
                      </details>
                    </>
                  )}
                  {view === 'sources' && <div className="monitoring-studio"><DataSources /></div>}

                  {/* ================= VIEW: SAFETY (Ukraine Resilience) ================= */}
                  {view === 'safety' && <SafetyView t={t} lang={lang} />}
                </>
              )}
            </>
          )}

          <footer className="app-footer">
            <span>
              <Sprout size={15} />
              AGROSAS OS
            </span>
            <span>{t.independence}</span>
            <span>From Space to Soil.</span>
          </footer>
        </main>
      </div>

      {/* Bottom Nav for Mobile iPhone PWA */}
      <nav className="bottom-nav">
        {[
          { id: 'overview' as View, icon: LayoutDashboard, label: t.home },
          { id: 'fields' as View, icon: Map, label: t.fields },
          { id: 'analysis' as View, icon: Sprout, label: t.analysisShort },
          { id: 'devices' as View, icon: Cpu, label: 'IoT' },
          { id: 'safety' as View, icon: ShieldCheck, label: t.safety },
        ].map(n => (
          <button
            key={n.id}
            className={view === n.id ? 'active' : ''}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={20} />
            {n.label}
          </button>
        ))}
        <button className={menu ? 'active' : ''} onClick={() => setMenu(!menu)}>
          <Menu size={20} />
          {t.more}
        </button>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label={t.cancel} onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Field Editor Dialog */}
      {editor && (
        <FieldEditor
          field={editor === 'new' ? undefined : editor}
          t={t}
          lang={lang}
          onClose={() => setEditor(null)}
          onSaved={f => {
            setEditor(null);
            setSelectedId(f.id);
            setWeights(f.priorities);
            client.invalidateQueries({ queryKey: ['fields'] });
            client.invalidateQueries({ queryKey: ['observations', f.id] });
            client.invalidateQueries({ queryKey: ['evaluation', f.id] });
            client.invalidateQueries({ queryKey: ['vegetation', f.id] });
            setToast(t.saved);
          }}
        />
      )}

      {/* Explainable AI Modal */}
      {showAiModal && explanation && (
        <AiExplanationDialog
          explanation={explanation}
          t={t}
          lang={lang}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  foot,
  unit,
  blue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  foot: string;
  unit?: string;
  blue?: boolean;
}) {
  return (
    <section className={`card kpi ${blue ? 'blue' : ''}`}>
      <div className="kpi-label">
        <span>{label}</span>
        {icon}
      </div>
      <div className="kpi-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{foot}</p>
    </section>
  );
}
