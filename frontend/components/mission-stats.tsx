'use client';
import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ResponsiveContainer,ScatterChart,Scatter,XAxis,YAxis,ZAxis,Tooltip,CartesianGrid,ReferenceArea,LabelList,BarChart,Bar,Cell} from 'recharts';
import {api} from '@/lib/api';

// Published mission facts (agency fact sheets). Resolution = finest farm-relevant product; revisit = typical repeat over one field.
const M=[
 {id:'terra',name:'Terra / MODIS',launch:'1999-12-18',res:250,revisit:1,period:98.9,color:'#7dd3fc',farm:'щоденна вегетація регіону'},
 {id:'landsat8',name:'Landsat 8',launch:'2013-02-11',res:30,revisit:16,period:98.9,color:'#59d9f7',farm:'NDVI і тепло поля'},
 {id:'landsat9',name:'Landsat 9',launch:'2021-09-27',res:30,revisit:16,period:98.9,color:'#86efac',farm:'разом з L8 — 8 діб'},
 {id:'smap',name:'SMAP',launch:'2015-01-31',res:9000,revisit:2.5,period:98.5,color:'#22d3ee',farm:'волога ґрунту'},
 {id:'gpm',name:'GPM / IMERG',launch:'2014-02-27',res:10000,revisit:.02,period:92.6,color:'#60a5fa',farm:'опади кожні 30 хв'},
 {id:'viirs',name:'NOAA‑20 / VIIRS',launch:'2017-11-18',res:375,revisit:.5,period:101.4,color:'#c4b5fd',farm:'щоденний огляд, пожежі'},
 {id:'ecostress',name:'ECOSTRESS',launch:'2018-06-29',res:70,revisit:4,period:92.9,color:'#fbbf24',farm:'водний стрес удень'},
 {id:'gedi',name:'GEDI',launch:'2018-12-05',res:25,revisit:60,period:92.9,color:'#f59e0b',farm:'висота рослинності'},
 {id:'sentinel2',name:'Sentinel‑2',launch:'2015-06-23',res:10,revisit:5,period:100.6,color:'#f472b6',farm:'NDVI 10 м — зони поля'},
];
const years=(d:string)=>(Date.now()-new Date(d).getTime())/(365.25*864e5);
const tip={contentStyle:{background:'#061420',border:'1px solid #2c4a5a',borderRadius:8,fontSize:12}};

