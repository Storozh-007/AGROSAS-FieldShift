'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import type {Field} from '@/lib/types';
import {FACTOR_LABEL,money,type ZonesResult} from '@/lib/planner';
import FarmBenchmark from './farm-benchmark';
import './field-zones.css';
import {translateHtml,translateText} from '@/lib/i18n-runtime';

type Layer='zones'|'productivity'|'topography'|'elevation'|'flow'|'erosion'|'factors'|'ndvi'|'profit'|'samples';
const LAYERS:{id:Layer;name:string;desc:string;ramp:string[]}[]=[
 {id:'zones',name:'Зони',desc:'Кластери з усіх шарів: рельєф, волога, вегетація. Зона 1 — найслабша, 4 — найсильніша.',ramp:['#c4473a','#e8c14a','#b9d97a','#3f8f45']},
 {id:'productivity',name:'Потенціал',desc:'Індекс продуктивності: вегетація, накопичення вологи, втрати ґрунту.',ramp:['#c4473a','#efb53c','#e9e05a','#7cc35a','#2f7d3a']},
 {id:'topography',name:'Рельєф і схил',desc:'Крутизна схилу у 3D. Червоне — круті ділянки, де вода стікає й забирає ґрунт.',ramp:['#6fb34d','#e8d14a','#e58a3a','#c4473a']},
 {id:'flow',name:'Стік води',desc:'Куди збирається вода (D8): сині лінії — шляхи стоку, темніше — більше води.',ramp:['#e9f1d8','#9cc9de','#3b7fc4','#173f7a']},
 {id:'erosion',name:'Ерозія',desc:'Втрати ґрунту A = R·K·LS·C за поточної сівозміни, т/га/рік.',ramp:['#3f8f45','#b9d97a','#e8c14a','#c4473a']},
 {id:'factors',name:'Що обмежує',desc:'Головний обмежувальний фактор кожної ділянки.',ramp:['#c4473a','#3b7fc4','#e0a43a','#4f9d4a']},
 {id:'ndvi',name:'NDVI',desc:'Пікова вегетація сезону з Sentinel‑2 (10 м).',ramp:['#c4473a','#efb53c','#e9e05a','#7cc35a','#1f6a30']},
 {id:'profit',name:'Прибуток',desc:'Модельна маржа поточної сівозміни по зонах, $/га/рік.',ramp:['#c4473a','#e8c14a','#b9d97a','#3f8f45']},
 {id:'samples',name:'Проби ґрунту',desc:'Точки відбору по зонах і один маршрут для обходу.',ramp:['#c4473a','#e8c14a','#b9d97a','#3f8f45']},
];
const lerp=(ramp:string[],t:number)=>{t=Math.max(0,Math.min(1,isFinite(t)?t:0));const s=t*(ramp.length-1),i=Math.min(ramp.length-2,Math.floor(s));return new THREE.Color(ramp[i]).lerp(new THREE.Color(ramp[i+1]),s-i)};

