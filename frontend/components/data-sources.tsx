'use client';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import './data-sources.css';

type Source={id:string;group:string;name:string;agency:string;what:string;used_in:string[];resolution:string;cadence:string;url:string;status:'ok'|'degraded'|'down'|'static';latency_ms:number|null;http?:number;detail?:string;error?:string};
const GROUPS=['Супутники NASA','Клімат','Ґрунт і рельєф','Сільське господарство'];
const STATUS={ok:'працює',degraded:'з перебоями',down:'недоступне',static:'архів'} as const;

export default function DataSources(){
 const q=useQuery({queryKey:['sources-status'],queryFn:()=>api<{sources:Source[];checked_at:number}>('/sources/status'),staleTime:300000,refetchInterval:300000});
 const s=q.data?.sources||[];const ok=s.filter(x=>x.status==='ok').length;const live=s.filter(x=>x.status!=='static').length;
 const avg=Math.round(s.filter(x=>x.latency_ms).reduce((a,x)=>a+(x.latency_ms||0),0)/Math.max(1,s.filter(x=>x.latency_ms).length));
 return <section className="ds">
  <header className="ds-hero"><div><span className="eyebrow">DATA PROVENANCE · LIVE</span><h2>Звідки беруться кожне число й кожен шар</h2><p>Усі джерела відкриті. Платформа перевіряє їх наживо кожні 5 хвилин — нижче видно, що працює просто зараз і де це використовується.</p></div>
   <div className="ds-kpis"><div><b>{q.isPending?'…':`${ok}/${live}`}</b><small>джерел працюють</small></div><div><b>{q.isPending?'…':`${avg} мс`}</b><small>середня відповідь</small></div><div><b>{s.length||12}</b><small>відкритих наборів даних</small></div></div></header>
  {q.error&&<p className="planner-error">{(q.error as Error).message}</p>}
  {GROUPS.map(g=>{const items=s.filter(x=>x.group===g);if(!items.length)return null;return <div key={g} className="ds-group"><h3>{g}</h3><div className="ds-grid">{items.map(x=><article key={x.id} className={`ds-card ${x.status}`}>
   <header><span className={`ds-dot ${x.status}`}/><div><b>{x.name}</b><small>{x.agency}</small></div><em>{STATUS[x.status]}{x.latency_ms!=null?` · ${x.latency_ms} мс`:''}</em></header>
   <p>{x.what}</p>{x.detail&&<p className="ds-detail">{x.detail}</p>}
   <dl><div><dt>Роздільність</dt><dd>{x.resolution}</dd></div><div><dt>Оновлення</dt><dd>{x.cadence}</dd></div></dl>
   <div className="ds-used">{x.used_in.map(u=><span key={u}>{u}</span>)}</div>
   <a href={x.url} target="_blank" rel="noreferrer">Джерело ↗</a></article>)}</div></div>})}
  <div className="ds-note"><b>Супутник ≠ вимірювання в полі.</b> Супутник бачить середнє значення пікселя (від 10 м до 25 км), датчик у ґрунті — одну точку. Платформа поєднує обидва: супутник показує, де шукати проблему, датчик і огляд — підтверджують. Тому біля кожного числа вказано джерело й роздільність.</div>
 </section>;
}
