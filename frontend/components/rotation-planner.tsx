'use client';
import {useEffect,useMemo,useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {ResponsiveContainer,ComposedChart,Bar,Line,XAxis,YAxis,Tooltip,CartesianGrid,ReferenceLine,Cell} from 'recharts';
import {api} from '@/lib/api';
import {CROP_VISUALS} from '@/lib/farm-design';
import type {Field} from '@/lib/types';
import {BENEFIT_LABEL,GAP_LABEL,GLOSSARY,GOALS,GROUP_LABEL,KIND_LABEL,LEVEL_UA,MONTHS,RISK_LABEL,SCENARIOS,money,reasons,signed,tradeoffs,type Plan,type Strategy} from '@/lib/planner';
import {ExceedanceCurve,ModelMath,MonthlyWater,RotationWheel,StrategyRadar,YearStrip} from './planner-viz';
import './planner.css';

const cropName=(c:string)=>CROP_VISUALS[c]?.name||c;
const ALL_CROPS=['wheat','spring_wheat','barley','maize','sorghum','sunflower','soybean','pea','rapeseed','clover','cotton','almond'];

function Term({k}:{k:keyof typeof GLOSSARY}){return <abbr className="planner-term" title={GLOSSARY[k]} tabIndex={0}>{k}</abbr>}

export default function RotationPlanner({field,refreshKey=0}:{field:Field;refreshKey?:number}){
 const[goal,setGoal]=useState<'stable'|'profit'|'water'|'soil'>('stable');
 const[scenario,setScenario]=useState<'now'|'trend2035'|'dry'>('now');
 const[irrigated,setIrrigated]=useState(field.irrigation);
 const[excluded,setExcluded]=useState<string[]>([]);
 const[prices,setPrices]=useState<Record<string,number>>({});
 const[allowCover,setAllowCover]=useState(true);
 const[manual,setManual]=useState<null|{water:number;soil:number;resilience:number;economy:number}>(null);
 const[selected,setSelected]=useState<string>('');
 const plan=useMutation({mutationFn:(over?:Partial<{goal:string;scenario:string}>)=>api<Plan>(`/fields/${field.id}/rotation-plan`,{goal,scenario,irrigated,excluded,prices,allow_cover:allowCover,...(manual?{weights:manual}:{}),...over}),onSuccess:p=>setSelected(s=>p.strategies.some(x=>x.id===s)?s:p.recommended)});
 useEffect(()=>{plan.mutate(undefined)},[field.id,refreshKey]);// eslint-disable-line react-hooks/exhaustive-deps
 const data=plan.data;const base=data?.strategies[0];const chosen=data?.strategies.find(s=>s.id===selected)||data?.strategies.find(s=>s.id===data.recommended);
 const pickGoal=(g:typeof goal)=>{setGoal(g);setManual(null);plan.mutate({goal:g})};
 const pickScenario=(sc:typeof scenario)=>{setScenario(sc);plan.mutate({scenario:sc})};

 return <section className="planner" id="planner">
  <header className="planner-head"><div><span className="eyebrow">NASA + ҐРУНТ + ВАША МЕТА</span><h2>Яку сівозміну обрати на наступні роки</h2>
   <p>Кожна культура проходить {data?.n_years||30} реальних кліматичних сезонів цього поля: добовий водний баланс FAO‑56, спека в цвітіння, морози, ерозія, вуглець, азот і маржа. Модель перебирає тисячі сівозмін і порівнює їх з вашою поточною.</p></div>
   {plan.isPending&&data&&<span className="planner-busy"><i/>Перераховуємо…</span>}</header>

  {plan.isPending&&!data&&<div className="planner-loading"><span/><p>Збираємо паспорт поля: ґрунт (SSURGO / SoilGrids), рельєф SRTM, 30 років клімату ERA5, вологість кореневої зони NASA POWER… Перший раз — до 30 секунд.</p></div>}
  {plan.error&&<p role="alert" className="planner-error">{(plan.error as Error).message}</p>}

  {data&&base&&<>
   <SitePassport plan={data}/>
   <section className="threats-block"><div className="block-title"><span className="step">1</span><div><h3>Що загрожує цьому полю</h3><p>Визначено автоматично з 30 років ERA5, ґрунту, рельєфу SRTM і моделі ваших культур. Нічого вводити не треба.</p></div></div>
    <div className="threat-grid">{data.threats.map(t=><article key={t.id} className={`threat ${t.level}`}><header><b>{t.title}</b><span>{LEVEL_UA[t.level]}</span></header><div className="threat-meter"><i style={{width:t.level==='high'?'100%':t.level==='medium'?'62%':'26%'}}/></div><p>{t.evidence}</p><small>{t.source}</small></article>)}</div>
   </section>
   <section className="goal-block"><div className="block-title"><span className="step">2</span><div><h3>Що для вас найважливіше</h3><p>Оберіть одне. Модель поєднає вашу мету з загрозами поля.</p></div></div>
    <div className="goal-grid">{GOALS.map(g=><button key={g.id} aria-pressed={goal===g.id&&!manual} onClick={()=>pickGoal(g.id)} disabled={plan.isPending}><span className="goal-icon">{g.icon}</span><b>{g.title}</b><small>{g.desc}</small></button>)}</div>
    <WeightsExplained plan={data}/>
   </section>
   <section className="scenario-block"><div className="block-title"><span className="step">3</span><div><h3>За якого клімату перевірити</h3><p>Сценарії побудовані з реальних трендів вашого поля, а не з вигаданих чисел.</p></div></div>
    <div className="scenario-grid">{SCENARIOS.map(sc=><button key={sc.id} aria-pressed={scenario===sc.id} onClick={()=>pickScenario(sc.id)} disabled={plan.isPending}><b>{sc.title}</b><small>{scenarioText(sc.id,data)}</small></button>)}</div>
    <details className="constraints"><summary>Обмеження господарства — полив, техніка, ринок, ціни</summary>
     <label className="toggle-row"><input type="checkbox" checked={irrigated} onChange={e=>setIrrigated(e.target.checked)}/>Є зрошення (вода й енергія доступні)</label>
     <label className="toggle-row"><input type="checkbox" checked={allowCover} onChange={e=>setAllowCover(e.target.checked)}/>Готовий сіяти покривні культури восени</label>
     <p className="planner-sub">Чого не можете сіяти (немає техніки, покупця, договору):</p>
     <div className="crop-chips">{ALL_CROPS.map(c=><button key={c} type="button" aria-pressed={excluded.includes(c)} onClick={()=>setExcluded(excluded.includes(c)?excluded.filter(x=>x!==c):[...excluded,c])}>{excluded.includes(c)?'✕ ':''}{cropName(c)}</button>)}</div>
     <p className="planner-sub">Ваші ціни реалізації, $/т (порожньо — типова світова):</p>
     <div className="price-grid">{ALL_CROPS.map(c=><label key={c}>{cropName(c)}<input type="number" min={0} placeholder={String(data.assumptions.crops[c]?.price||'')} value={prices[c]??''} onChange={e=>{const v=e.target.value;const next={...prices};if(v==='')delete next[c];else next[c]=Number(v);setPrices(next)}}/></label>)}</div>
     <details><summary>Ручні ваги для агронома</summary>{(['water','soil','resilience','economy'] as const).map(k=><label key={k} className="weight-row"><span>{GROUP_LABEL[k]}</span><input type="range" min={0} max={100} step={5} value={(manual||data.weights_pct)[k]} onChange={e=>setManual({...(manual||data.weights_pct),[k]:Number(e.target.value)})}/><b>{Math.round((manual||data.weights_pct)[k])}</b></label>)}</details>
     <button className="button button-primary" disabled={plan.isPending} onClick={()=>plan.mutate(undefined)}>Застосувати обмеження</button>
    </details>
   </section>

   <div className="block-title result-title"><span className="step">✓</span><div><h3>Варіанти сівозміни</h3><p>Ваша поточна = 50 балів за кожним критерієм. {data.searched.toLocaleString('uk-UA')} варіантів перевірено на {data.n_years} сезонах.</p></div></div>
   <div className="strategy-tabs" role="tablist">{data.strategies.map(s=><button key={s.id} role="tab" aria-selected={s.id===chosen?.id} className={s.id===data.recommended?'recommended':''} onClick={()=>setSelected(s.id)}>
    <span>{s.id} · {KIND_LABEL[s.kind]}</span><strong>{s.crops.map(cropName).join(' → ')}{s.cover_crop?' + покривна':''}</strong><em>{s.score.toFixed(0)} балів{s.id===data.recommended?' · рекомендовано':''}</em></button>)}</div>

   {chosen&&<StrategyDetail s={chosen} base={base} plan={data}/>}

   <div className="planner-grid">
    <section className="planner-card"><h3>Профіль стратегій</h3><p className="planner-sub">Чим ширша фігура — тим краща стратегія за цим напрямом. Пунктир — ваша поточна.</p><StrategyRadar plan={data}/></section>
    <section className="planner-card"><h3>Коли поточна сівозміна найвразливіша</h3><p className="planner-sub">Середній <Term k="Водний дефіцит"/> за місяцями — {data.current.map(cropName).join(' → ')}</p>
     <div className="month-bars">{data.vulnerable_months.map((v,i)=>{const max=Math.max(...data.vulnerable_months,1);return <div key={i} title={`${MONTHS[i]}: ${v} мм`}><span style={{height:`${Math.max(2,v/max*100)}%`,background:v/max>.66?'#ff6050':v/max>.33?'#ffb547':'#6aa84f'}}/><small>{MONTHS[i]}</small></div>})}</div>
     <p className="planner-note">{peakText(data.vulnerable_months)}</p>
     <ul className="bare-list">{data.bare_windows.map((w,i)=><li key={i} className={w.days>75?'warn':''}><b>{w.days} днів</b> голого поля між {cropName(w.after)} і {cropName(w.before)}{w.days>75?' — вікно для покривної культури':''}</li>)}</ul>
    </section>
   </div>

   <section className="planner-card"><h3>Порівняння за критеріями</h3><p className="planner-sub">Колір — краще (зелений) чи гірше (червоний) за поточну.</p>
    <div className="criteria-table"><div className="row head"><span/>{data.strategies.map(s=><b key={s.id}>{s.id}</b>)}</div>
     {CRIT_ROWS.map(([k,label,fmt])=><div className="row" key={k}><span>{label}</span>{data.strategies.map(s=><i key={s.id} title={fmt(s)} style={{background:heat(s.criteria[k])}}>{fmt(s)}</i>)}</div>)}</div>
   </section>

   <section className="planner-card"><h3>Чесно про дані</h3>
    <div className="evidence-list">{data.evidence.map(e=><div key={e.layer}><span className={`conf conf-${e.confidence}`}>{e.confidence==='high'?'висока':e.confidence==='medium'?'середня':'низька'} точність</span><b>{e.source}</b><small>{e.resolution}</small></div>)}</div>
    <ul className="gap-list">{data.gaps.map(g=><li key={g}>{GAP_LABEL[g]||g}</li>)}</ul>
    <p className="planner-note">Інструмент допомагає побачити закономірності й варіанти; рішення залишається за вами та вашим агрономом.</p>
    <details><summary>Словник термінів</summary><dl className="glossary">{Object.entries(GLOSSARY).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
   </section>
  </>}
 </section>;
}

function WeightsExplained({plan}:{plan:Plan}){
 const w=plan.weights_pct;const keys=(['water','soil','resilience','economy'] as const);const colors={water:'#5fd4ff',soil:'#b6ff47',resilience:'#ffb547',economy:'#d8b4fe'};
 const why:Record<string,string>={water:'посуха і спека',soil:'ерозія, органіка, зливи',resilience:'збиткові роки, морози',economy:'дохід'};
 return <div className="weights-explained"><div className="weights-bar">{keys.map(k=><i key={k} style={{width:`${w[k]}%`,background:colors[k]}} title={`${GROUP_LABEL[k]} ${Math.round(w[k])}%`}/>)}</div>
  <div className="weights-legend">{keys.map(k=><div key={k}><i style={{background:colors[k]}}/><b>{GROUP_LABEL[k]} {Math.round(w[k])}%</b><small>{plan.weights_source==='manual'?'ручне налаштування':`мета ${Math.round(plan.goal_weights[k])}% · загрози (${why[k]}) ${Math.round(plan.threat_weights[k])}%`}</small></div>)}</div></div>;
}
function scenarioText(id:string,plan:Plan){const c=plan.site.climate,t=c.trend_per_decade;if(id==='now')return `${c.n_years} років ERA5 без змін`;if(id==='trend2035')return `За трендом поля: ${(t.tmean_c??0)>=0?'+':''}${(t.tmean_c??0).toFixed(2)} °C і ${t.precip_mm>=0?'+':''}${t.precip_mm} мм опадів за 10 років`;return `Опади як у сухому році (P10: ${c.precip_p10_mm??'—'} мм проти ${c.precip_mean_mm} мм) +0.5 °C`}

const CRIT_ROWS:[string,string,(s:Strategy)=>string][]=[
 ['gm_mean','Маржа, $/га',s=>money(s.metrics.gm_mean)],['gm_p10','Поганий рік P10',s=>money(s.metrics.gm_p10)],['loss_prob','Роки зі збитком',s=>`${Math.round(s.metrics.loss_prob*100)}%`],
 ['deficit_mm','Водний дефіцит',s=>`${Math.round(s.metrics.deficit_mm)} мм`],['irrigation_mm','Полив',s=>`${Math.round(s.metrics.irrigation_mm)} мм`],['erosion_t','Ерозія',s=>`${s.metrics.erosion_t.toFixed(1)} т/га`],
 ['soc_change_t','Вуглець ґрунту',s=>signed(s.metrics.soc_change_t,2,' т C')],['n_fert_kg','Азот добрив',s=>`${Math.round(s.metrics.n_fert_kg)} кг`],['pest_break','Розрив хвороб',s=>`${Math.round(s.metrics.pest_break*100)}%`],['bare_days','Голий ґрунт',s=>`${Math.round(s.metrics.bare_days)} дн`]];
const heat=(v:number)=>{const t=Math.max(0,Math.min(1,v/100));const r=t<.5?208:Math.round(208-(t-.5)*2*120),g=t<.5?Math.round(83+t*2*90):Math.round(173+(t-.5)*2*20),b=t<.5?63:Math.round(63+(t-.5)*2*10);return `rgba(${r},${g},${b},.28)`};
function peakText(m:number[]){const i=m.indexOf(Math.max(...m));if(m[i]<5)return 'Суттєвого водного стресу поточних культур не видно.';const after=m[i+1]||0;return `Найвразливіший місяць — ${MONTHS[i].toLowerCase()}${after>m[i]*.5?` і ${MONTHS[(i+1)%12].toLowerCase()}`:''}: культура недоотримує ~${Math.round(m[i])} мм води. Саме тоді варто дивитися на вологість ґрунту та прогноз.`}

function SitePassport({plan}:{plan:Plan}){
 const {soil,terrain,climate,climate_years,soil_moisture}=plan.site;const t=climate.trend_per_decade;
 const arrow=(v:number,goodUp=true)=><em className={(v>0)===goodUp?'up good':'down bad'}>{v>0?'▲':'▼'} {Math.abs(v)}</em>;
 return <section className="passport">
  <div className="passport-cards">
   <article><span>ҐРУНТ · {soil.source.includes('SSURGO')?'SSURGO':'SoilGrids'}</span><h4>{soil.texture}</h4><dl><div><dt>Органіка</dt><dd>{soil.organic_matter_pct}%</dd></div><div><dt>pH</dt><dd>{soil.ph??'—'}</dd></div><div><dt>Доступна волога</dt><dd>{soil.awc_mm_per_m} мм/м</dd></div><div><dt>Глина / пісок</dt><dd>{soil.clay_pct}% / {soil.sand_pct}%</dd></div></dl><small>{soil.map_unit||soil.native_resolution}</small></article>
   {terrain&&<article><span>РЕЛЬЄФ · SRTM</span><h4>Схил {terrain.slope_mean_pct}%</h4><dl><div><dt>Перепад висот</dt><dd>{terrain.relief_m} м</dd></div><div><dt>Площа зі схилом &gt;5%</dt><dd>{Math.round(terrain.steep_share*100)}%</dd></div><div><dt>Фактор LS</dt><dd>{terrain.ls_mean}</dd></div><div><dt>Висота</dt><dd>{terrain.elevation_mean_m} м</dd></div></dl><small>{terrain.native_resolution}</small></article>}
   <article><span>КЛІМАТ · {climate.n_years} РОКІВ ERA5</span><h4>{climate.precip_mean_mm} мм/рік</h4><dl><div><dt>Баланс сезону (опади − <Term k="ET0"/>)</dt><dd>{climate.season_balance_mean_mm} мм {arrow(t.season_balance_mm)}</dd></div><div><dt>Днів ≥32 °C</dt><dd>{climate.heat_days_mean} {arrow(t.heat_days_32,false)}</dd></div><div><dt>Днів із заморозком</dt><dd>{climate.frost_days_mean}</dd></div><div><dt>Злив ≥25 мм/рік</dt><dd>{climate.heavy_rain_days_mean}</dd></div></dl><small>Стрілки — тренд за 10 років</small></article>
  </div>
  <div className="passport-charts">
   {climate_years&&<div className="planner-card"><h4>Водний баланс сезону по роках, мм</h4><p className="planner-sub">Опади мінус потреба атмосфери (<Term k="ET0"/>) за квітень–вересень. Червоні — найсухіші 20% років.</p>
    <ResponsiveContainer width="100%" height={180}><ComposedChart data={climate_years} margin={{top:5,right:5,left:-15,bottom:0}}><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="year" tick={{fill:'#8fb0bb',fontSize:10}} interval={4}/><YAxis tick={{fill:'#8fb0bb',fontSize:10}}/><Tooltip contentStyle={{background:'#0b202d',border:'1px solid #315464',fontSize:12}} formatter={(v)=>[`${v} мм`,'Баланс']}/><ReferenceLine y={0} stroke="#ffffff40"/>
     <Bar dataKey="season_balance_mm">{climate_years.map(y=><Cell key={y.year} fill={y.season_balance_mm<=climate.season_balance_p10_mm*0.95||y.season_balance_mm<quantile(climate_years.map(x=>x.season_balance_mm),.2)?'#d0533f':'#4f8fb0'}/>)}</Bar></ComposedChart></ResponsiveContainer></div>}
   {soil_moisture&&soil_moisture.series.length>0&&<div className="planner-card"><h4><Term k="Аномалія вологості"/> кореневої зони · NASA</h4><p className="planner-sub">Останні {soil_moisture.series.length} місяців. Нижче нуля — сухіше за норму цього місяця.</p>
    <ResponsiveContainer width="100%" height={180}><ComposedChart data={soil_moisture.series} margin={{top:5,right:5,left:-15,bottom:0}}><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="month" tick={{fill:'#8fb0bb',fontSize:10}} interval={11}/><YAxis tick={{fill:'#8fb0bb',fontSize:10}}/><Tooltip contentStyle={{background:'#0b202d',border:'1px solid #315464',fontSize:12}}/><ReferenceLine y={0} stroke="#ffffff40"/>
     <Bar dataKey="anomaly" name="Аномалія">{soil_moisture.series.map(x=><Cell key={x.month} fill={x.anomaly<0?'#d08a3f':'#3f9bd0'}/>)}</Bar></ComposedChart></ResponsiveContainer></div>}
  </div>
 </section>;
}
const quantile=(v:number[],q:number)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor(q*(s.length-1))]};

