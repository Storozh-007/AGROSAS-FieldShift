'use client';
import {useEffect,useMemo,useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ResponsiveContainer,ComposedChart,Area,Line,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {api} from '@/lib/api';
import {simulateDesignStep} from '@/lib/farm-network';
import {INITIAL_LAB,type LabConfig,type LabState} from '@/lib/farm-simulation';
import type {FarmDesign} from '@/lib/farm-design';
import type {Field} from '@/lib/types';

type Hour={time:string;cloud_cover:number;wind_speed_10m:number;precipitation:number;temperature_2m:number};

/** Runs this farm's own design hour by hour through the field forecast: real clouds and wind instead of fixed defaults. */
export default function EnergyForecast({field,design,config,lat,lon,onWeather}:{field:Field;design:FarmDesign;config:LabConfig;lat:number;lon:number;onWeather?:(cloudPct:number,windMs:number)=>void}){
 const w=useQuery({queryKey:['weather-detail',field.id],queryFn:()=>api<{hours:Hour[];timezone:string;utc_offset_seconds?:number}>(`/fields/${field.id}/weather-detail`),staleTime:1800000});
 const applied=useRef('');
 useEffect(()=>{const h=w.data?.hours[0];if(h&&onWeather&&applied.current!==field.id){applied.current=field.id;onWeather(Math.round(h.cloud_cover),+(h.wind_speed_10m/3.6).toFixed(1))}},[w.data,field.id,onWeather]);
 const sim=useMemo(()=>{if(!w.data)return null;let state:LabState={...INITIAL_LAB};const rows=w.data.hours.slice(0,24).map(h=>{const cfg={...config,cloudPct:h.cloud_cover,windMs:h.wind_speed_10m/3.6,rainMmHour:h.precipitation};const r=simulateDesignStep(design,cfg,state,new Date(Date.parse(h.time+'Z')-(w.data!.utc_offset_seconds||0)*1000),lat,lon,field.area_ha,1);state=r.state;return{t:h.time.slice(11,16),pv:+r.pvKw.toFixed(2),wind:+r.windPowerKw.toFixed(2),load:+r.demandKw.toFixed(2),soc:+r.state.soc.toFixed(0),grid:+r.gridKw.toFixed(2),unserved:+r.unservedKw.toFixed(2)}});
  const sum=(k:'pv'|'wind'|'load'|'grid'|'unserved')=>rows.reduce((a,r)=>a+r[k],0);const windAvg=w.data.hours.slice(0,24).reduce((a,h)=>a+h.wind_speed_10m,0)/24/3.6;return{windAvg,rows,pv:sum('pv'),wind:sum('wind'),load:sum('load'),grid:sum('grid'),unserved:sum('unserved'),minSoc:Math.min(...rows.map(r=>r.soc)),peak:rows.reduce((a,r)=>r.pv>a.pv?r:a,rows[0])}},[w.data,design,config,lat,lon,field.area_ha]);
 if(w.isPending)return <div className="planner-loading"><span/><p>Беремо прогноз хмар і вітру для ферми…</p></div>;
 if(!sim)return null;
 const self=sim.load>0?Math.min(100,Math.round((sim.pv+sim.wind)/sim.load*100)):0;
 return <section className="energy24">
  <header><div><span className="eyebrow">ENERGY · НАСТУПНІ 24 ГОДИНИ</span><h3>Скільки енергії дасть ваша ферма за прогнозом</h3><p>Модель саме цієї схеми (панелі, вітряк, батарея, насоси) прогнана погодинно за реальним прогнозом хмарності й вітру над полем. Вночі сонячна генерація дорівнює нулю — це фізика, а не помилка.</p></div></header>
  <div className="e24-kpis">
   <div><small>Сонце за добу</small><b>{sim.pv.toFixed(0)}<em> кВт·год</em></b><span>пік о {sim.peak.t} · {sim.peak.pv.toFixed(1)} кВт</span></div>
   <div><small>Вітер за добу</small><b>{sim.wind.toFixed(0)}<em> кВт·год</em></b><span>{sim.wind<1?(design.objects.some(o=>o.kind==='wind')?`вітер ${sim.windAvg.toFixed(1)} м/с — нижче порогу запуску 2.5 м/с`:'вітряка в схемі немає'):`середній вітер ${sim.windAvg.toFixed(1)} м/с`}</span></div>
   <div><small>Споживання</small><b>{sim.load.toFixed(0)}<em> кВт·год</em></b><span>базове навантаження + насоси</span></div>
   <div><small>Власна енергія</small><b className={self>=80?'good':self<40?'bad':''}>{self}<em> %</em></b><span>{sim.grid>0?`з мережі ${sim.grid.toFixed(0)} кВт·год`:sim.unserved>0?`не вистачить ${sim.unserved.toFixed(0)} кВт·год`:'мережа не потрібна'}</span></div>
   <div><small>Мінімальний заряд батареї</small><b className={sim.minSoc<20?'bad':''}>{sim.minSoc}<em> %</em></b><span>{sim.minSoc<20?'вночі батарея майже розрядиться':'запас є'}</span></div>
  </div>
  <ResponsiveContainer width="100%" height={210}><ComposedChart data={sim.rows} margin={{top:8,right:8,left:-10,bottom:0}}><CartesianGrid stroke="#ffffff0d" vertical={false}/><XAxis dataKey="t" tick={{fill:'#86a8b4',fontSize:10}} interval={3}/><YAxis yAxisId="k" tick={{fill:'#86a8b4',fontSize:10}} unit=" кВт"/><YAxis yAxisId="s" orientation="right" domain={[0,100]} tick={{fill:'#86a8b4',fontSize:10}} unit="%"/>
   <Tooltip contentStyle={{background:'#061420',border:'1px solid #2c4a5a',borderRadius:8,fontSize:12}} formatter={(v,n)=>[`${v}${n==='soc'?' %':' кВт'}`,({pv:'Сонце',wind:'Вітер',load:'Споживання',soc:'Батарея'} as Record<string,string>)[String(n)]||n]}/>
   <Area yAxisId="k" dataKey="pv" stackId="g" fill="#ffd16655" stroke="#ffd166"/><Area yAxisId="k" dataKey="wind" stackId="g" fill="#5fd4ff44" stroke="#5fd4ff"/><Line yAxisId="k" dataKey="load" stroke="#ff8a76" strokeWidth={2} dot={false}/><Line yAxisId="s" dataKey="soc" stroke="#b6ff47" strokeDasharray="4 3" dot={false}/></ComposedChart></ResponsiveContainer>
  <p className="chart-read">Жовте — сонце, блакитне — вітер, червона лінія — споживання, пунктир — заряд батареї. Часовий пояс поля: {w.data?.timezone}.</p>
 </section>;
}
