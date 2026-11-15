'use client';
import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ResponsiveContainer,ComposedChart,Line,Bar,Area,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {api} from '@/lib/api';
import './field-weather.css';

type Hour={time:string;temperature_2m:number;relative_humidity_2m:number;precipitation:number;precipitation_probability:number|null;cloud_cover:number;wind_speed_10m:number;wind_direction_10m:number;wind_gusts_10m:number;soil_temperature_6cm:number|null;soil_moisture_3_to_9cm:number|null;et0_fao_evapotranspiration:number|null};
type Day={date:string;weather_code:number;temperature_2m_max:number;temperature_2m_min:number;precipitation_sum:number;precipitation_probability_max:number|null;wind_speed_10m_max:number;wind_gusts_10m_max:number;wind_direction_10m_dominant:number;sunshine_duration:number;et0_fao_evapotranspiration:number;spray_window:boolean;frost:boolean;heat:boolean;storm:boolean};
type Detail={timezone:string;hours:Hour[];days:Day[];cloud_frames:{date:string;terra:string;viirs:string}[];bbox:number[];field:[number,number];source:string;imagery:string;fetched_at:string};

const WEEK=['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
const compass=(d:number)=>['Пн','ПнСх','Сх','ПдСх','Пд','ПдЗх','Зх','ПнЗх'][Math.round(d/45)%8];
function kind(code:number){if(code>=95)return'storm';if(code>=71&&code<=86)return'snow';if(code>=51)return'rain';if(code>=45)return'fog';if(code>=2)return'cloud';return'sun'}
function Icon({code}:{code:number}){const k=kind(code);return <svg viewBox="0 0 48 48" width="40" height="40" aria-label={k}>
 {(k==='sun'||k==='cloud')&&<g><circle cx={k==='sun'?24:18} cy={k==='sun'?24:18} r={k==='sun'?9:7} fill="#ffd166"/>{k==='sun'&&[0,45,90,135,180,225,270,315].map(a=><line key={a} x1={24+13*Math.cos(a*Math.PI/180)} y1={24+13*Math.sin(a*Math.PI/180)} x2={24+17*Math.cos(a*Math.PI/180)} y2={24+17*Math.sin(a*Math.PI/180)} stroke="#ffd166" strokeWidth="2.5" strokeLinecap="round"/>)}</g>}
 {k!=='sun'&&<path d="M14 34h21a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 0 13Z" fill={k==='storm'?'#6b7a8f':'#cfdbe4'}/>}
 {k==='rain'&&[16,24,32].map(x=><line key={x} x1={x} y1="38" x2={x-3} y2="45" stroke="#5fb4ff" strokeWidth="2.5" strokeLinecap="round"/>)}
 {k==='snow'&&[16,24,32].map(x=><circle key={x} cx={x} cy="42" r="2" fill="#fff"/>)}
 {k==='storm'&&<path d="m25 34-5 8h5l-3 6 8-10h-5l3-4Z" fill="#ffd166"/>}
 {k==='fog'&&[38,43].map(y=><line key={y} x1="10" y1={y} x2="38" y2={y} stroke="#a9bccb" strokeWidth="2.5" strokeLinecap="round"/>)}
</svg>}
const Arrow=({deg,size=16}:{deg:number;size?:number})=><svg width={size} height={size} viewBox="0 0 16 16" style={{transform:`rotate(${deg+180}deg)`}} aria-label={`вітер з ${compass(deg)}`}><path d="M8 1 13 13 8 10 3 13Z" fill="currentColor"/></svg>;

function sprayOk(h:Hour){return h.wind_speed_10m<15&&h.precipitation<.1&&(h.precipitation_probability??0)<30&&h.temperature_2m>5&&h.temperature_2m<25&&h.relative_humidity_2m>40}
function windows(hours:Hour[]){const out:{start:string;end:string}[]=[];let s:string|null=null;hours.forEach((h,i)=>{const ok=sprayOk(h);if(ok&&!s)s=h.time;if((!ok||i===hours.length-1)&&s){const end=ok?h.time:hours[i-1].time;const len=(new Date(end).getTime()-new Date(s).getTime())/36e5+1;if(len>=3)out.push({start:s,end});s=null}});return out}
const label=(t:string)=>{const d=new Date(t);return `${WEEK[d.getDay()]} ${String(d.getHours()).padStart(2,'0')}:00`};

export default function FieldWeather({fieldId}:{fieldId:string}){
 const q=useQuery({queryKey:['weather-detail',fieldId],queryFn:()=>api<Detail>(`/fields/${fieldId}/weather-detail`),staleTime:1800000,retry:1});
 const d=q.data;
 return <section className="wx" id="weather">
  <header className="wx-head"><div><span className="eyebrow">WEATHER · SATELLITE · OPERATIONS</span><h3>Погода для польових робіт</h3><p>Хмари з космосу за останні дні, прогноз на 72 години й 14 днів — і коли саме можна працювати в полі.</p></div></header>
  {q.isPending&&<div className="planner-loading"><span/><p>Отримуємо прогноз і знімки хмарності NASA…</p></div>}
  {q.error&&<p role="alert" className="planner-error">{(q.error as Error).message}</p>}
  {d&&<>
   <div className="wx-top"><CloudLoop d={d}/><NowPanel d={d}/></div>
   <Timeline d={d}/>
   <WorkWindows d={d}/>
   <div className="wx-days">{d.days.map((day,i)=>{const dt=new Date(day.date);return <article key={day.date} className={`${day.frost?'frost':''} ${day.heat?'heat':''} ${day.storm?'storm':''}`}>
    <b>{i===0?'Сьогодні':i===1?'Завтра':WEEK[dt.getDay()]}<small>{day.date.slice(8)}.{day.date.slice(5,7)}</small></b><Icon code={day.weather_code}/>
    <strong>{Math.round(day.temperature_2m_max)}°<em>{Math.round(day.temperature_2m_min)}°</em></strong>
    <span className="rain">{day.precipitation_sum>0?`${day.precipitation_sum.toFixed(1)} мм`:'без опадів'}{day.precipitation_probability_max!=null&&day.precipitation_sum>0?` · ${day.precipitation_probability_max}%`:''}</span>
    <span className="wind"><Arrow deg={day.wind_direction_10m_dominant}/>{Math.round(day.wind_speed_10m_max)} км/год</span>
    <span className="sun">☀ {(day.sunshine_duration/3600).toFixed(1)} год · ET₀ {day.et0_fao_evapotranspiration?.toFixed(1)}</span>
    <div className="tags">{day.spray_window&&<i className="ok">обприскування</i>}{day.frost&&<i className="frost">заморозок</i>}{day.heat&&<i className="heat">спека</i>}{day.storm&&<i className="storm">пориви {Math.round(day.wind_gusts_10m_max)}</i>}</div>
   </article>})}</div>
   <p className="wx-source">{d.source} · часовий пояс {d.timezone} · {d.imagery}. Прогноз регіональний (~10–25 км), не вимірювання в полі; невизначеність зростає з горизонтом.</p>
  </>}
 </section>;
}

function CloudLoop({d}:{d:Detail}){
 const[sensor,setSensor]=useState<'terra'|'viirs'>('viirs');const[i,setI]=useState(d.cloud_frames.length-1);const[play,setPlay]=useState(true);
 useEffect(()=>{if(!play)return;const t=setInterval(()=>setI(x=>(x+1)%d.cloud_frames.length),1100);return()=>clearInterval(t)},[play,d.cloud_frames.length]);
 const [s,w,n,e]=d.bbox;const fx=(d.field[0]-w)/(e-w)*100,fy=(n-d.field[1])/(n-s)*100;
 return <div className="cloud-loop"><div className="cloud-frames">{d.cloud_frames.map((f,k)=><img key={f.date+sensor} src={f[sensor]} alt={`${sensor==='terra'?'MODIS Terra':'VIIRS NOAA-20'} ${f.date}`} style={{opacity:k===i?1:0}} loading="lazy"/>)}
  <div className="field-mark" style={{left:`${fx}%`,top:`${fy}%`}}><i/><span>Ваше поле</span></div>
  <div className="cloud-date">{d.cloud_frames[i].date} · {sensor==='terra'?'MODIS Terra 250 м':'VIIRS NOAA‑20 375 м'}</div></div>
  <div className="cloud-ctrl"><button onClick={()=>setPlay(!play)}>{play?'❚❚':'▶'}</button>{d.cloud_frames.map((f,k)=><button key={f.date} aria-pressed={k===i} onClick={()=>{setI(k);setPlay(false)}}>{f.date.slice(8)}.{f.date.slice(5,7)}</button>)}<span/><button aria-pressed={sensor==='viirs'} onClick={()=>setSensor('viirs')}>VIIRS</button><button aria-pressed={sensor==='terra'} onClick={()=>setSensor('terra')}>Terra</button></div>
  <p className="cloud-note">Справжні знімки NASA GIBS над регіоном {Math.round((e-w)*111*Math.cos(d.field[1]*Math.PI/180))}×{Math.round((n-s)*111)} км. Білі ділянки — хмари в момент прольоту (близько 10:30 і 13:30 місцевого часу).</p></div>;
}

function NowPanel({d}:{d:Detail}){
 const h=d.hours[0];const soilT=h.soil_temperature_6cm,soilM=h.soil_moisture_3_to_9cm;
 return <div className="wx-now"><span className="eyebrow">ЗАРАЗ НАД ПОЛЕМ</span>
  <div className="now-temp"><b>{Math.round(h.temperature_2m)}°</b><div><span><Arrow deg={h.wind_direction_10m} size={18}/> {Math.round(h.wind_speed_10m)} км/год з {compass(h.wind_direction_10m)}</span><span>Пориви {Math.round(h.wind_gusts_10m)} км/год</span><span>Хмарність {h.cloud_cover}% · вологість {h.relative_humidity_2m}%</span></div></div>
  <div className="soil-now"><div><small>Ґрунт на 6 см</small><b>{soilT!=null?`${soilT.toFixed(1)}°`:'—'}</b><em>{soilT==null?'':soilT>=10?'тепло для кукурудзи, сої':soilT>=6?'можна сіяти ранні ярі':'сівбу ярих варто відкласти'}</em></div>
   <div><small>Волога 3–9 см</small><b>{soilM!=null?`${Math.round(soilM*100)}%`:'—'}</b><em>{soilM==null?'':soilM>.38?'перезволожено — техніка може грузнути':soilM<.15?'сухо — посіви чекатимуть дощу':'нормальна для робіт'}</em></div></div>
 </div>;
}

function Timeline({d}:{d:Detail}){
 const data=useMemo(()=>d.hours.map(h=>({t:label(h.time),temp:h.temperature_2m,rain:h.precipitation,cloud:h.cloud_cover,prob:h.precipitation_probability??0,wind:h.wind_speed_10m,dir:h.wind_direction_10m})),[d]);
 return <div className="wx-timeline"><h4>Наступні 72 години</h4>
  <ResponsiveContainer width="100%" height={230}><ComposedChart data={data} margin={{top:10,right:10,left:-8,bottom:0}}><CartesianGrid stroke="#ffffff0d" vertical={false}/>
   <XAxis dataKey="t" tick={{fill:'#86a8b4',fontSize:10}} interval={11}/><YAxis yAxisId="t" tick={{fill:'#86a8b4',fontSize:10}} unit="°"/><YAxis yAxisId="c" orientation="right" domain={[0,100]} hide/><YAxis yAxisId="r" orientation="right" tick={{fill:'#5fb4ff',fontSize:10}} unit="мм"/>
   <Tooltip contentStyle={{background:'#061420',border:'1px solid #2c4a5a',borderRadius:8,fontSize:12}} formatter={(v,n)=>[n==='temp'?`${v}°C`:n==='rain'?`${v} мм`:n==='cloud'?`${v}%`:n==='prob'?`${v}%`:`${v}`,({temp:'Температура',rain:'Опади',cloud:'Хмарність',prob:'Ймовірність дощу'} as Record<string,string>)[String(n)]||n]}/>
   <Area yAxisId="c" dataKey="cloud" fill="#cfdbe41a" stroke="#cfdbe433"/><Bar yAxisId="r" dataKey="rain" fill="#5fb4ff" barSize={4}/><Line yAxisId="t" dataKey="temp" stroke="#ffb547" strokeWidth={2.5} dot={false}/></ComposedChart></ResponsiveContainer>
  <div className="wind-row">{d.hours.filter((_,i)=>i%3===0).map(h=><span key={h.time} title={`${label(h.time)} · ${Math.round(h.wind_speed_10m)} км/год з ${compass(h.wind_direction_10m)}`} style={{color:h.wind_speed_10m>25?'#ff8a76':h.wind_speed_10m>15?'#ffc670':'#8bd4e8'}}><Arrow deg={h.wind_direction_10m} size={13}/><small>{Math.round(h.wind_speed_10m)}</small></span>)}</div>
  <p className="chart-read">Помаранчева лінія — температура, сині стовпці — опади, сіра заливка — хмарність. Стрілки — куди дме вітер, колір — сила (жовтий &gt;15, червоний &gt;25 км/год).</p></div>;
}

function WorkWindows({d}:{d:Detail}){
 const w=windows(d.hours);const frostH=d.hours.filter(h=>h.temperature_2m<=0).length;const rainH=d.hours.filter(h=>h.precipitation>=.5).length;
 return <div className="wx-windows">
  <div className="win-bar">{d.hours.map(h=>{const c=h.precipitation>=.3?'rain':h.temperature_2m<=0?'frost':sprayOk(h)?'ok':h.wind_speed_10m>=15?'wind':'meh';return <i key={h.time} className={c} title={`${label(h.time)} · ${({rain:'дощ',frost:'мороз',ok:'можна обприскувати',wind:'вітряно',meh:'не ідеально'} as Record<string,string>)[c]}`}/>})}</div>
  <div className="win-legend"><span><i className="ok"/>можна обприскувати</span><span><i className="rain"/>дощ</span><span><i className="wind"/>вітер ≥15</span><span><i className="frost"/>мороз</span></div>
  <div className="win-cards"><article><small>Вікно для обприскування</small><b>{w.length?`${label(w[0].start)} – ${label(w[0].end).slice(3)}`:'немає в 72 год'}</b><p>Вітер &lt;15 км/год, без дощу, 5–25 °C, вологість &gt;40%.{w.length>1?` Ще ${w.length-1} вікн${w.length===2?'о':'а'}.`:''}</p></article>
   <article><small>Годин з дощем</small><b>{rainH} год</b><p>{rainH>12?'Плануйте роботи з технікою після просихання ґрунту.':'Ґрунт встигатиме просихати між дощами.'}</p></article>
   <article><small>Годин з морозом</small><b>{frostH} год</b><p>{frostH?'Ризик для сходів і обприскування — препарати гірше діють на холоді.':'Морозу не очікується.'}</p></article></div></div>;
}