function StrategyDetail({s,base,plan}:{s:Strategy;base:Strategy;plan:Plan}){
 const m=s.metrics,isBase=s.id==='S1';
 const why=isBase?[]:reasons(s,base);const cost=isBase?[]:tradeoffs(s,base);
 const years=useMemo(()=>base.metrics.yearly_gm.map((v,i)=>({year:plan.years[0]+i,current:Math.round(v),strategy:Math.round(s.metrics.yearly_gm[i]??v)})),[s,base,plan.years]);
 const wins=s.win_rate_vs_current!=null?Math.round(s.win_rate_vs_current*base.metrics.yearly_gm.length):null;
 return <article className="strategy-detail">
  <div className="chain">{s.crops.map((c,i)=><span key={i} style={{borderColor:CROP_VISUALS[c]?.color}}><i style={{background:CROP_VISUALS[c]?.color}}/>{cropName(c)}<small>рік {i+1}</small></span>)}{s.cover_crop&&<span className="cover">+ покривна культура у вікнах голого ґрунту</span>}</div>
  <div className="kpis">
   <div><span>Маржа</span><b>{money(m.gm_mean)}<small>/га/рік</small></b>{!isBase&&<em className={m.gm_mean>=base.metrics.gm_mean?'good':'bad'}>{signed(m.gm_mean-base.metrics.gm_mean)} $</em>}<small><Term k="P10/P90"/>: {money(m.gm_p10)} … {money(m.gm_p90)}</small></div>
   <div><span>Водний дефіцит</span><b>{Math.round(m.deficit_mm)}<small> мм/сезон</small></b>{!isBase&&<em className={m.deficit_mm<=base.metrics.deficit_mm?'good':'bad'}>{signed(m.deficit_mm-base.metrics.deficit_mm)} мм</em>}<small>Потреба {Math.round(m.etc_mm)} мм{m.irrigation_mm>0?` · полив ${Math.round(m.irrigation_mm)} мм`:''}</small></div>
   <div><span>Ерозія <Term k="RUSLE"/></span><b>{m.erosion_t.toFixed(1)}<small> т/га/рік</small></b>{!isBase&&<em className={m.erosion_t<=base.metrics.erosion_t?'good':'bad'}>{signed(m.erosion_t-base.metrics.erosion_t,1)} т</em>}<small>{m.erosion_t>plan.assumptions.tolerable_soil_loss_t?`вище допустимих ${plan.assumptions.tolerable_soil_loss_t} т/га`:'в межах допустимого'}</small></div>
   <div><span>Вуглець <Term k="SOC"/></span><b>{signed(m.soc_change_t,2)}<small> т C/га/рік</small></b><small>Рештки {m.carbon_input_t.toFixed(1)} т C/га/рік · відносно поточної</small></div>
   <div><span>Азот добрив</span><b>{Math.round(m.n_fert_kg)}<small> кг N/га</small></b>{!isBase&&<em className={m.n_fert_kg<=base.metrics.n_fert_kg?'good':'bad'}>{signed(m.n_fert_kg-base.metrics.n_fert_kg)} кг</em>}<small>Бобових у сівозміні: {Math.round(m.legume_share*100)}%</small></div>
  </div>
  <div className="planner-grid">
   <div>
    {!isBase&&<><h4>Чому запропоновано</h4><ul className="why">{why.length?why.map(t=><li key={t}>{t}</li>):<li>Найближчий до ваших пріоритетів варіант серед допустимих.</li>}</ul></>}
    {wins!=null&&!isBase&&<p className="win">Краща за поточну у <b>{wins} з {base.metrics.yearly_gm.length}</b> кліматичних років за маржею.</p>}
    {cost.length>0&&<><h4>Чим доведеться поступитися</h4><ul className="cost">{cost.map(t=><li key={t}>{t}</li>)}</ul></>}
    <h4>Що це дає ґрунту</h4><ul className="benefits">{s.benefits.length?s.benefits.map(b=><li key={b}>{BENEFIT_LABEL[b]}</li>):<li>Без суттєвих переваг для ґрунту порівняно з поточною.</li>}</ul>
   </div>
   <div>
    <h4>Ризики для перевірки на місці</h4><ul className="risks">{s.risks.length?s.risks.map((r,i)=><li key={i}>{RISK_LABEL[r.type](r,cropName(r.crop))}</li>):<li>Модель не виявила частих кліматичних ризиків.</li>}</ul>
    <h4>Календар сівозміни</h4><RotationWheel s={s} plan={plan}/>
   </div>
  </div>
 <div className="planner-grid viz-row">
   <div><h4>Скільки ви заробите і як часто</h4><ExceedanceCurve s={s} base={base}/></div>
   <div><h4>Водний дефіцит за місяцями, мм</h4><MonthlyWater s={s} base={base}/><p className="chart-read">Сірий — поточна, блакитний — {s.id}. Нижчі стовпці — менше стресу в критичні місяці.</p></div>
  </div>
  <h4>30 кліматичних років: де ця сівозміна краща за поточну</h4><YearStrip s={s} base={base} plan={plan}/><p className="chart-read">Зелений — краще, червоний — гірше за маржею. ☀ — найсухіші 20% років. Наведіть на рік, щоб побачити деталі.</p>
  <details className="math-details"><summary>Математика моделі — з числами цього поля</summary><ModelMath plan={plan} s={s}/></details>
 </article>;
}
