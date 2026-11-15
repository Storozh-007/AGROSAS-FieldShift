'use client';
import {useQuery} from '@tanstack/react-query';
import {ResponsiveContainer,AreaChart,Area,YAxis} from 'recharts';
import {api} from '@/lib/api';
import type {Field} from '@/lib/types';
import {FACTOR_LABEL,type ZonesResult} from '@/lib/planner';
import './equipment-sensors.css';

type Hour={time:string;temperature_2m:number;relative_humidity_2m:number;wind_speed_10m:number;soil_temperature_6cm:number|null;soil_moisture_3_to_9cm:number|null;et0_fao_evapotranspiration:number|null;precipitation:number};
const SENSORS:{k:keyof Hour;name:string;unit:string;fmt:(v:number)=>string;color:string;read:(v:number)=>string}[]=[
 {k:'soil_moisture_3_to_9cm',name:'Волога ґрунту 3–9 см',unit:'%',fmt:v=>`${Math.round(v*100)}`,color:'#5fd4ff',read:v=>v>.38?'перезволожено':v<.15?'сухо':'норма'},
 {k:'soil_temperature_6cm',name:'Температура ґрунту 6 см',unit:'°C',fmt:v=>v.toFixed(1),color:'#ffb547',read:v=>v>=10?'тепло для сівби пізніх ярих':v>=6?'можна сіяти ранні ярі':'холодно для сівби'},
 {k:'temperature_2m',name:'Повітря 2 м',unit:'°C',fmt:v=>v.toFixed(1),color:'#ff8a76',read:v=>v<=0?'мороз':v>=32?'спека':'—'},
 {k:'relative_humidity_2m',name:'Вологість повітря',unit:'%',fmt:v=>`${Math.round(v)}`,color:'#a78bfa',read:v=>v>90?'ризик грибкових хвороб':v<40?'обприскування неефективне':'—'},
 {k:'wind_speed_10m',name:'Вітер 10 м',unit:'км/год',fmt:v=>`${Math.round(v)}`,color:'#9fd8e8',read:v=>v>=15?'не обприскувати':'можна працювати'},
 {k:'et0_fao_evapotranspiration',name:'Випаровування ET₀',unit:'мм/год',fmt:v=>v.toFixed(2),color:'#b6ff47',read:()=>'скільки води просить атмосфера'},
];
const KIT=[
 {name:'Зонд вологості ґрунту (3 глибини)',qty:'1 на зону',price:'$180–350',power:'сонячна панель 1 Вт',why:'Підтверджує SMAP і модель FAO‑56 у вашій точці; запускає полив за фактом'},
 {name:'Метеостанція (T, RH, вітер, радіація)',qty:'1 на поле',price:'$600–1 500',power:'сонячна 5 Вт + акумулятор',why:'Точне ET₀ і вікна обприскування замість регіональної сітки 10–25 км'},
 {name:'Дощомір (tipping bucket)',qty:'1 на поле',price:'$80–150',power:'батарея 1–2 роки',why:'Перевіряє GPM IMERG — супутник може пропустити локальну зливу'},
 {name:'Шлюз LoRaWAN',qty:'1 на 5–10 км',price:'$250–500',power:'230 В або сонячна 20 Вт',why:'Збирає дані з датчиків без мобільного зв’язку'},
 {name:'Термінал Starlink Mini',qty:'1 на господарство',price:'$500 + підписка',power:'25–40 Вт',why:'Інтернет для шлюзу там, де немає 4G'},
];

function Spark({data,k,color}:{data:Hour[];k:keyof Hour;color:string}){const d=data.map(h=>({v:h[k] as number|null}));return <ResponsiveContainer width="100%" height={46}><AreaChart data={d} margin={{top:4,right:0,left:0,bottom:0}}><YAxis hide domain={['dataMin','dataMax']}/><Area dataKey="v" stroke={color} fill={color} fillOpacity={.15} strokeWidth={1.6} dot={false} isAnimationActive={false}/></AreaChart></ResponsiveContainer>}

export default function EquipmentSensors({field}:{field:Field}){
 const w=useQuery({queryKey:['weather-detail',field.id],queryFn:()=>api<{hours:Hour[];source:string;timezone:string}>(`/fields/${field.id}/weather-detail`),staleTime:1800000});
 const z=useQuery({queryKey:['zones',field.id],queryFn:()=>api<ZonesResult>(`/fields/${field.id}/zones`),staleTime:600000});
 const now=w.data?.hours[0];
 return <section className="eq">
  <header className="ds-hero"><div><span className="eyebrow">SENSORS · VIRTUAL + PHYSICAL</span><h2>Датчики поля: що відомо вже зараз і куди поставити справжні</h2><p>Поки фізичних датчиків немає, поле «вимірюють» моделі ECMWF і супутники. Справжні датчики в правильних точках роблять ці дані вашими.</p></div></header>
  <h3 className="eq-h">Віртуальні датчики — {field.name}</h3>
  {w.isPending&&<div className="planner-loading"><span/><p>Отримуємо поточний стан поля…</p></div>}
  {now&&w.data&&<div className="eq-grid">{SENSORS.map(s=>{const v=now[s.k] as number|null;return <article key={s.k}><small>{s.name}</small><b>{v==null?'—':s.fmt(v)}<em> {s.unit}</em></b><span>{v==null?'немає даних':s.read(v)}</span><Spark data={w.data.hours} k={s.k} color={s.color}/><i>наступні 72 год · модель, не датчик</i></article>})}</div>}
  <h3 className="eq-h">Де поставити фізичні датчики</h3>
  {z.isPending&&<div className="planner-loading"><span/><p>Розраховуємо зони поля…</p></div>}
  {z.data&&<div className="eq-points">{z.data.zones.map(zone=>{const f=FACTOR_LABEL[zone.limiting_factor]||FACTOR_LABEL.none;return <article key={zone.zone}><header><span>{zone.zone}</span><div><b>Точка {zone.zone} · зона {zone.zone}</b><small>{zone.center[1].toFixed(5)}, {zone.center[0].toFixed(5)}</small></div><a href={`https://www.google.com/maps?q=${zone.center[1]},${zone.center[0]}`} target="_blank" rel="noreferrer">На карті ↗</a></header>
   <p>{zone.area_ha} га · урожай {Math.round(zone.relative_yield*100)}% від середнього · {f.name.toLowerCase()}</p><p className="why">{zone.limiting_factor==='waterlogging'?'Зонд покаже, скільки днів вода стоїть у низині — основа для дренажу.':zone.limiting_factor==='erosion'?'На схилі вода стікає швидше — тут ґрунт пересихає першим.':zone.limiting_factor==='drought'?'Найпосушливіша ділянка — сигнал для поливу з’явиться тут раніше.':zone.relative_yield>1.05?'Найсильніша зона — еталон для порівняння з рештою поля.':'Типова для поля ділянка — середнє значення для всього поля.'}</p></article>})}</div>}
  <h3 className="eq-h">Мінімальний набір обладнання</h3>
  <div className="eq-kit">{KIT.map(k=><div key={k.name}><b>{k.name}</b><span>{k.qty}</span><span>{k.price}</span><span>{k.power}</span><p>{k.why}</p></div>)}</div>
  <p className="wx-source">Ціни — орієнтовний діапазон ринку 2025–2026 для довідки, не пропозиція. Віртуальні датчики: {w.data?.source} · {w.data?.timezone}.</p>
 </section>;
}