export default function FieldZones({field}:{field:Field}){
 const q=useQuery({queryKey:['zones',field.id],queryFn:()=>api<ZonesResult>(`/fields/${field.id}/zones`),staleTime:600000,retry:1});
 const[layer,setLayer]=useState<Layer>('zones');
 const z=q.data;const layers=LAYERS.filter(l=>l.id!=='ndvi'||z?.has_ndvi).filter(l=>l.id!=='profit'||z?.zones.some(x=>x.gm_per_ha!=null));
 const meta=LAYERS.find(l=>l.id===layer)!;
 return <section className="zones-page">
  <header className="zones-head"><div><span className="eyebrow">FIELD ZONES · 3D</span><h2>Де поле сильне, а де втрачає</h2><p>20‑метрова сітка на реальному рельєфі SRTM. Зони поєднують схил, накопичення води, ерозію{z?.has_ndvi?` і NDVI Sentinel‑2 (${z.ndvi_scene?.slice(0,10)})`:''}. Модельна оцінка для розвідки й відбору проб — не дані комбайна.</p></div></header>
  {q.isPending&&<div className="planner-loading"><span/><p>Будуємо рельєф, ґрунт і пікову вегетацію для зон…</p></div>}
  {q.error&&<p role="alert" className="planner-error">{(q.error as Error).message}</p>}
  {z&&<>
   <nav className="zone-layers" aria-label="Шари карти">{layers.map(l=><button key={l.id} aria-pressed={layer===l.id} onClick={()=>setLayer(l.id)}>{l.name}</button>)}</nav>
   <div className="zones-stage"><ZoneScene data={z} layer={layer}/>
    <div className="zone-legend"><b>{meta.name}</b><span className="ramp" style={{background:`linear-gradient(90deg,${meta.ramp.join(',')})`}}/><p>{meta.desc}</p>{layer==='samples'&&<p><b>{z.samples.points.length} проб</b> · маршрут {(z.samples.route_m/1000).toFixed(2)} км</p>}</div>
   </div>
   <div className="zone-table">{z.zones.map(zone=>{const f=FACTOR_LABEL[zone.limiting_factor]||FACTOR_LABEL.none;return <article key={zone.zone}>
    <header><span style={{background:LAYERS[0].ramp[Math.min(3,Math.round((zone.zone-1)/Math.max(1,z.k-1)*3))]}}>{zone.zone}</span><div><b>Зона {zone.zone}</b><small>{zone.area_ha} га · {Math.round(zone.share*100)}% поля</small></div>{zone.gm_per_ha!=null&&<strong className={zone.gm_per_ha<0?'bad':''}>{money(zone.gm_per_ha)}/га</strong>}</header>
    <dl><div><dt>Відносний урожай</dt><dd>{Math.round(zone.relative_yield*100)}%</dd></div><div><dt>Схил</dt><dd>{zone.slope_pct}%</dd></div><div><dt>Ерозія</dt><dd>{zone.erosion_t} т/га</dd></div>{zone.ndvi!=null&&<div><dt>NDVI</dt><dd>{zone.ndvi}</dd></div>}</dl>
    <p className="factor" style={{borderColor:f.color}}><b>{f.name}</b>{f.advice}</p>
    <p className="rates">Норма висіву <b>{zone.seed_rate_pct>0?'+':''}{zone.seed_rate_pct}%</b> · азот <b>{zone.n_rate_pct>0?'+':''}{zone.n_rate_pct}%</b></p>
   </article>})}</div>
   <p className="planner-note">{z.method}. Норми — стартова гіпотеза пропорційно потенціалу зони; перевірте пробами ґрунту та смугами‑дослідами.</p>
   <FarmBenchmark currentId={field.id}/>
  </>}
 </section>;
}

