'use client';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import type {Field} from '@/lib/types';
import './field-snapshot.css';

type Img={display_range?:[number,number];image?:string;coordinates?:number[][];value_mean?:number;value_p10?:number;value_p90?:number;valid_fraction?:number;date?:string;annotations?:{longitude:number;latitude:number;title:string;value:number}[];attribution?:string};
type Param={after?:Img;before?:Img;compare?:{delta_mean:number;decreased_pct:number;increased_pct:number;stable_pct:number;before_mean:number;after_mean:number};change?:{image:string;coordinates:number[][];drop_where:string|null;rise_where:string|null;drop_pct:number;rise_pct:number;range:number};error?:string};
type Snap={after:{date:string;cloud_pct:number};before:{date:string;cloud_pct:number}|null;params:Record<'RGB'|'NDVI'|'NDMI'|'NDRE',Param>};
const META={
 RGB:{title:'Фото поля',sub:'Sentinel‑2, природні кольори, 10 м',read:()=>'Як поле виглядає з космосу: ґрунт, рядки, вода, техніка.'},
 NDVI:{title:'Рослинність',sub:'NDVI · біомаса',read:(v:number)=>v<.2?'Голий ґрунт або стерня — культури зараз немає або сходи.':v<.4?'Рідкий покрив: сходи, стрес або кінець сезону.':v<.6?'Помірна біомаса — вегетація триває.':'Густа здорова біомаса.'},
 NDMI:{title:'Вода в листі',sub:'NDMI · вологість покриву',read:(v:number)=>v<-.2?'Сухо: голий ґрунт або рослини з дефіцитом води.':v<0?'Нижче норми — стежте за вологою ґрунту.':v<.2?'Помірна вологість покриву.':'Рослини добре забезпечені водою.'},
 NDRE:{title:'Хлорофіл і азот',sub:'NDRE · червоний край',read:(v:number)=>v<.15?'Мало хлорофілу: голе поле або дефіцит азоту.':v<.3?'Середній рівень — перевірте норму азоту по зонах.':'Високий хлорофіл — азоту достатньо.'},
} as const;
type K=keyof typeof META;

function Layered({rgb,overlay,opacity=1}:{rgb?:Img;overlay?:{image?:string;coordinates?:number[][]};opacity?:number}){
 if(!rgb?.image||!rgb.coordinates)return <div className="snap-empty">немає знімка</div>;
 const[[l,t],[r],,[,b]]=rgb.coordinates as [[number,number],[number,number],[number,number],[number,number]];
 const pos=overlay?.coordinates?(()=>{const[[ol,ot],[or_],,[,ob]]=overlay.coordinates as [[number,number],[number,number],[number,number],[number,number]];return{left:`${(ol-l)/(r-l)*100}%`,top:`${(t-ot)/(t-b)*100}%`,width:`${(or_-ol)/(r-l)*100}%`,height:`${(ot-ob)/(t-b)*100}%`}})():null;
 return <div className="snap-layer"><img src={rgb.image} alt="Sentinel-2"/>{overlay?.image&&pos&&<img className="ov" src={overlay.image} alt="" style={{...pos,opacity}}/>}</div>;
}

