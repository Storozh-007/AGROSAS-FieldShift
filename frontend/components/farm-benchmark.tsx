'use client';
import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import Link from 'next/link';
import {api} from '@/lib/api';
import {CROP_VISUALS} from '@/lib/farm-design';
import {money} from '@/lib/planner';

type Row={id:string;name:string;area_ha:number;country?:string;computed:boolean;gm_current?:number;gm_best?:number;best_crops?:string[];best_cover?:boolean;erosion_current?:number;deficit_current?:number};

export default function FarmBenchmark({currentId}:{currentId?:string}){
 const client=useQueryClient();
 const q=useQuery({queryKey:['benchmark'],queryFn:()=>api<{fields:Row[];note:string}>('/farm/benchmark')});
 const[busy,setBusy]=useState('');const[error,setError]=useState('');
 const rows=q.data?.fields||[];const done=rows.filter(r=>r.computed);const max=Math.max(1,...done.map(r=>Math.abs(r.gm_best??r.gm_current??0)));
 async function computeMissing(){setError('');for(const r of rows.filter(x=>!x.computed)){setBusy(r.name);try{await api(`/fields/${r.id}/rotation-plan`,{})}catch(e){setError(`${r.name}: ${(e as Error).message}`)}await client.invalidateQueries({queryKey:['benchmark']})}setBusy('')}
 return <section className="benchmark">
  <header><div><span className="eyebrow">FARM VIEW</span><h3>Усі поля за маржею поточної сівозміни</h3><p>{q.data?.note}</p></div>{rows.some(r=>!r.computed)&&<button className="button" disabled={!!busy} onClick={computeMissing}>{busy?`Рахуємо: ${busy}…`:`Порахувати ще ${rows.filter(r=>!r.computed).length} полів`}</button>}</header>
  {error&&<p role="alert" className="planner-error">{error}</p>}
  <div className="bench-rows">{done.map(r=>{const cur=r.gm_current??0,best=r.gm_best??cur;return <Link key={r.id} href={`/farm-lab?field=${r.id}#zones`} className={r.id===currentId?'me':''}>
   <span className="name">{r.id===currentId?'Це поле':r.name}<small>{r.area_ha} га</small></span>
   <span className="bars"><i className={cur<0?'neg':''} style={{width:`${Math.abs(cur)/max*100}%`}}/>{best>cur&&<i className="up" style={{width:`${(best-cur)/max*100}%`}}/>}</span>
   <span className="val"><b className={cur<0?'bad':''}>{money(cur)}/га</b>{best>cur&&<small>до {money(best)} · {r.best_crops?.map(c=>CROP_VISUALS[c]?.name||c).join(' → ')}{r.best_cover?' + покривна':''}</small>}</span>
  </Link>})}</div>
  {!done.length&&!q.isPending&&<p className="planner-note">Ще немає порахованих полів.</p>}
 </section>;
}