function ZoneScene({data,layer}:{data:ZonesResult;layer:Layer}){
 const host=useRef<HTMLDivElement>(null);const labels=useRef<HTMLDivElement>(null);const tipRef=useRef<HTMLDivElement>(null);const[relief,setRelief]=useState('');const api3=useRef<{paint:(l:Layer)=>void}|null>(null);
 const g=data.grid;
 const cells=useMemo(()=>{const out:{i:number;j:number}[]=[];g.inside.forEach((r,i)=>r.forEach((v,j)=>{if(v)out.push({i,j})}));return out},[g]);
 useEffect(()=>{
  const el=host.current,lab=labels.current;if(!el||!lab)return;
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{return}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(el.clientWidth,el.clientHeight);el.append(renderer.domElement);
  const scene=new THREE.Scene();const size=Math.max(g.rows,g.cols)*g.cell_m;
  const camera=new THREE.PerspectiveCamera(35,el.clientWidth/el.clientHeight,1,size*20);camera.position.set(-size*.15,size*.55,size*.95);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.47;controls.target.set(0,0,0);
  scene.add(new THREE.HemisphereLight('#ffffff','#556',2.2));const sun=new THREE.DirectionalLight('#fff',1.4);sun.position.set(-size,size*1.5,size*.6);scene.add(sun);
  const elev=g.elevation.flat().filter((_,k)=>g.inside.flat()[k]);const emin=Math.min(...elev),emax=Math.max(...elev);
  const exag=Math.min(6,(size*.08)/Math.max(emax-emin,1));setRelief(`Висоти ${emin.toFixed(0)}–${emax.toFixed(0)} м · перепад ${(emax-emin).toFixed(1)} м · вертикаль ×${exag.toFixed(1)}`);
  const pos=(i:number,j:number,lift=0)=>new THREE.Vector3((j-g.cols/2+.5)*g.cell_m,(g.elevation[i][j]-emin)*exag+lift,(i-g.rows/2+.5)*g.cell_m);
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(g.cell_m*.9,g.cell_m*.12,g.cell_m*.9),new THREE.MeshLambertMaterial(),cells.length);
  const m4=new THREE.Matrix4();const tilt=new THREE.Quaternion();
  cells.forEach((c,k)=>{const p=pos(c.i,c.j);const gx=(g.elevation[c.i][Math.min(g.cols-1,c.j+1)]-g.elevation[c.i][Math.max(0,c.j-1)])/(2*g.cell_m)*exag,gz=(g.elevation[Math.min(g.rows-1,c.i+1)][c.j]-g.elevation[Math.max(0,c.i-1)][c.j])/(2*g.cell_m)*exag;
   tilt.setFromEuler(new THREE.Euler(Math.atan(gz),0,-Math.atan(gx)));m4.compose(p,tilt,new THREE.Vector3(1,1,1));mesh.setMatrixAt(k,m4)});
  scene.add(mesh);
  const overlay=new THREE.Group();scene.add(overlay);
  const tags:{p:THREE.Vector3;el:HTMLDivElement}[]=[];
  const clearTags=()=>{tags.splice(0).forEach(t=>t.el.remove());overlay.children.slice().forEach(o=>{overlay.remove(o);(o as THREE.Mesh).geometry?.dispose()})};
  const tag=(p:THREE.Vector3,text:string,cls='')=>{const d=document.createElement('div');d.className=`zone-tag ${cls}`;d.textContent=translateText(text);lab.append(d);tags.push({p,el:d})};
  const cellOf=(lon:number,lat:number)=>{const[l,b,r,t]=g.bounds;return {i:Math.min(g.rows-1,Math.max(0,Math.floor((t-lat)/(t-b)*g.rows))),j:Math.min(g.cols-1,Math.max(0,Math.floor((lon-l)/(r-l)*g.cols)))}};
  const range=(a:number[][])=>{const v=cells.map(c=>a[c.i][c.j]);const s=[...v].sort((x,y)=>x-y);return[s[Math.floor(s.length*.03)],s[Math.floor(s.length*.97)]]};
  const paint=(l:Layer)=>{
   clearTags();const meta=LAYERS.find(x=>x.id===l)!;const k=data.k;const col=new THREE.Color();
   const zoneColor=(zn:number)=>lerp(LAYERS[0].ramp,(zn-1)/Math.max(1,k-1));
   const gms=data.zones.map(z=>z.gm_per_ha??0);const gmin=Math.min(...gms),gmax=Math.max(...gms);
   const factorColor:Record<string,string>=Object.fromEntries(Object.entries(FACTOR_LABEL).map(([a,b])=>[a,b.color]));
   const [pmin,pmax]=range(g.productivity),[smin,smax]=range(g.slope_pct),[fmin,fmax]=g.flow?range(g.flow):[0,1],[nmin,nmax]=g.ndvi?range(g.ndvi):[0,1];
   cells.forEach((c,idx)=>{const zn=g.zone[c.i][c.j];
    if(l==='zones'||l==='samples')col.copy(zoneColor(zn));
    else if(l==='productivity')col.copy(lerp(meta.ramp,(g.productivity[c.i][c.j]-pmin)/(pmax-pmin||1)));
    else if(l==='topography')col.copy(lerp(meta.ramp,(g.slope_pct[c.i][c.j]-smin)/(smax-smin||1)));
    else if(l==='flow'&&g.flow)col.copy(lerp(meta.ramp,(g.flow[c.i][c.j]-fmin)/(fmax-fmin||1)));
    else if(l==='erosion')col.copy(lerp(meta.ramp,g.erosion[c.i][c.j]/(data.tolerable_loss_t*1.6)));
    else if(l==='factors')col.set(factorColor[g.factor[c.i][c.j]]||'#4f9d4a');
    else if(l==='ndvi'&&g.ndvi)col.copy(lerp(meta.ramp,(g.ndvi[c.i][c.j]-nmin)/(nmax-nmin||1)));
    else if(l==='profit'){const zz=data.zones.find(x=>x.zone===zn);col.copy(lerp(meta.ramp,((zz?.gm_per_ha??0)-gmin)/(gmax-gmin||1)))}
    else col.set('#7aa870');
    mesh.setColorAt(idx,col)});
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   data.zones.forEach(zone=>{const c=cellOf(zone.center[0],zone.center[1]);if(!g.inside[c.i]?.[c.j])return;const p=pos(c.i,c.j,g.cell_m*.6);
    const text=l==='profit'&&zone.gm_per_ha!=null?`Зона ${zone.zone} · ${money(zone.gm_per_ha)}/га`:l==='factors'?FACTOR_LABEL[zone.limiting_factor]?.name||'':l==='erosion'?`Зона ${zone.zone} · ${zone.erosion_t} т/га`:l==='topography'?`Схил ${zone.slope_pct}%`:l==='ndvi'&&zone.ndvi!=null?`Зона ${zone.zone} · NDVI ${zone.ndvi}`:l==='productivity'?`Зона ${zone.zone} · ${Math.round(zone.relative_yield*100)}%`:l==='samples'?'':`Зона ${zone.zone} · ${zone.area_ha} га`;
    if(text)tag(p,text)});
   if(l==='samples'&&data.samples.points.length){const pts=data.samples.points.map(s=>pos(s.row,s.col,g.cell_m*.35));
    overlay.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#24402a'})));
    const dot=new THREE.SphereGeometry(g.cell_m*.32,14,10);pts.forEach((p,n)=>{const s=new THREE.Mesh(dot,new THREE.MeshBasicMaterial({color:n===0?'#e8762b':'#1f4a2a'}));s.position.copy(p);overlay.add(s)});
    tag(pts[0].clone().add(new THREE.Vector3(0,g.cell_m*.8,0)),'Старт','start');tag(pts[pts.length-1].clone().add(new THREE.Vector3(0,g.cell_m*.8,0)),`Фініш · ${pts.length} проб`,'start')}
  };
  api3.current={paint};paint(layer);
  const ray=new THREE.Raycaster();const mouse=new THREE.Vector2();let hovered=-1;const prevColor=new THREE.Color();
  const aspectName=(i:number,j:number)=>{const e=(a:number,b:number)=>g.elevation[Math.min(g.rows-1,Math.max(0,a))][Math.min(g.cols-1,Math.max(0,b))];const dx=e(i,j+1)-e(i,j-1),dy=e(i-1,j)-e(i+1,j);if(Math.hypot(dx,dy)<.05)return'майже рівно';const a=(Math.atan2(-dx,-dy)*180/Math.PI+360)%360;return ['північ','північний схід','схід','південний схід','південь','південний захід','захід','північний захід'][Math.round(a/45)%8]};
  const onMove=(ev:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();mouse.set((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObject(mesh)[0];const tip=tipRef.current;
   if(hovered>=0&&mesh.instanceColor){mesh.setColorAt(hovered,prevColor);mesh.instanceColor.needsUpdate=true;hovered=-1}
   if(!hit||hit.instanceId==null||!tip){if(tip)tip.style.display='none';return}
   hovered=hit.instanceId;mesh.getColorAt(hovered,prevColor);mesh.setColorAt(hovered,new THREE.Color('#ffffff'));if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   const c=cells[hovered];const zn=g.zone[c.i][c.j];const zz=data.zones.find(z=>z.zone===zn);const f=FACTOR_LABEL[g.factor[c.i][c.j]]||FACTOR_LABEL.none;const flow=g.flow?Math.expm1(g.flow[c.i][c.j]):1;
   tip.innerHTML=translateHtml(`<b>Зона ${zn}</b><small>${f.name}</small><dl><div><dt>Висота</dt><dd>${g.elevation[c.i][c.j].toFixed(1)} м</dd></div><div><dt>Схил</dt><dd>${g.slope_pct[c.i][c.j].toFixed(1)}%</dd></div><div><dt>Схил дивиться на</dt><dd>${aspectName(c.i,c.j)}</dd></div><div><dt>Збирає воду з</dt><dd>${Math.round(flow*g.cell_m*g.cell_m/100)/100} га</dd></div><div><dt>Ерозія</dt><dd>${g.erosion[c.i][c.j].toFixed(1)} т/га/рік</dd></div>${g.ndvi?`<div><dt>NDVI</dt><dd>${g.ndvi[c.i][c.j].toFixed(2)}</dd></div>`:''}${zz?.gm_per_ha!=null?`<div><dt>Маржа зони</dt><dd>${money(zz.gm_per_ha)}/га</dd></div>`:''}</dl><p>${f.advice}</p>`);
   tip.style.display='block';tip.style.transform=`translate(${Math.min(ev.clientX-r.left+16,r.width-250)}px,${Math.max(8,ev.clientY-r.top-20)}px)`};
  renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerleave',()=>{if(tipRef.current)tipRef.current.style.display='none'});
  let frame=0;const v=new THREE.Vector3();
  const loop=()=>{frame=requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);const w=el.clientWidth,h=el.clientHeight;
   tags.forEach(t=>{v.copy(t.p).project(camera);t.el.style.transform=`translate(-50%,-100%) translate(${(v.x+1)/2*w}px,${(1-v.y)/2*h}px)`;t.el.style.display=v.z<1?'':'none'})};
  loop();
  const ro=new ResizeObserver(()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix()});ro.observe(el);
  return()=>{renderer.domElement.removeEventListener('pointermove',onMove);cancelAnimationFrame(frame);ro.disconnect();clearTags();controls.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();api3.current=null};
 },[data,cells]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{api3.current?.paint(layer)},[layer]);
 const width=g.cols*g.cell_m;const bar=width>900?500:width>400?200:100;
 return <div className="zone-scene"><div ref={host} className="zone-canvas"/><div ref={labels} className="zone-labels"/><div ref={tipRef} className="zone-tip"/><div className="zone-relief">Рельєф: SRTM 1″ (NED 10 м у США) · {relief} · наведіть на ділянку</div><div className="zone-scale"><span style={{width:`${bar/width*70}%`}}/><small>{bar} м · {data.field.area_ha} га</small></div></div>;
}