export default function FieldSnapshot({field}:{field:Field}){
 const q=useQuery({queryKey:['snapshot',field.id],queryFn:()=>api<Snap>(`/fields/${field.id}/monitoring/snapshot`),staleTime:1800000,retry:1});
 const[sel,setSel]=useState<K>('NDVI');const[swipe,setSwipe]=useState(50);
 const d=q.data;
 return <section className="snap">
  <header className="snap-head"><div><span className="eyebrow">FIELD STATE · SENTINEL‑2</span><h3>Стан поля з космосу</h3><p>{d?`Найсвіжіший ясний знімок ${d.after.date} (хмарність ${Math.round(d.after.cloud_pct)}%)${d.before?` порівняно з ${d.before.date}`:''}. Платформа сама обрала дати без хмар над полем.`:'Шукаємо найсвіжіший ясний знімок і дату для порівняння…'}</p></div></header>
  {q.isPending&&<div className="planner-loading"><span/><p>Читаємо пікселі Sentinel‑2 над полем: 4 параметри × 2 дати. Перший раз — до 30 секунд.</p></div>}
  {q.error&&<p className="planner-error">{(q.error as Error).message}</p>}
  {d&&<>
   <div className="snap-cards">{(Object.keys(META) as K[]).map(k=>{const p=d.params[k];const m=META[k];const v=p?.after?.value_mean;const dm=p?.compare?.delta_mean;return <button key={k} className={`snap-card ${sel===k?'active':''}`} onClick={()=>setSel(k)}>
    <Layered rgb={d.params.RGB?.after} overlay={k==='RGB'?undefined:p?.after} opacity={.92}/>
    <div className="snap-card-body"><small>{m.title}</small><span className="snap-sub">{m.sub}</span>
     {k!=='RGB'&&v!=null&&<div className="snap-val"><b>{v.toFixed(2)}</b>{dm!=null&&<em className={dm>.01?'up':dm<-.01?'down':''}>{dm>0?'▲':dm<0?'▼':'•'} {Math.abs(dm).toFixed(2)}</em>}</div>}
     <p>{k==='RGB'?m.read(0):v!=null?m.read(v):p?.error||'—'}</p>{k!=='RGB'&&p?.after?.display_range&&<span className="snap-range">колір: {p.after.display_range[0].toFixed(2)} … {p.after.display_range[1].toFixed(2)} у межах поля</span>}</div></button>})}</div>

   <div className="snap-compare">
    <div className="snap-swipe" style={{['--x' as string]:`${swipe}%`}}>
     <div className="sw-before"><Layered rgb={d.params.RGB?.before||d.params.RGB?.after} overlay={sel==='RGB'?undefined:d.params[sel]?.before}/></div>
     <div className="sw-after"><Layered rgb={d.params.RGB?.after} overlay={sel==='RGB'?undefined:d.params[sel]?.after}/></div>
     <i className="sw-line"/><span className="sw-tag l">{d.before?.date||'—'}</span><span className="sw-tag r">{d.after.date}</span>
     <input type="range" min={0} max={100} value={swipe} onChange={e=>setSwipe(Number(e.target.value))} aria-label="Порівняння до і після"/>
    </div>
    <div className="snap-change">
     <h4>Що змінилося · {META[sel].title}</h4>
     {sel==='RGB'?<p>Перетягніть шторку, щоб порівняти, як поле виглядало {d.before?.date} і {d.after.date}. Оберіть параметр зліва, щоб побачити числа.</p>:!d.before||!d.params[sel]?.change?<p>Для порівняння потрібна друга ясна дата — її поки немає.</p>:(()=>{const p=d.params[sel];const c=p.compare!;const ch=p.change!;return <>
      <Layered rgb={d.params.RGB?.after} overlay={ch}/>
      <div className="chg-legend"><span><i className="dn"/>впало</span><span><i className="st"/>без змін</span><span><i className="upi"/>зросло</span></div>
      <ul className="chg-list">
       <li><b>{c.before_mean.toFixed(2)} → {c.after_mean.toFixed(2)}</b> в середньому ({c.delta_mean>0?'+':''}{c.delta_mean.toFixed(3)})</li>
       {ch.drop_pct>0&&<li className="dn">Впало більш ніж на 0.1 на <b>{ch.drop_pct}%</b> площі{ch.drop_where?` — переважно ${ch.drop_where}`:''}</li>}
       {ch.rise_pct>0&&<li className="upi">Зросло на <b>{ch.rise_pct}%</b> площі{ch.rise_where?` — ${ch.rise_where}`:''}</li>}
       <li>Без суттєвих змін: <b>{c.stable_pct}%</b> поля</li>
      </ul>
      <p className="chg-advice">{ch.drop_pct>15?`Помітне погіршення на ${ch.drop_pct}% поля${ch.drop_where?` (${ch.drop_where})`:''}. Огляньте цю ділянку: збирання, стрес від посухи, шкідники або ущільнення.`:ch.rise_pct>15?'Поле активно відростає — сходи або відновлення після дощу.':'Поле стабільне між датами — зміни в межах шуму сенсора.'} Супутник показує де дивитися; що саме сталося — підтверджує огляд.</p>
     </>})()}
    </div>
   </div>
   <p className="wx-source">{d.params.RGB?.after?.attribution} · Earth Search STAC · маска хмар SCL · індекси на пікселях у межах поля.</p>
  </>}
 </section>;
}
