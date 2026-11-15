'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Sprout,
  Wifi,
  Satellite,
  Layers,
  Activity,
  ShieldCheck,
  Cpu,
  Orbit,
  ArrowRight,
  TrendingUp,
  Droplets,
  Thermometer,
  CloudRain,
  ExternalLink,
  Sparkles,
  Maximize2,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/button';
import type { Field, Device, SensorMeasurement, Evaluation, AiExplanation } from '@/lib/types';
import type { SatelliteMission } from '@/lib/satellites';
import type { Copy } from '@/lib/i18n';

// Dynamic import for 3D Earth Globe
const EarthGlobe = dynamic(() => import('../earth-3d/earth-globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#06131C] text-emerald-400">
      <div className="flex flex-col items-center gap-3">
        <Orbit size={36} className="animate-spin text-emerald-400" />
        <span className="text-sm font-medium tracking-wide">Ініціалізація 3D Digital Twin Землі…</span>
      </div>
    </div>
  ),
});

interface MissionControlProps {
  fields: Field[];
  selectedField?: Field;
  evaluation?: Evaluation;
  aiExplanation?: AiExplanation;
  devices: Device[];
  telemetry: SensorMeasurement[];
  t: Copy;
  onOpenAnalysis: () => void;
  onOpenTwin: () => void;
  onOpenIoT: () => void;
  onOpenSafety: () => void;
  onSelectSatellite: (sat: SatelliteMission | null) => void;
}

