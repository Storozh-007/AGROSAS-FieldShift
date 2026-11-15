'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import './news-feed.css';

type Item={id:string;title:string;url:string;published_at:string|null;summary:string;image:string|null;source:string;topic:string|null;topic_label:string;relevance:number;relevance_label:string;farm_angle:string;action:{href:string;label:string};regions:string[];satellites:string[]};
const SAT_NAME:Record<string,string>={landsat8:'Landsat 8',landsat9:'Landsat 9',terra:'Terra',smap:'SMAP',gpm:'GPM',ecostress:'ECOSTRESS',gedi:'GEDI',viirs:'VIIRS',sentinel2:'Sentinel‑2',iss:'МКС'};
const REG:Record<string,string>={USA:'США',UA:'Україна',FR:'Франція',DE:'Німеччина'};
const FILTERS=[{id:'all',name:'Усі'},{id:'farm',name:'Для фермера'},{id:'water',name:'Вода й посуха'},{id:'weather',name:'Погода й клімат'},{id:'space',name:'Космос'}] as const;
const SEEN='agrosas-news-seen';
function ago(iso:string|null){if(!iso)return'';const h=(Date.now()-new Date(iso).getTime())/36e5;return h<1?`${Math.max(1,Math.round(h*60))} хв тому`:h<24?`${Math.round(h)} год тому`:`${Math.round(h/24)} дн тому`}

export default function NewsFeed(){
 const q=useQuery({queryKey:['farm-events'],queryFn:()=>api<{news:Item[];news_refreshed_at?:string}>('/events'),refetchInterval:300000,refetchOnWindowFocus:true,staleTime:60000});
 const[filter,setFilter]=useState<typeof FILTERS[number]['id']>('all');const[seen,setSeen]=useState<Set<string>>(new Set());
 useEffect(()=>{try{setSeen(new Set(JSON.parse(localStorage.getItem(SEEN)||'[]')))}catch{}},[]);
 const items=useMemo(()=>(q.data?.news||[]).filter(n=>filter==='all'||(filter==='farm'&&n.relevance>=2)||(filter==='water'&&['drought','water','flood','agriculture'].includes(n.topic||''))||(filter==='weather'&&['climate','weather','flood','fire'].includes(n.topic||''))||(filter==='space'&&!n.topic)),[q.data,filter]);
 const fresh=(q.data?.news||[]).filter(n=>!seen.has(n.id)).length;
 const markRead=()=>{const all=new Set([...seen,...(q.data?.news||[]).map(n=>n.id)]);setSeen(all);localStorage.setItem(SEEN,JSON.stringify([...all].slice(-300)))};
 return <section className="nf">
  <header className="nf-head"><div><span className="eyebrow">NASA EARTH · LIVE FEED</span><h3>Новини NASA — що це означає для поля</h3><p>Стрічка оновлюється автоматично кожні 5 хвилин з NASA Earth Observatory і NASA News. Кожну новину розібрано: тема, користь для фермера, чи стосується регіону ваших полів і які супутники знімали.</p></div>
   <div className="nf-live"><i/>{q.isFetching?'оновлюємо…':`оновлено ${ago(q.data?.news_refreshed_at||null)||'щойно'}`}{fresh>0&&seen.size>0&&<button onClick={markRead}>{fresh} нових · позначити</button>}</div></header>
  <div className="nf-filters">{FILTERS.map(f=><button key={f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.name}</button>)}</div>
  {q.isPending&&<div className="planner-loading"><span/><p>Завантажуємо стрічку NASA…</p></div>}
  <div className="nf-grid">{items.map(n=><article key={n.id} className={`nf-card rel-${n.relevance}`}>
   <a className="nf-img" href={n.url} target="_blank" rel="noreferrer">{n.image?<img src={n.image} alt="" loading="lazy"/>:<div className="nf-noimg">NASA</div>}{!seen.has(n.id)&&seen.size>0&&<span className="nf-new">нове</span>}<span className={`nf-rel rel-${n.relevance}`}>{n.relevance_label}</span></a>
   <div className="nf-body"><small>{n.source} · {ago(n.published_at)} · <b>{n.topic_label}</b></small><h4><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a></h4>{n.summary&&<p className="nf-sum">{n.summary}</p>}
    <div className="nf-farm"><b>Для вашого поля</b><p>{n.farm_angle}</p></div>
    <div className="nf-tags">{n.regions.map(r=><span key={r} className="reg">📍 регіон ваших полів: {REG[r]||r}</span>)}{n.satellites.map(s=><Link key={s} href={`/missions?mission=${s}`} className="sat">🛰 {SAT_NAME[s]||s}</Link>)}</div>
    <div className="nf-actions"><Link href={n.action.href}>{n.action.label} →</Link><a href={n.url} target="_blank" rel="noreferrer">Читати в NASA ↗</a></div></div>
  </article>)}</div>
 </section>;
}
