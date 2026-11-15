'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import type {Field} from '@/lib/types';
import {FACTOR_LABEL,type ZonesResult} from '@/lib/planner';
import './action-board.css';

type Hour={time:string;temperature_2m:number;relative_humidity_2m:number;precipitation:number;precipitation_probability:number|null;wind_speed_10m:number;wind_gusts_10m:number;soil_temperature_6cm:number|null;soil_moisture_3_to_9cm:number|null;cloud_cover:number};
type Weather={hours:Hour[];timezone:string};
type Snap={after:{date:string};before:{date:string}|null;params:Record<string,{change?:{drop_pct:number;drop_where:string|null};compare?:{delta_mean:number}}>};
type Task={id:string;prio:'urgent'|'soon'|'plan';icon:string;title:string;why:string;source:string;start?:string;end?:string;href?:string;cta?:string;coords?:[number,number]};

const okSpray=(h:Hour)=>h.wind_speed_10m<15&&h.precipitation<.1&&(h.precipitation_probability??0)<30&&h.temperature_2m>5&&h.temperature_2m<25&&h.relative_humidity_2m>40;
function windows(hs:Hour[],ok:(h:Hour)=>boolean,min=2){const out:{start:string;end:string}[]=[];let s:string|null=null;hs.forEach((h,i)=>{const g=ok(h);if(g&&!s)s=h.time;if((!g||i===hs.length-1)&&s){const e=g?h.time:hs[i-1].time;if((new Date(e).getTime()-new Date(s).getTime())/36e5+1>=min)out.push({start:s,end:e});s=null}});return out}
const fmt=(t:string)=>{const d=new Date(t);return `${['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()]} ${String(d.getHours()).padStart(2,'0')}:00`};
function ics(t:Task,field:Field){const z=(s:string)=>s.replace(/[-:]/g,'').slice(0,13)+'00';const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AGROSAS OS//UK','BEGIN:VEVENT',`UID:${t.id}-${field.id}@agrosas`,`DTSTART:${z(t.start!)}`,`DTEND:${z(t.end||t.start!)}`,`SUMMARY:${t.title} — ${field.name}`,`DESCRIPTION:${t.why.replace(/\n/g,' ')}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'text/calendar'}));a.download=`${t.id}.ics`;a.click()}

export default function ActionBoard({field}:{field:Field}){
 const w=useQuery({queryKey:['weather-detail',field.id],queryFn:()=>api<Weather>(`/fields/${field.id}/weather-detail`),staleTime:1800000});
 const z=useQuery({queryKey:['zones',field.id],queryFn:()=>api<ZonesResult>(`/fields/${field.id}/zones`),staleTime:600000});
 const s=useQuery({queryKey:['snapshot',field.id],queryFn:()=>api<Snap>(`/fields/${field.id}/monitoring/snapshot`),staleTime:1800000,retry:0});
 const key=`agrosas-done-${field.id}`;const[done,setDone]=useState<string[]>([]);
 useEffect(()=>{try{setDone(JSON.parse(localStorage.getItem(key)||'[]'))}catch{}},[key]);
 const toggle=(id:string)=>{const n=done.includes(id)?done.filter(x=>x!==id):[...done,id];setDone(n);localStorage.setItem(key,JSON.stringify(n))};
 const tasks=useMemo(()=>{const out:Task[]=[];const hs=w.data?.hours||[];
  if(hs.length){
   const frost=hs.filter(h=>h.temperature_2m<=0);if(frost.length)out.push({id:'frost',prio:'urgent',icon:'❄',title:'Нічний мороз — захистіть сходи й техніку',why:`Температура опуститься до ${Math.min(...frost.map(h=>h.temperature_2m)).toFixed(0)}° (${frost.length} год нижче нуля). Не обприскуйте на холоді — препарати гірше діють; злийте воду з поливної системи.`,source:'Прогноз ECMWF/ICON',start:frost[0].time,end:frost[frost.length-1].time});
   const rain=hs.filter(h=>h.precipitation>=1);const rainSum=hs.reduce((a,h)=>a+h.precipitation,0);if(rainSum>=10)out.push({id:'rain',prio:'soon',icon:'🌧',title:`Зливи ${rainSum.toFixed(0)} мм — техніку в поле не заводити`,why:`Найбільше дощу ${fmt(rain[0]?.time||hs[0].time)}. Мокрий ґрунт ущільнюється під колесами — після дощу дайте поверхні просохнути 1–2 дні.`,source:'Прогноз',start:rain[0]?.time,end:rain[rain.length-1]?.time,href:`/farm-lab?field=${field.id}#zones`,cta:'Зони ерозії'});
   const gust=hs.filter(h=>h.wind_gusts_10m>=50);if(gust.length)out.push({id:'storm',prio:'urgent',icon:'💨',title:`Пориви до ${Math.max(...gust.map(h=>h.wind_gusts_10m)).toFixed(0)} км/год`,why:'Закріпіть легкі конструкції, не плануйте обприскування й роботу з високою технікою.',source:'Прогноз',start:gust[0].time,end:gust[gust.length-1].time});
   const sw=windows(hs,okSpray,3);out.push(sw.length?{id:'spray',prio:'soon',icon:'🎯',title:`Вікно для обприскування: ${fmt(sw[0].start)} – ${fmt(sw[0].end).slice(3)}`,why:`Вітер <15 км/год, без дощу, 5–25 °C, вологість >40%.${sw.length>1?` Запасне вікно: ${fmt(sw[1].start)}.`:''}`,source:'Прогноз погодинно',start:sw[0].start,end:sw[0].end,href:`/farm-lab?field=${field.id}#weather`,cta:'Погода'}:{id:'spray',prio:'plan',icon:'🎯',title:'Обприскування — вікна немає 72 години',why:'Вітер, дощ або холод. Перевірте прогноз завтра.',source:'Прогноз'});
   const now=hs[0];const st=now.soil_temperature_6cm,sm=now.soil_moisture_3_to_9cm;
   if(sm!=null&&sm<.17&&rainSum<5)out.push({id:'irrigate',prio:'soon',icon:'💧',title:'Ґрунт пересихає — плануйте полив',why:`Волога 3–9 см ${Math.round(sm*100)}%, за 72 год лише ${rainSum.toFixed(1)} мм дощу. Детальний графік поливу під енергію ферми — нижче.`,source:'Модель ґрунту ECMWF',start:sw[0]?.start||hs[6].time,href:'#irrigation',cta:'До оптимізатора'});
   if(st!=null)out.push({id:'sowing',prio:'plan',icon:'🌱',title:st>=10?'Ґрунт теплий — можна сіяти кукурудзу, сою, соняшник':st>=6?'Можна сіяти ранні ярі: ячмінь, горох, пшеницю':'Ґрунт холодний — сівбу ярих відкласти',why:`Температура на 6 см ${st.toFixed(1)}°, волога ${sm!=null?Math.round(sm*100)+'%':'—'}${sm!=null&&sm>.38?' — перезволожено, сівалка може грузнути':''}.`,source:'Модель ґрунту'});
  }
  if(z.data){const weak=[...z.data.zones].sort((a,b)=>a.relative_yield-b.relative_yield)[0];const f=FACTOR_LABEL[weak.limiting_factor]||FACTOR_LABEL.none;
   out.push({id:'scout',prio:'soon',icon:'🔎',title:`Огляньте зону ${weak.zone}: ${f.name.toLowerCase()}`,why:`${weak.area_ha} га з потенціалом ${Math.round(weak.relative_yield*100)}% від середнього. ${f.advice}. Точка огляду: ${weak.center[1].toFixed(5)}, ${weak.center[0].toFixed(5)}.`,source:z.data.has_ndvi?'Рельєф SRTM + NDVI Sentinel‑2':'Рельєф SRTM',coords:weak.center,href:`/farm-lab?field=${field.id}#zones`,cta:'3D‑зони',start:windows(hs,h=>h.precipitation<.1&&h.temperature_2m>0&&new Date(h.time).getHours()>=8&&new Date(h.time).getHours()<=17,2)[0]?.start});
   out.push({id:'samples',prio:'plan',icon:'🧪',title:`Відбір ґрунту: ${z.data.samples.points.length} проб, маршрут ${(z.data.samples.route_m/1000).toFixed(1)} км`,why:'По 3–10 точок на зону, один маршрут. Аналіз pH, P, K і органіки замінить модельні дані реальними.',source:'Зони поля',href:`/farm-lab?field=${field.id}#zones`,cta:'Маршрут проб'});}
  const nd=s.data?.params?.NDVI?.change;if(nd&&nd.drop_pct>8)out.push({id:'ndvi',prio:nd.drop_pct>20?'urgent':'soon',icon:'🛰',title:`Вегетація впала на ${nd.drop_pct}% площі`,why:`Sentinel‑2: ${s.data?.before?.date} → ${s.data?.after.date}${nd.drop_where?`, переважно ${nd.drop_where}`:''}. Перевірте: збирання, посуха, шкідники чи ущільнення.`,source:'Sentinel‑2 NDVI',href:`/farm-lab?field=${field.id}#evidence`,cta:'Знімки'});
  const order={urgent:0,soon:1,plan:2};return out.sort((a,b)=>order[a.prio]-order[b.prio])},[w.data,z.data,s.data,field.id]);
 const hs=w.data?.hours||[];const t0=hs[0]?new Date(hs[0].time).getTime():0;const span=72*36e5;
 const pos=(t:string)=>Math.max(0,Math.min(100,(new Date(t).getTime()-t0)/span*100));
 const left=tasks.filter(t=>!done.includes(t.id)).length;
 return <section className="ab">
  <header className="ab-head"><div><span className="eyebrow">ACTION PLAN · 72 ГОДИНИ</span><h2>Що зробити на полі «{field.name}»</h2><p>Завдання складені автоматично з прогнозу, зон поля й супутникових знімків. Кожне — з причиною і джерелом. Відмічайте виконане.</p></div>
   <div className="ab-count"><b>{left}</b><small>{left===1?'завдання':'завдань'} залишилось</small></div></header>
  {(w.isPending||z.isPending)&&<div className="planner-loading"><span/><p>Збираємо прогноз, зони поля й знімки…</p></div>}
  {hs.length>0&&<div className="ab-timeline">
   <div className="ab-weather">{hs.map(h=><i key={h.time} title={`${fmt(h.time)} · ${h.temperature_2m.toFixed(0)}° · ${h.precipitation.toFixed(1)} мм · вітер ${h.wind_speed_10m.toFixed(0)}`} className={h.precipitation>=.3?'rain':h.temperature_2m<=0?'frost':okSpray(h)?'ok':h.wind_speed_10m>=15?'wind':''}/>)}</div>
   <div className="ab-days">{[0,1,2].map(d=><span key={d} style={{left:`${d/3*100}%`}}>{fmt(new Date(t0+d*864e5).toISOString()).slice(0,2)} {new Date(t0+d*864e5).getDate()}</span>)}</div>
   <div className="ab-lanes">{tasks.filter(t=>t.start).map((t,i)=><div key={t.id} className={`ab-bar ${t.prio} ${done.includes(t.id)?'done':''}`} style={{left:`${pos(t.start!)}%`,width:`${Math.max(4,pos(t.end||t.start!)-pos(t.start!)+1.4)}%`,top:`${i*26}px`}} title={t.title}>{t.icon} {t.title.split(':')[0].split('—')[0]}</div>)}</div>
   <div className="ab-legend"><span><i className="ok"/>можна працювати</span><span><i className="rain"/>дощ</span><span><i className="wind"/>вітер</span><span><i className="frost"/>мороз</span></div>
  </div>}
  <div className="ab-list">{tasks.map(t=><article key={t.id} className={`ab-task ${t.prio} ${done.includes(t.id)?'done':''}`}>
   <button className="ab-check" onClick={()=>toggle(t.id)} aria-label={done.includes(t.id)?'Повернути':'Виконано'}>{done.includes(t.id)?'✓':''}</button>
   <span className="ab-icon">{t.icon}</span>
   <div className="ab-body"><div className="ab-top"><span className={`ab-prio ${t.prio}`}>{t.prio==='urgent'?'терміново':t.prio==='soon'?'найближчим часом':'планування'}</span>{t.start&&<span className="ab-when">{fmt(t.start)}{t.end&&t.end!==t.start?` – ${fmt(t.end).slice(3)}`:''}</span>}</div>
    <h4>{t.title}</h4><p>{t.why}</p>
    <div className="ab-foot"><small>Джерело: {t.source}</small>{t.coords&&<a href={`https://www.google.com/maps?q=${t.coords[1]},${t.coords[0]}`} target="_blank" rel="noreferrer">Навігація ↗</a>}{t.start&&<button onClick={()=>ics(t,field)}>+ у календар</button>}{t.href&&(t.href.startsWith('#')?<a href={t.href}>{t.cta} →</a>:<Link href={t.href}>{t.cta} →</Link>)}</div></div>
  </article>)}</div>
 </section>;
}