export default function MissionControl({
  fields,
  selectedField,
  evaluation,
  aiExplanation,
  devices,
  telemetry,
  t,
  onOpenAnalysis,
  onOpenTwin,
  onOpenIoT,
  onOpenSafety,
  onSelectSatellite,
}: MissionControlProps) {
  const [showStarlink, setShowStarlink] = useState(true);
  const [showCones, setShowCones] = useState(true);
  const [activeNasaProduct, setActiveNasaProduct] = useState<string>('HLS');

  const nasaProducts = [
    { id: 'POWER', title: 'POWER', subtitle: 'Погода та клімат', color: '#ff7b00', resolution: '0.5° × 0.625°' },
    { id: 'HLS', title: 'HLS', subtitle: 'Рослинність (NDVI)', color: '#2ec4b6', resolution: '30 m' },
    { id: 'SMAP', title: 'SMAP', subtitle: 'Вологість ґрунту', color: '#0077b6', resolution: '9–36 km' },
    { id: 'ECOSTRESS', title: 'ECOSTRESS', subtitle: 'Тепловий стрес', color: '#e71d36', resolution: '70 m' },
    { id: 'GLDAS', title: 'GLDAS', subtitle: 'Водний баланс', color: '#00b4d8', resolution: '0.25°' },
    { id: 'NISAR', title: 'NISAR', subtitle: 'Радарні дані', color: '#b4ff63', resolution: '3–10 m' },
  ];

  return (
    <div className="relative w-full h-full flex overflow-hidden select-none" style={{ background: '#06131C' }}>
      {/* 3D Earth Globe Canvas Background */}
      <div className="absolute inset-0 z-0">
        <EarthGlobe
          onSelectSatellite={onSelectSatellite}
          onSelectRegion={region => {
            if (region === 'ukraine') onOpenTwin();
          }}
          showStarlink={showStarlink}
          showObservationCones={showCones}
          activeDataLayer={activeNasaProduct}
        />
      </div>

      {/* Floating 3D Annotations & Callouts (Overlay matching the Reference Image) */}
      <div className="absolute top-20 left-1/4 pointer-events-none z-10 hidden xl:flex items-center gap-3 bg-[#06131C]/75 backdrop-blur-md border border-cyan-500/40 px-3.5 py-2 rounded-xl text-white shadow-xl animate-in fade-in">
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
        <div className="text-xs">
          <strong className="text-cyan-300 flex items-center gap-1.5">
            <Satellite size={13} /> Супутники спостереження (дані NASA)
          </strong>
          <span className="text-gray-300 text-[11px]">Моніторинг Землі: посіви, волога, температура, стрес рослин</span>
        </div>
      </div>

      <div className="absolute top-24 right-[38%] pointer-events-none z-10 hidden xl:flex items-center gap-3 bg-[#06131C]/75 backdrop-blur-md border border-emerald-500/40 px-3.5 py-2 rounded-xl text-white shadow-xl animate-in fade-in">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        <div className="text-xs">
          <strong className="text-emerald-300 flex items-center gap-1.5">
            <Wifi size={13} /> Супутники Starlink
          </strong>
          <span className="text-gray-300 text-[11px]">Надійний зв’язок із полями в будь-якій точці світу</span>
        </div>
      </div>

      <div className="absolute top-[42%] left-[38%] pointer-events-none z-10 hidden lg:flex items-center gap-2 bg-[#06131C]/80 backdrop-blur-md border border-yellow-400/50 px-3 py-1.5 rounded-xl text-white shadow-xl">
        <span className="text-sm">🇺🇦</span>
        <div className="text-xs">
          <strong className="text-yellow-300">Україна</strong>
          <p className="text-[10px] text-gray-300">Ключовий регіон FieldShift</p>
        </div>
      </div>

      <div className="absolute bottom-36 left-[34%] pointer-events-none z-10 hidden lg:flex items-center gap-2 bg-[#06131C]/80 backdrop-blur-md border border-emerald-400/50 px-3 py-1.5 rounded-xl text-white shadow-xl">
        <span className="text-emerald-400">📊</span>
        <div className="text-xs">
          <strong className="text-emerald-300">Глобальна агроаналітика</strong>
          <p className="text-[10px] text-gray-300">100+ регіонів моніторингу</p>
        </div>
      </div>

      {/* Right Column Context HUD (Matches Reference Image) */}
      <aside
        className="ml-auto w-full max-w-[420px] h-full overflow-y-auto z-20 flex flex-col gap-3.5 p-4 pointer-events-auto custom-scrollbar"
        style={{
          background: 'linear-gradient(180deg, rgba(6, 19, 28, 0.88) 0%, rgba(11, 61, 46, 0.82) 100%)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(180, 255, 99, 0.25)',
        }}
      >
        {/* Card 1: Дані NASA для вашої аналітики */}
        <section
          className="rounded-2xl p-3.5 border border-emerald-500/30 text-white shadow-xl"
          style={{ background: 'rgba(11, 45, 34, 0.65)' }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold tracking-wider text-emerald-200 uppercase flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-400" /> ДАНІ NASA ДЛЯ ВАШОЇ АНАЛІТИКИ
            </h3>
            <span className="text-[10px] text-emerald-300/80 font-mono">EARTH OBSERVATION</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {nasaProducts.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveNasaProduct(p.id)}
                className={`p-2 rounded-xl text-left transition-all border ${
                  activeNasaProduct === p.id
                    ? 'border-emerald-400 bg-emerald-950/70 shadow-lg shadow-emerald-900/40'
                    : 'border-emerald-900/50 bg-black/40 hover:bg-emerald-950/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-bold" style={{ color: p.color }}>
                    {p.title}
                  </strong>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                </div>
                <p className="text-[10px] text-gray-300 mt-1 leading-tight line-clamp-1">{p.subtitle}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{p.resolution}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Card 2: Моє поле: Полтавська обл. */}
        <section
          className="rounded-2xl p-3.5 border border-emerald-500/30 text-white shadow-xl"
          style={{ background: 'rgba(11, 45, 34, 0.65)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🌾</span>
                <h3 className="text-sm font-bold text-emerald-100">
                  {selectedField ? selectedField.name : 'Моє поле: Полтавська обл.'}
                </h3>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                {selectedField ? `${selectedField.area_ha} га` : '56.4 га'} •{' '}
                {selectedField ? selectedField.crop_history[selectedField.crop_history.length - 1] : 'Кукурудза'} 🇺🇦
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenTwin}
                className="p-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-800 text-emerald-200"
                title="3D Digital Twin"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          {/* High-res Field Preview & Metrics */}
          <div className="relative h-28 rounded-xl overflow-hidden border border-emerald-900/80 mb-2.5 bg-[#0a2318]">
            {/* Visual NDVI simulated canvas */}
            <div
              className="w-full h-full"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(180,255,99,0.5) 0%, rgba(23,107,69,0.85) 60%, rgba(11,45,34,0.95) 100%)',
              }}
            />
            <div className="absolute inset-0 border border-emerald-400/40 rounded-xl pointer-events-none" />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-emerald-300 font-mono">
              HLS 30m NDVI MAP
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/30 p-2 rounded-xl border border-emerald-900/40">
              <span className="text-[10px] text-gray-400 block">NDVI</span>
              <strong className="text-sm text-emerald-300 font-bold">0.71</strong>
              <span className="text-[9px] text-emerald-400 block mt-0.5">Добре</span>
            </div>
            <div className="bg-black/30 p-2 rounded-xl border border-emerald-900/40">
              <span className="text-[10px] text-gray-400 block">Волога ґрунту</span>
              <strong className="text-sm text-cyan-300 font-bold">0.24 м³/м³</strong>
              <span className="text-[9px] text-cyan-400 block mt-0.5">Помірна</span>
            </div>
            <div className="bg-black/30 p-2 rounded-xl border border-emerald-900/40">
              <span className="text-[10px] text-gray-400 block">Температура</span>
              <strong className="text-sm text-yellow-300 font-bold">+24.6 °C</strong>
              <span className="text-[9px] text-gray-400 block mt-0.5">Норма</span>
            </div>
          </div>
        </section>

        {/* Card 3: Рекомендація FieldShift AI */}
        <section
          className="rounded-2xl p-3.5 border border-emerald-500/30 text-white shadow-xl"
          style={{ background: 'rgba(11, 45, 34, 0.65)' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-emerald-300">
            <Sparkles size={14} className="text-emerald-400" /> РЕКОМЕНДАЦІЯ FIELDSHIFT AI
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-900/60 mb-2.5">
            <strong className="text-xs text-white block mb-0.5">Кукурудза → покривна культура → Соя</strong>
            <p className="text-[11px] text-gray-300 leading-snug">
              Підвищить родючість ґрунту, збереже вологу та зменшить ризики на 7 днів.
            </p>
          </div>
          <Button
            onClick={onOpenAnalysis}
            className="w-full justify-between bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-xl shadow-lg shadow-emerald-950/60"
          >
            <span>Застосувати план</span>
            <ArrowRight size={14} />
          </Button>
        </section>

        {/* Card 4: Ukraine Resilience */}
        <section
          className="rounded-2xl p-3.5 border border-emerald-500/30 text-white shadow-xl"
          style={{ background: 'rgba(11, 45, 34, 0.65)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🔱</span>
              <div>
                <h3 className="text-xs font-bold text-emerald-100">Ukraine Resilience</h3>
                <p className="text-[10px] text-gray-300">Стійкість господарства в умовах війни</p>
              </div>
            </div>
            <button
              onClick={onOpenSafety}
              className="text-[11px] text-emerald-300 hover:text-white flex items-center gap-1"
            >
              Деталі <ExternalLink size={11} />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded-lg">
              <span className="text-gray-300 flex items-center gap-1.5 text-[11px]">
                <ShieldCheck size={12} className="text-emerald-400" /> Інфраструктура поля:
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                Готово
              </span>
            </div>
            <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded-lg">
              <span className="text-gray-300 flex items-center gap-1.5 text-[11px]">
                <Wifi size={12} className="text-emerald-400" /> Зв'язок (Starlink / 4G):
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                Стабільно
              </span>
            </div>
            <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded-lg">
              <span className="text-gray-300 flex items-center gap-1.5 text-[11px]">
                <Cpu size={12} className="text-yellow-400" /> Живлення та обладнання:
              </span>
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-950/80 px-2 py-0.5 rounded">
                Резервне
              </span>
            </div>
            <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded-lg">
              <span className="text-gray-300 flex items-center gap-1.5 text-[11px]">
                <Activity size={12} className="text-emerald-400" /> Кліматичні ризики (7 днів):
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                Низький
              </span>
            </div>
          </div>
        </section>
      </aside>

      {/* Bottom Pipeline Banner: "Екосистема FieldShift: повний цикл від даних до дій" */}
      <footer
        className="absolute bottom-4 left-6 right-[440px] hidden md:flex items-center justify-between gap-2 p-3 rounded-2xl border border-emerald-500/30 text-white z-20 shadow-2xl overflow-x-auto"
        style={{
          background: 'rgba(6, 19, 28, 0.85)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-2 border-r border-emerald-900/60 pr-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <strong className="text-xs text-emerald-200 block whitespace-nowrap">Екосистема FieldShift:</strong>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">повний цикл від даних до дій</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs overflow-x-auto">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center">
            <span className="text-sm">🛰️</span>
            <strong className="text-[11px] text-emerald-200 whitespace-nowrap">Супутникові дані (NASA)</strong>
            <span className="text-[9px] text-gray-400 whitespace-nowrap">POWER • HLS • SMAP</span>
          </div>
          <span className="text-emerald-500/80 font-bold">»</span>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center">
            <span className="text-sm">☁️</span>
            <strong className="text-[11px] text-emerald-200 whitespace-nowrap">FieldShift Cloud</strong>
            <span className="text-[9px] text-gray-400 whitespace-nowrap">AI-аналіз • Моделі</span>
          </div>
          <span className="text-emerald-500/80 font-bold">»</span>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center">
            <span className="text-sm">📡</span>
            <strong className="text-[11px] text-emerald-200 whitespace-nowrap">Starlink</strong>
            <span className="text-[9px] text-gray-400 whitespace-nowrap">Стійкий інтернет</span>
          </div>
          <span className="text-emerald-500/80 font-bold">»</span>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center">
            <span className="text-sm">📶</span>
            <strong className="text-[11px] text-emerald-200 whitespace-nowrap">IoT на полі</strong>
            <span className="text-[9px] text-gray-400 whitespace-nowrap">Метео, ґрунт, культура</span>
          </div>
          <span className="text-emerald-500/80 font-bold">»</span>

          {/* Step 5 */}
          <div className="flex flex-col items-center text-center">
            <span className="text-sm">🚜</span>
            <strong className="text-[11px] text-emerald-200 whitespace-nowrap">Рішення на полі</strong>
            <span className="text-[9px] text-gray-400 whitespace-nowrap">Посів • Живлення • Полив</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-1.5 border-l border-emerald-900/60 pl-3">
          <button
            onClick={() => setShowStarlink(!showStarlink)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
              showStarlink
                ? 'border-emerald-400 bg-emerald-950/80 text-emerald-300'
                : 'border-gray-700 bg-black/40 text-gray-400'
            }`}
          >
            Starlink
          </button>
          <button
            onClick={() => setShowCones(!showCones)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
              showCones
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300'
                : 'border-gray-700 bg-black/40 text-gray-400'
            }`}
          >
            NASA Beams
          </button>
        </div>
      </footer>
    </div>
  );
}