export default function MissionStats(){
 const orbits=useQuery({queryKey:['live-orbits'],queryFn:()=>api<{records:{norad_id:number;unavailable?:boolean}[]}>('/orbits'),staleTime:3600000,retry:1});
 const star=useQuery({queryKey:['starlink-count'],queryFn:()=>api<{total:number;total_as_of?:string|null;source:string}>('/orbits/starlink'),staleTime:3600000,retry:0});
 const rows=useMemo(()=>M.map(m=>{const y=years(m.launch);return{...m,years:+y.toFixed(1),orbits:Math.round(y*365.25*1440/m.period),km:Math.round(y*365.25*1440/m.period*2*Math.PI*(6371+700)/1e6)}}),[]);
 const live=orbits.data?.records.filter(r=>!r.unavailable).length;
 const totalYears=rows.reduce((a,r)=>a+r.years,0);const totalOrbits=rows.reduce((a,r)=>a+r.orbits,0);
 return <section className="mstats">
  <header><span className="eyebrow">GLOBAL EARTH OBSERVATION · LIVE</span><h3>Флот, який дивиться на ваше поле</h3><p>Факти місій — з офіційних довідок NASA/ESA; кількість апаратів і витки рахуються наживо з орбітальних елементів.</p></header>
  <div className="mstats-kpis">
   <div><b>{live??'…'}</b><small>супутників на SGP4 зараз</small></div>
   <div><b>{star.data?star.data.total.toLocaleString('uk-UA'):'…'}</b><small>апаратів Starlink у каталозі CelesTrak{star.data?.total_as_of?` · станом на ${star.data.total_as_of}`:''}</small></div>
   <div><b>{Math.round(totalYears)}</b><small>років спостережень разом</small></div>
   <div><b>{(totalOrbits/1e3).toFixed(0)} тис.</b><small>витків навколо Землі</small></div>
   <div><b>{rows.reduce((a,r)=>a+r.km,0).toLocaleString('uk-UA')}</b><small>млн км пролетіли</small></div>
  </div>
  <div className="mstats-grid">
   <div className="planner-card"><h4>Детальність vs як часто знімає</h4><p className="planner-sub">Ліворуч — детальніше, внизу — частіше. Зелена зона — ідеально для окремого поля: ≤30 м і ≤7 діб. Тому платформа поєднує Sentinel‑2 і Landsat для поля, а SMAP і GPM — для води регіону.</p>
    <ResponsiveContainer width="100%" height={320}><ScatterChart margin={{top:10,right:20,left:0,bottom:10}}><CartesianGrid stroke="#ffffff10"/>
     <XAxis type="number" dataKey="res" scale="log" domain={[5,20000]} ticks={[10,30,100,300,1000,3000,10000]} tick={{fill:'#86a8b4',fontSize:10}} tickFormatter={v=>v>=1000?`${v/1000} км`:`${v} м`} name="Роздільність"/>
     <YAxis type="number" dataKey="revisit" scale="log" domain={[.01,100]} ticks={[.02,.1,.5,1,5,16,60]} tick={{fill:'#86a8b4',fontSize:10}} tickFormatter={v=>v<1/24?`${Math.round(v*1440)} хв`:v<1?`${Math.round(v*24)} год`:`${v} дн`} name="Повторність" reversed={false}/>
     <ZAxis range={[90,90]}/><ReferenceArea x1={5} x2={30} y1={.01} y2={7} fill="#b6ff47" fillOpacity={.1} stroke="#b6ff4766"/>
     <Tooltip {...tip} cursor={{strokeDasharray:'3 3'}} formatter={(v,n)=>[n==='Роздільність'?`${v} м`:`${Number(v)<1/24?`${Math.round(Number(v)*1440)} хв`:Number(v)<1?`${Math.round(Number(v)*24)} год`:`${v} діб`}`,n]} labelFormatter={()=>''}/>
     <Scatter data={rows} shape={(p:{cx?:number;cy?:number;payload?:{name:string;color:string}})=><g><circle cx={p.cx} cy={p.cy} r={6} fill={p.payload?.color} stroke="#06121d" strokeWidth={2}/><text x={(p.cx||0)+9} y={(p.cy||0)+4} fill="#cfe3e9" fontSize={10}>{p.payload?.name}</text></g>}/></ScatterChart></ResponsiveContainer></div>
   <div className="planner-card"><h4>Скільки років на орбіті</h4><p className="planner-sub">Terra знімає Землю понад 25 років — це основа кліматичних трендів вашого поля.</p>
    <ResponsiveContainer width="100%" height={320}><BarChart data={[...rows].sort((a,b)=>b.years-a.years)} layout="vertical" margin={{top:4,right:30,left:10,bottom:4}}><CartesianGrid stroke="#ffffff0d" horizontal={false}/><XAxis type="number" tick={{fill:'#86a8b4',fontSize:10}} unit=" р"/><YAxis type="category" dataKey="name" width={110} tick={{fill:'#cfe3e9',fontSize:10}}/><Tooltip {...tip} formatter={(v,n,p)=>[`${v} років · ${(p.payload as {orbits:number}).orbits.toLocaleString('uk-UA')} витків`,'На орбіті']}/>
     <Bar dataKey="years" radius={[0,4,4,0]}>{[...rows].sort((a,b)=>b.years-a.years).map(r=><Cell key={r.id} fill={r.color}/>)}<LabelList dataKey="years" position="right" style={{fill:'#cfe3e9',fontSize:10}}/></Bar></BarChart></ResponsiveContainer></div>
  </div>
  <div className="mstats-table">{rows.map(r=><div key={r.id}><i style={{background:r.color}}/><b>{r.name}</b><span>з {r.launch.slice(0,4)}</span><span>{r.res>=1000?`${r.res/1000} км`:`${r.res} м`}</span><span>{r.revisit<1?`кожні ${Math.round(r.revisit*24)} год`:`кожні ${r.revisit} дн`}</span><span>{r.orbits.toLocaleString('uk-UA')} витків</span><em>{r.farm}</em></div>)}</div>
 </section>;
}
