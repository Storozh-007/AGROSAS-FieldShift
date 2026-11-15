'use client';
import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ResponsiveContainer,ComposedChart,Line,Bar,Area,XAxis,YAxis,Tooltip,CartesianGrid,ReferenceLine,Cell} from 'recharts';
import {api} from '@/lib/api';
import type {Field} from '@/lib/types';
import type {Climate,ClimateYear} from '@/lib/planner';
import './climate-time-machine.css';

type Y=ClimateYear&{tmean?:number;frost_days:number;heavy_rain_days:number;max_daily_mm?:number;heat_days_35?:number};
type Site={built:boolean;climate?:Climate&{years:Y[]};point?:[number,number]};
const tip={contentStyle:{background:'#061420',border:'1px solid #2c4a5a',borderRadius:8,fontSize:12}};
function ols(xs:number[],ys:number[]){const n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2});const b=sxy/sxx,a=my-b*mx;const res=ys.map((y,i)=>y-(a+b*xs[i]));const sd=Math.sqrt(res.reduce((s,r)=>s+r*r,0)/(n-2));return{a,b,sd}}
const stripe=(z:number)=>{const t=Math.max(-1,Math.min(1,z/2.2));return t<0?`rgb(${Math.round(40+(1+t)*170)},${Math.round(90+(1+t)*130)},${Math.round(200+(1+t)*40)})`:`rgb(${Math.round(240)},${Math.round(220-t*170)},${Math.round(210-t*180)})`};

const METRICS=[
 {k:'season_balance_mm',name:'Баланс сезону',unit:'мм',better:1,desc:'опади мінус потреба атмосфери (ET0), квітень–вересень'},
 {k:'precip_mm',name:'Опади за рік',unit:'мм',better:1,desc:'усього за рік'},
 {k:'heat_days_32',name:'Спекотні дні',unit:'дн',better:-1,desc:'Tmax ≥ 32 °C у сезоні'},
 {k:'frost_days',name:'Дні з морозом',unit:'дн',better:0,desc:'Tmin ≤ 0 °C за рік'},
 {k:'heavy_rain_days',name:'Зливи',unit:'дн',better:-1,desc:'дні з опадами ≥ 25 мм'},
 {k:'gdd10',name:'Сума тепла',unit:'°C·дн',better:0,desc:'градусо-дні вище 10 °C — скільки тепла для дозрівання'},
] as const;
type MK=typeof METRICS[number]['k'];

