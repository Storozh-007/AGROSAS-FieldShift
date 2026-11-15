'use client';
import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import * as satellite from 'satellite.js';
import {api} from '@/lib/api';
import {FLEET} from '@/lib/orbital-layer';

type Rec={norad_id:number;line1?:string;line2?:string;name?:string;unavailable?:boolean};
type Seen={name:string;az:number;el:number;color:string;star:boolean;range:number};

/** Live polar sky plot for the field: which satellites are above the horizon right now (SGP4 look angles). */
export default function SkyPlot({lat,lon}:{lat:number;lon:number}){
 const fleet=useQuery({queryKey:['live-orbits'],queryFn:()=>api<{records:Rec[]}>('/orbits'),staleTime:3600000});
 const star=useQuery({queryKey:['starlink-sample'],queryFn:()=>api<{records:Rec[];total:number}>('/orbits/starlink'),staleTime:3600000,retry:0});
 const recs=useMemo(()=>{const out:{name:string;rec:satellite.SatRec;color:string;star:boolean}[]=[];
  for(const c of FLEET){const r=fleet.data?.records.find(x=>x.norad_id===c.norad);if(r?.line1&&r.line2)out.push({name:c.name,rec:satellite.twoline2satrec(r.line1,r.line2),color:c.color,star:false})}
  for(const r of star.data?.records||[])if(r.line1&&r.line2)out.push({name:r.name||'Starlink',rec:satellite.twoline2satrec(r.line1,r.line2),color:'#e8f0a0',star:true});return out},[fleet.data,star.data]);
 const[now,setNow]=useState(()=>new Date());useEffect(()=>{const t=setInterval(()=>setNow(new Date()),2000);return()=>clearInterval(t)},[]);
 const seen=useMemo(()=>{const obs={latitude:lat*Math.PI/180,longitude:lon*Math.PI/180,height:.15};const g=satellite.gstime(now);const out:Seen[]=[];
  for(const s of recs){const pv=satellite.propagate(s.rec,now);if(!pv?.position||typeof pv.position==='boolean')continue;const look=satellite.ecfToLookAngles(obs,satellite.eciToEcf(pv.position,g));const el=look.elevation*180/Math.PI;if(el>0)out.push({name:s.name,az:look.azimuth*180/Math.PI,el,color:s.color,star:s.star,range:look.rangeSat})}
  return out.sort((a,b)=>b.el-a.el)},[recs,now,lat,lon]);
 const next=useMemo(()=>{const obs={latitude:lat*Math.PI/180,longitude:lon*Math.PI/180,height:.15};const t0=Math.floor(now.getTime()/60000)*60000;for(let m=0;m<=360;m+=1){const t=new Date(t0+m*60000);const g=satellite.gstime(t);for(const s of recs){if(s.star)continue;const pv=satellite.propagate(s.rec,t);if(!pv?.position||typeof pv.position==='boolean')continue;const el=satellite.ecfToLookAngles(obs,satellite.eciToEcf(pv.position,g)).elevation*180/Math.PI;if(el>10)return{name:s.name,at:t,inMin:m}}}return null},[recs,lat,lon,Math.floor(now.getTime()/60000)]);// eslint-disable-line react-hooks/exhaustive-deps
 const R=120,C=130;const xy=(az:number,el:number)=>{const r=(90-el)/90*R,a=az*Math.PI/180;return[C+r*Math.sin(a),C-r*Math.cos(a)]};
 const nasa=seen.filter(s=>!s.star),sl=seen.filter(s=>s.star);
 return <section className="sky">
  <div><span className="eyebrow">SKY ABOVE THE FARM · LIVE SGP4</span><h4>Хто зараз над вашою фермою</h4><p>Полярна карта неба над полем: центр — зеніт, край — горизонт, північ угорі. Позиції рахуються наживо з орбітальних елементів CelesTrak кожні 2 секунди.</p>
   <ul className="sky-list">{nasa.length?nasa.map(s=><li key={s.name}><i style={{background:s.color}}/><b>{s.name}</b><span>{s.el.toFixed(0)}° над горизонтом · {Math.round(s.range)} км</span></li>):<li className="none">Жоден супутник NASA/ESA зараз не над горизонтом.{next?<> Наступний — <b>{next.name}</b> через {next.inMin<60?`${next.inMin} хв`:`${Math.floor(next.inMin/60)} год ${next.inMin%60} хв`} ({next.at.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}).</>:''}</li>}</ul>
   <p className="sky-star"><b>{sl.length}</b> з {star.data?.records.length||0} відстежуваних Starlink зараз над фермою{star.data?` (усього в каталозі ${star.data.total.toLocaleString('uk-UA')})`:''} — саме вони дають інтернет датчикам у полі.</p></div>
  <svg viewBox="-16 -16 292 292" className="sky-svg" role="img" aria-label="Небо над фермою">
   {[0,30,60].map(e=><circle key={e} cx={C} cy={C} r={(90-e)/90*R} fill="none" stroke="#ffffff1f" strokeDasharray={e?'3 4':undefined}/>)}
   {[0,90,180,270].map(a=>{const[x,y]=xy(a,0);return <line key={a} x1={C} y1={C} x2={x} y2={y} stroke="#ffffff14"/>})}
   {(['Пн','Сх','Пд','Зх'] as const).map((t,i)=>{const[x,y]=xy(i*90,-9);return <text key={t} x={x} y={y+4} textAnchor="middle" fontSize="10" fill="#86a8b4">{t}</text>})}
   <text x={C+3} y={C-(90-30)/90*R-3} fontSize="8" fill="#5f8594">30°</text><text x={C+3} y={C-(90-60)/90*R-3} fontSize="8" fill="#5f8594">60°</text>
   {sl.map(s=>{const[x,y]=xy(s.az,s.el);return <circle key={s.name} cx={x} cy={y} r={1.8} fill="#e8f0a0" opacity=".8"><title>{s.name} · {s.el.toFixed(0)}°</title></circle>})}
   {nasa.map(s=>{const[x,y]=xy(s.az,s.el);return <g key={s.name}><circle cx={x} cy={y} r={5} fill={s.color} stroke="#06121d" strokeWidth="1.5"/><text x={x+7} y={y+3} fontSize="9" fill="#fff">{s.name}</text></g>})}
   <circle cx={C} cy={C} r={3} fill="#b6ff47"/>
  </svg>
 </section>;
}
