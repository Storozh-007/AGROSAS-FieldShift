'use client';
import {useMemo,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,CartesianGrid,ReferenceLine,RadarChart,PolarGrid,PolarAngleAxis,Radar,Legend,ComposedChart,Bar} from 'recharts';
import {CROP_VISUALS} from '@/lib/farm-design';
import {GROUP_LABEL,MONTHS,money,type Plan,type Strategy} from '@/lib/planner';

const cropName=(c:string)=>CROP_VISUALS[c]?.name||c;
const PALETTE=['#8aa3ad','#b6ff47','#5fd4ff','#ffb547','#ff6f91'];
const tip={contentStyle:{background:'#061420',border:'1px solid #2c4a5a',borderRadius:8,fontSize:12},labelStyle:{color:'#cfe3e9'}};

/** Circular calendar: one ring per rotation year, crop arcs from sowing to harvest, bare-soil gaps hatched. */
export function RotationWheel({s,plan}:{s:Strategy;plan:Plan}){
 const size=330,c=size/2,ring=Math.min(22,90/s.crops.length),r0=62;const[hover,setHover]=useState<string>('');
 const arc=(r:number,a0:number,a1:number)=>{const p=(a:number)=>[c+r*Math.sin(a/365*2*Math.PI),c-r*Math.cos(a/365*2*Math.PI)];const span=((a1-a0)%365+365)%365||365;const[x0,y0]=p(a0),[x1,y1]=p(a0+span);return `M${x0} ${y0} A${r} ${r} 0 ${span>182?1:0} 1 ${x1} ${y1}`};
 const rings=s.crops.map((crop,i)=>{const cal=plan.calendar[crop];const prev=plan.calendar[s.crops[(i-1+s.crops.length)%s.crops.length]];const prevEnd=(prev.sow+prev.days)%365;return{crop,i,sow:cal.sow,end:(cal.sow+cal.days)%365,gapStart:prevEnd,winter:cal.winter}});
 return <div className="wheel"><svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Календар сівозміни">
  <defs><pattern id="bare" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#3a1d1a"/><line x1="0" y1="0" x2="0" y2="6" stroke="#c4473a" strokeWidth="2"/></pattern></defs>
  {MONTHS.map((m,k)=>{const a=k/12*2*Math.PI;return <g key={m}><line x1={c+(r0-8)*Math.sin(a)} y1={c-(r0-8)*Math.cos(a)} x2={c+(r0+ring*s.crops.length+6)*Math.sin(a)} y2={c-(r0+ring*s.crops.length+6)*Math.cos(a)} stroke="#ffffff14"/><text x={c+(r0+ring*s.crops.length+18)*Math.sin(a+Math.PI/12)} y={c-(r0+ring*s.crops.length+18)*Math.cos(a+Math.PI/12)+3} textAnchor="middle" fontSize="9" fill="#7fa3b0">{m}</text></g>})}
  {rings.map(g=>{const r=r0+ring*(g.i+.5);const gapDays=((g.sow-g.gapStart)%365+365)%365;return <g key={g.i} onMouseEnter={()=>setHover(`Рік ${g.i+1}: ${cropName(g.crop)} · сівба ${dayLabel(g.sow)} → збирання ${dayLabel(g.end)}${gapDays>0?` · перед нею поле голе ${gapDays} дн`:''}`)} onMouseLeave={()=>setHover('')}>
   <circle cx={c} cy={c} r={r} fill="none" stroke="#0f2633" strokeWidth={ring-3}/>
   {gapDays>2&&<path d={arc(r,g.gapStart,g.sow)} fill="none" stroke={s.cover_crop&&gapDays>75?'#5f9d4a':'url(#bare)'} strokeWidth={ring-5} strokeDasharray={s.cover_crop&&gapDays>75?'4 3':undefined} opacity=".9"/>}
   <path d={arc(r,g.sow,g.end)} fill="none" stroke={CROP_VISUALS[g.crop]?.color||'#9c9'} strokeWidth={ring-4} strokeLinecap="round"/>
  </g>})}
  <text x={c} y={c-6} textAnchor="middle" fontSize="22" fill="#eef8f1" fontWeight="600">{s.crops.length}</text><text x={c} y={c+12} textAnchor="middle" fontSize="9" fill="#86a8b4">{s.crops.length===1?'рік':'роки циклу'}</text>
 </svg>
 <div className="wheel-legend">{[...new Set(s.crops)].map(cr=><span key={cr}><i style={{background:CROP_VISUALS[cr]?.color}}/>{cropName(cr)}</span>)}<span><i className="bare"/>Голий ґрунт</span>{s.cover_crop&&<span><i className="cover"/>Покривна</span>}</div>
 <p className="wheel-hover">{hover||'Наведіть на кільце: зовнішнє — останній рік циклу. Червоні штрихи — поле без покриву.'}</p></div>;
}
const dayLabel=(doy:number)=>{const d=new Date(Date.UTC(2001,0,1)+doy*864e5);return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].toLowerCase()}`};

/** Exceedance curve: in what share of years the margin is at least X. */
export function ExceedanceCurve({s,base}:{s:Strategy;base:Strategy}){
 const data=useMemo(()=>{const a=[...base.metrics.yearly_gm].sort((x,y)=>y-x),b=[...s.metrics.yearly_gm].sort((x,y)=>y-x);return a.map((v,i)=>({p:Math.round((i+1)/a.length*100),current:Math.round(v),strategy:Math.round(b[i]??v)}))},[s,base]);
 const at=(k:'current'|'strategy',p:number)=>data.find(d=>d.p>=p)?.[k]??0;
 return <div><ResponsiveContainer width="100%" height={220}><LineChart data={data} margin={{top:8,right:10,left:0,bottom:4}}><CartesianGrid stroke="#ffffff10"/><XAxis dataKey="p" tick={{fill:'#86a8b4',fontSize:10}} unit="%" label={{value:'частка років, коли маржа не нижча',position:'insideBottom',offset:-2,fill:'#6f95a3',fontSize:10}}/><YAxis tick={{fill:'#86a8b4',fontSize:10}} tickFormatter={v=>`$${v}`}/><Tooltip {...tip} formatter={(v,n)=>[`$${v}/га`,n==='current'?'Поточна':s.id]} labelFormatter={l=>`У ${l}% років маржа щонайменше`}/><ReferenceLine y={0} stroke="#c4473a88"/>
  <Line dataKey="current" stroke="#8aa3ad" strokeWidth={2} dot={false} strokeDasharray="5 4"/><Line dataKey="strategy" stroke="#b6ff47" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer>
  <p className="chart-read">У <b>8 з 10</b> років {s.id==='S1'?'ця сівозміна':s.id} дає щонайменше <b>{money(at('strategy',80))}/га</b> (поточна — {money(at('current',80))}). У найгірший рік із десяти — <b>{money(at('strategy',90))}</b>.</p></div>;
}

export function StrategyRadar({plan}:{plan:Plan}){
 const data=(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map(g=>({g:GROUP_LABEL[g],...Object.fromEntries(plan.strategies.map(s=>[s.id,Math.round(s.groups[g])]))}));
 return <ResponsiveContainer width="100%" height={300}><RadarChart data={data} outerRadius="72%"><PolarGrid stroke="#ffffff1c"/><PolarAngleAxis dataKey="g" tick={{fill:'#cfe3e9',fontSize:12}}/>{plan.strategies.map((s,i)=><Radar key={s.id} dataKey={s.id} name={`${s.id}${s.id===plan.recommended?' ★':''}`} stroke={PALETTE[i]} fill={PALETTE[i]} fillOpacity={s.id===plan.recommended?.25:.04} strokeWidth={s.id===plan.recommended?2.5:1.2} strokeDasharray={s.id==='S1'?'4 3':undefined}/>)}<Legend wrapperStyle={{fontSize:11,color:'#9dbcc6'}}/><Tooltip {...tip}/></RadarChart></ResponsiveContainer>;
}

/** 30 climate years as tiles: green where the strategy beats current, red where it loses. */
export function YearStrip({s,base,plan}:{s:Strategy;base:Strategy;plan:Plan}){
 const years=plan.site.climate_years||[];const diffs=base.metrics.yearly_gm.map((v,i)=>(s.metrics.yearly_gm[i]??v)-v);const max=Math.max(1,...diffs.map(Math.abs));
 const dryCut=years.length?[...years].map(y=>y.season_balance_mm).sort((a,b)=>a-b)[Math.floor(years.length*.2)]:-Infinity;
 return <div className="year-strip">{diffs.map((d,i)=>{const y=plan.years[0]+i;const yr=years.find(x=>x.year===y);const t=d/max;return <div key={y} title={`${y}: ${d>=0?'+':''}${money(d)}/га vs поточна${yr?` · баланс ${yr.season_balance_mm} мм · спекотних днів ${yr.heat_days_32}`:''}`} style={{background:t>=0?`rgba(182,255,71,${.15+t*.75})`:`rgba(255,96,80,${.15-t*.75})`}}><b>{String(y).slice(2)}</b>{yr&&yr.season_balance_mm<=dryCut&&<i title="Посушливий рік">☀</i>}</div>})}</div>;
}

export function MonthlyWater({s,base}:{s:Strategy;base:Strategy}){
 const data=MONTHS.map((m,i)=>({m,current:base.monthly_deficit[i],strategy:s.monthly_deficit[i]}));
 return <ResponsiveContainer width="100%" height={200}><ComposedChart data={data} margin={{top:6,right:6,left:-12,bottom:0}}><CartesianGrid stroke="#ffffff10" vertical={false}/><XAxis dataKey="m" tick={{fill:'#86a8b4',fontSize:10}}/><YAxis tick={{fill:'#86a8b4',fontSize:10}} unit=" мм"/><Tooltip {...tip} formatter={(v,n)=>[`${v} мм`,n==='current'?'Поточна':s.id]}/><Bar dataKey="current" fill="#5b7380" radius={[3,3,0,0]}/><Bar dataKey="strategy" fill="#5fd4ff" radius={[3,3,0,0]}/></ComposedChart></ResponsiveContainer>;
}

/** The model's equations with this field's own numbers substituted. */
export function ModelMath({plan,s}:{plan:Plan;s:Strategy}){
 const sp=plan.site_params;const crop=s.crops[0];const cp=plan.crop_params[crop] as Record<string,number>;const cal=plan.calendar[crop];const m=s.metrics;
 const S=25400/sp.cn-254;const taw=sp.awc_mm_m*Number(cp.root);
 return <div className="model-math">
  <section><h5>1 · Скільки води просить культура</h5><code>ETc = Kc × ET0</code><p>{cropName(crop)}: Kc = {cal.kc[0]} → <b>{cal.kc[1]}</b> → {cal.kc[2]} за стадіями {cal.stages.join(' / ')} днів (FAO‑56, табл. 12). ET0 — щоденно з ERA5 для цього поля.</p></section>
  <section><h5>2 · Скільки води тримає ґрунт</h5><code>TAW = AWC × Zr = {sp.awc_mm_m} мм/м × {cp.root} м = {taw.toFixed(0)} мм</code><p>Стрес починається, коли виснаження Dr &gt; p·TAW = {(Number(cp.p)*taw).toFixed(0)} мм. Тоді Ks = (TAW − Dr) / ((1 − p)·TAW), а фактичне ETa = Ks·ETc.</p></section>
  <section><h5>3 · Скільки дощу реально вбирається</h5><code>Q = (P − 0.2S)² / (P + 0.8S),  S = 25400/CN − 254 = {S.toFixed(0)} мм</code><p>Гідрогрупа ґрунту {sp.hsg} → CN = {sp.cn}. Злива 40 мм дає стік {Math.max(0,(40-.2*S)**2/(40+.8*S)).toFixed(1)} мм — ця вода не дістається коріння.</p></section>
  <section><h5>4 · Урожай під стресом</h5><code>Y/Ymax = 1 − Ky·(1 − ΣETa/ΣETc) × f(спека) × f(мороз) × f(тепло)</code><p>Ky = {cp.ky} (FAO‑33). Спека: −3% за кожен день ≥{cp.heat} °C у ±10 днів від цвітіння. Тепло: (ГДД/{cp.gdd})² при Tbase = {cp.tbase} °C.</p></section>
  <section><h5>5 · Ерозія</h5><code>A = R × K × LS × C = {sp.erosivity.toFixed(0)} × {sp.k_factor.toFixed(4)} × {sp.ls.toFixed(2)} × {m.c_factor.toFixed(2)} = <b>{m.erosion_t.toFixed(1)} т/га/рік</b></code><p>R — з 30 років опадів (Renard & Freimund), K — ґрунт, LS — рельєф SRTM, C — покриття культурами цієї сівозміни.</p></section>
  <section><h5>6 · Вуглець ґрунту</h5><code>ΔSOC = h·(I − I₀) − ΔA·SOC%,  h = 0.125</code><p>Рештки I = {m.carbon_input_t.toFixed(2)} т C/га/рік. Запас у 0–30 см ≈ {sp.soc_stock_t} т C/га. Результат: <b>{m.soc_change_t>=0?'+':''}{m.soc_change_t.toFixed(2)} т C/га/рік</b> відносно поточної практики (ICBM).</p></section>
  <section><h5>7 · Гроші</h5><code>GM = Y·ціна − витрати − N·$1.1 − полив·$0.25/мм</code><p>N = max(0, потреба − кредит бобових − мінералізація 15 кг/% органіки). Середнє за {plan.n_years} років = <b>{money(m.gm_mean)}/га</b>, розкид P10–P90: {money(m.gm_p10)} … {money(m.gm_p90)}.</p></section>
 </div>;
}