export default function ClimateTimeMachine({field}:{field:Field}){
 const q=useQuery({queryKey:['site-passport',field.id],queryFn:async()=>{const s=await api<Site>(`/fields/${field.id}/site`);return s.built?s:api<Site>(`/fields/${field.id}/site`,{})},staleTime:3600000});
 const years=q.data?.climate?.years as Y[]|undefined;const c=q.data?.climate;
 const[year,setYear]=useState<number|null>(null);const[metric,setMetric]=useState<MK>('season_balance_mm');
 const stats=useMemo(()=>{if(!years?.length)return null;const ys=years.map(y=>y.year);const t=years.map(y=>y.tmean??NaN);const hasT=t.every(Number.isFinite);const tm=hasT?t.reduce((a,b)=>a+b,0)/t.length:0;const tsd=hasT?Math.sqrt(t.reduce((s,v)=>s+(v-tm)**2,0)/t.length):1;
  const half=Math.floor(years.length/3);const early=years.slice(0,half),late=years.slice(-half);const avg=(a:Y[],k:MK)=>a.reduce((s,y)=>s+(y[k] as number),0)/a.length;
  return{ys,hasT,tm,tsd,early,late,avg}},[years]);
 if(q.isPending)return <div className="planner-loading"><span/><p>Завантажуємо 30 років клімату ERA5 для поля…</p></div>;
 if(q.error)return <p className="planner-error">{(q.error as Error).message}</p>;
 if(!years||!c||!stats)return <p className="planner-error">Кліматичні дані для поля недоступні.</p>;
 const sel=years.find(y=>y.year===(year??years[years.length-1].year))!;const m=METRICS.find(x=>x.k===metric)!;
 const vals=years.map(y=>y[metric] as number);const mean=vals.reduce((a,b)=>a+b,0)/vals.length;const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)||1;
 const fit=ols(stats.ys,vals);const last=stats.ys[stats.ys.length-1];
 const chart=[...years.map(y=>({year:y.year,v:y[metric] as number,trend:fit.a+fit.b*y.year})),...Array.from({length:2035-last},(_,i)=>{const yr=last+i+1,tr=fit.a+fit.b*yr,band=1.64*fit.sd;return{year:yr,trend:tr,lo:tr-band,band:2*band}})];
 const rank=(k:MK,y:Y)=>{const s=[...years].sort((a,b)=>(a[k] as number)-(b[k] as number));return s.findIndex(x=>x.year===y.year)+1};
 const analog=(()=>{const z=(y:Y,k:MK)=>{const v=years.map(x=>x[k] as number);const mu=v.reduce((a,b)=>a+b,0)/v.length;const s=Math.sqrt(v.reduce((q,x)=>q+(x-mu)**2,0)/v.length)||1;return((y[k] as number)-mu)/s};return years.filter(y=>y.year!==sel.year).map(y=>({y,d:(['season_balance_mm','heat_days_32','precip_mm'] as MK[]).reduce((s,k)=>s+(z(y,k)-z(sel,k))**2,0)})).sort((a,b)=>a.d-b.d)[0]?.y})();
 return <section className="ctm">
  <header className="ctm-head"><div><span className="eyebrow">CLIMATE TIME MACHINE · ERA5 {years[0].year}–{last}</span><h2>Як змінився клімат саме над цим полем</h2><p>{c.n_years} сезонів реаналізу ERA5 для точки поля ({q.data?.point?.[1].toFixed(2)}°, {q.data?.point?.[0].toFixed(2)}°, сітка ~25 км). Не прогноз погоди — довга пам’ять поля.</p></div></header>

  {stats.hasT&&<div className="stripes-card"><div className="stripes">{years.map(y=><button key={y.year} style={{background:stripe(((y.tmean??stats.tm)-stats.tm)/stats.tsd)}} aria-pressed={y.year===sel.year} title={`${y.year}: ${y.tmean?.toFixed(2)} °C`} onClick={()=>setYear(y.year)}/>)}</div>
   <div className="stripes-legend"><span>{years[0].year}</span><p>Смуги потепління: кожна смуга — середня температура року над полем. Синє — холодніше за середнє, червоне — тепліше. Тренд: <b>{(c.trend_per_decade.tmean_c??0)>=0?'+':''}{(c.trend_per_decade.tmean_c??0).toFixed(2)} °C за 10 років</b>. Натисніть на рік.</p><span>{last}</span></div></div>}

  <div className="ctm-year">
   <div className="ctm-year-head"><div><span>ОБРАНИЙ РІК</span><h3>{sel.year}</h3></div><input type="range" min={years[0].year} max={last} value={sel.year} onChange={e=>setYear(Number(e.target.value))} aria-label="Рік"/></div>
   <div className="ctm-cards">{METRICS.map(mm=>{const v=sel[mm.k] as number;const vs=years.map(y=>y[mm.k] as number);const mu=vs.reduce((a,b)=>a+b,0)/vs.length;const r=rank(mm.k,sel);const n=years.length;const d=v-mu;const good=mm.better===0?null:mm.better*d>0;
    return <button key={mm.k} className={`ctm-card ${metric===mm.k?'active':''}`} onClick={()=>setMetric(mm.k)}><small>{mm.name}</small><b>{Math.round(v)}<em> {mm.unit}</em></b><span className={good==null?'':good?'good':'bad'}>{d>=0?'+':''}{Math.round(d)} від норми</span><i>{r===1?'найменше':r===n?'найбільше':`${r}-е з ${n}`} за {n} років</i></button>})}</div>
   {analog&&<p className="ctm-analog">За посухою, спекою й опадами {sel.year} найбільше схожий на <button onClick={()=>setYear(analog.year)}>{analog.year}</button> — подивіться, що тоді росло добре.</p>}
  </div>

  <div className="ctm-grid">
   <div className="planner-card"><h3>{m.name}: {years[0].year} → 2035</h3><p className="planner-sub">{m.desc}. Лінія — тренд (МНК), заливка — куди може піти до 2035 з імовірністю 90%, якщо тренд збережеться. Це екстраполяція, не кліматична модель.</p>
    <ResponsiveContainer width="100%" height={280}><ComposedChart data={chart} margin={{top:8,right:8,left:-6,bottom:0}}><CartesianGrid stroke="#ffffff0d" vertical={false}/><XAxis dataKey="year" tick={{fill:'#86a8b4',fontSize:10}} interval={4}/><YAxis tick={{fill:'#86a8b4',fontSize:10}}/><Tooltip {...tip} formatter={(v,n)=>[`${Math.round(Number(v))} ${m.unit}`,({v:m.name,trend:'Тренд',band:'Коридор 90%'} as Record<string,string>)[String(n)]||n]}/>
     <ReferenceLine y={mean} stroke="#ffffff30" strokeDasharray="4 4"/><Area dataKey="lo" stackId="b" stroke="none" fill="transparent"/><Area dataKey="band" stackId="b" stroke="none" fill="#ffb54733"/>
     <Bar dataKey="v" radius={[3,3,0,0]}>{chart.map(d=><Cell key={d.year} fill={d.year===sel.year?'#ffffff':'v' in d&&d.v!=null?((d.v as number)-mean)/sd*(m.better||1)<-.8?'#ff6050':((d.v as number)-mean)/sd*(m.better||1)>.8?'#4fbf6a':'#4f8fb0':'transparent'}/>)}</Bar>
     <Line dataKey="trend" stroke="#ffb547" strokeWidth={2.5} dot={false}/></ComposedChart></ResponsiveContainer>
    <p className="chart-read">Тренд: <b>{fit.b*10>=0?'+':''}{(fit.b*10).toFixed(1)} {m.unit} за 10 років</b>. Якщо збережеться — у 2035 близько <b>{Math.round(fit.a+fit.b*2035)} {m.unit}</b> (зараз у середньому {Math.round(mean)}).</p></div>
   <div className="planner-card"><h3>Було → стало</h3><p className="planner-sub">Перші {stats.early.length} років ({stats.early[0].year}–{stats.early[stats.early.length-1].year}) проти останніх ({stats.late[0].year}–{last}).</p>
    <div className="decades">{METRICS.map(mm=>{const a=stats.avg(stats.early,mm.k),b=stats.avg(stats.late,mm.k);const pct=a?((b-a)/Math.abs(a))*100:0;const good=mm.better===0?null:mm.better*(b-a)>0;return <div key={mm.k}><span>{mm.name}</span><div className="dec-bar"><i style={{width:`${Math.min(100,Math.abs(pct))}%`}} className={good==null?'':good?'good':'bad'}/></div><b className={good==null?'':good?'good':'bad'}>{b-a>=0?'+':''}{Math.round(b-a)} {mm.unit}</b></div>})}</div>
    <p className="chart-read">{(()=>{const db=stats.avg(stats.late,'season_balance_mm')-stats.avg(stats.early,'season_balance_mm');const dh=stats.avg(stats.late,'heat_days_32')-stats.avg(stats.early,'heat_days_32');return `Сезон став ${db<0?'сухішим':'вологішим'} на ${Math.abs(Math.round(db))} мм, а спекотних днів ${dh>=0?'більше':'менше'} на ${Math.abs(dh).toFixed(1)}. ${db<-40||dh>3?'Це аргумент на користь посухостійких культур і озимих, які встигають використати весняну вологу.':'Клімат поля відносно стабільний — головні ризики в окремих екстремальних роках.'}`})()}</p></div>
  </div>
  <p className="wx-source">{c.source} · {c.native_resolution} · {c.method??''}</p>
 </section>;
}
