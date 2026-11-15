'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import * as satellite from 'satellite.js';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {MISSIONS,MISSION_MEDIA,missionProjectHref,type MissionDefinition} from '@/lib/mission-catalog';
import {disposeTree} from '@/lib/farm-scene-models';
import Brand from './brand';
import FieldPicker from './field-picker';
import MissionStats from './mission-stats';
import type {Field} from '@/lib/types';
import styles from './mission-observatory.module.css';

type GP={norad_id:number;line1?:string;line2?:string;epoch?:string;age_hours?:number;unavailable?:boolean;source_url?:string};
type View='model'|'orbit'|'video';
const usableOrbit=(record?:GP)=>!!record?.line1&&!!record.line2&&typeof record.age_hours==='number'&&record.age_hours<=336&&!record.unavailable;
const SWATH:Record<string,{km:number;label:string;daylight:boolean}>={smap:{km:1000,label:'Радіометр SMAP · смуга огляду 1000 км',daylight:false},gpm:{km:885,label:'GMI · смуга 885 км (радар DPR — 245 км)',daylight:false},landsat8:{km:185,label:'OLI/TIRS · смуга 185 км',daylight:true},landsat9:{km:185,label:'OLI‑2/TIRS‑2 · смуга 185 км',daylight:true},terra:{km:2330,label:'MODIS · смуга огляду 2330 км',daylight:true},viirs:{km:3040,label:'VIIRS · смуга огляду 3040 км',daylight:true},ecostress:{km:384,label:'ECOSTRESS · смуга ≈384 км',daylight:false},gedi:{km:4.2,label:'GEDI · лазерні треки ≈4,2 км',daylight:false}};
const R_EARTH=6371;
let earthCanvas:Promise<HTMLCanvasElement>|null=null;
function loadEarthCanvas(){if(earthCanvas)return earthCanvas;earthCanvas=new Promise((resolve,reject)=>{const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('2d'));return}let left=32;for(let x=0;x<8;x++)for(let y=0;y<4;y++){const img=new Image();img.onload=()=>{ctx.drawImage(img,x*256,(3-y)*256);if(--left===0)resolve(canvas)};img.onerror=()=>{earthCanvas=null;reject(new Error('tile'))};img.src=`/cesium/Assets/Textures/NaturalEarthII/2/${x}/${y}.jpg`}});return earthCanvas}
function fieldCenter(field?:Field){const ring=field?.geometry?.coordinates?.[0];if(!ring?.length)return null;const pts=ring.slice(0,-1).length?ring.slice(0,-1):ring;return {lon:pts.reduce((a,p)=>a+p[0],0)/pts.length,lat:pts.reduce((a,p)=>a+p[1],0)/pts.length,name:field!.name}}
function subsolar(date:Date){const start=Date.UTC(date.getUTCFullYear(),0,0),doy=(date.getTime()-start)/864e5;const decl=23.44*Math.sin(2*Math.PI*(284+doy)/365)*Math.PI/180;const hours=date.getUTCHours()+date.getUTCMinutes()/60;return {lat:decl,lon:(12-hours)*15*Math.PI/180}}

export default function MissionObservatory(){
 const searchParams=useSearchParams();
 const[id,setId]=useState('smap');const[fieldId,setFieldId]=useState('');const[tab,setTab]=useState<View>('model');
 const[clock,setClock]=useState('');const[step,setStep]=useState(0);const[playing,setPlaying]=useState(false);
 const fields=useQuery({queryKey:['fields'],queryFn:()=>api<Field[]>('/fields')});
 const gp=useQuery({queryKey:['live-orbits'],queryFn:()=>api<{records:GP[]}>('/orbits'),staleTime:3600000,retry:1,enabled:tab!=='model'});
 const mission=MISSIONS.find(m=>m.id===id)||MISSIONS[0];const media=MISSION_MEDIA[mission.id];
 const record=gp.data?.records.find(x=>x.norad_id===mission.noradId);
 const field=fields.data?.find(x=>x.id===fieldId)||fields.data?.[0];const href=missionProjectHref(mission,field?.id||fieldId||undefined);
 useEffect(()=>{const m=searchParams.get('mission');if(m&&MISSIONS.some(x=>x.id===m))setId(m);const f=searchParams.get('field');if(f)setFieldId(f)},[searchParams.toString()]);
 useEffect(()=>{setClock(new Date().toISOString());const timer=setInterval(()=>setClock(new Date().toISOString()),1000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{setStep(0);setPlaying(false);setTab('model')},[id]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setStep(s=>(s+1)%mission.workflow.length),3500);return()=>clearInterval(timer)},[playing,mission.id]);
 const selectMission=(value:string)=>{setId(value);history.replaceState(null,'',`/missions?mission=${value}${fieldId?`&field=${fieldId}`:''}`)};
 return <main className={`mission-observatory ${styles.page}`}>
  <header className="mission-header"><Link href="/dashboard"><Brand/></Link><div><span className="eyebrow">MISSION OBSERVATORY</span><h1>З орбіти — до рішення фермера</h1></div><nav><Link href="/dashboard">Глобус</Link><Link href="/network">Господарства та події</Link></nav></header>
  <div className="mission-shell"><aside className="mission-list" aria-label="Місії та прилади">{MISSIONS.map((m,i)=><button key={m.id} className={m.id===mission.id?'active':''} aria-pressed={m.id===mission.id} onClick={()=>selectMission(m.id)}><span className={styles.navNumber}>{String(i+1).padStart(2,'0')}</span><span><strong>{m.name}</strong><small>{m.kind==='instrument'?'Прилад на платформі':m.kind==='historical'?'Історична місія':m.agency}</small></span></button>)}</aside>
   <article className="mission-detail">
    <div className={styles.title}><div><span className="eyebrow">{mission.agency} / {mission.kind==='instrument'?'ІНСТРУМЕНТ':'МІСІЯ'}</span><h2>{mission.name}</h2><p>{mission.statusNote}</p></div><span className={styles.badge}>{mission.modelPath?mission.kind==='instrument'?'3D-модель носія':'Офіційна 3D-модель':'Зображення агенції'}</span></div>
    <div className={styles.hero}>
     <section className={styles.visual} aria-label="Візуалізація місії">
      <div className={styles.tabs}><button aria-pressed={tab==='model'} onClick={()=>setTab('model')}>{mission.modelPath?mission.kind==='instrument'?'Носій у 3D':'Апарат у 3D':'Зображення апарата'}</button><button aria-pressed={tab==='orbit'} disabled={!mission.noradId} onClick={()=>setTab('orbit')}>Орбіта UTC</button><button aria-pressed={tab==='video'} onClick={()=>setTab('video')}>▶ Відео / приклад</button></div>
      {tab==='video'&&(media?.videoSrc||mission.video.mp4)?<MissionVideo mission={mission} inline/>:tab==='orbit'||(tab==='video'&&mission.noradId)?<MissionScene key={`${mission.id}:orbit`} mission={mission} mode="orbit" record={record} field={field}/>:tab==='video'?<MissionPhoto mission={mission}/>:mission.modelPath?<MissionScene key={`${mission.id}:model`} mission={mission} mode="model"/>:<MissionPhoto mission={mission}/>}
     </section>
     <aside className={styles.lesson}><strong>НАВІЩО ЦЕ ФЕРМЕРУ</strong><h3>{media?.decision}</h3><p>{mission.integrationNote}</p><p>Спочатку перевірте дату, покриття та масштаб даних. Потім зіставте спостереження з датчиком і оглядом поля.</p><button className="button" onClick={()=>{setTab('video');document.querySelector('[aria-label="Візуалізація місії"]')?.scrollIntoView({behavior:'smooth',block:'center'})}}>▶ Подивитися приклад роботи</button><Link className="button button-primary" href={href}>{mission.layerKey?'Відкрити цей шар на 3D-полі':'Перевірити доступ до даних у проєкті'} ↗</Link></aside>
    </div>
    <p className={styles.provenance}>{tab==='orbit'?usableOrbit(record)?`SGP4 · епоха ${record?.epoch} · вік елементів ${record?.age_hours} год. Пунктир — наземний трек ±45 хв, точка — розраховане положення.`:gp.isFetching?'Отримуємо орбітальні елементи…':'Для цієї місії немає придатних свіжих орбітальних елементів. Апарат не малюється у випадковому місці.':mission.modelPath?`${mission.modelAttribution}. ${mission.modelNote||'Позиція моделі у студії не означає орієнтацію апарата на орбіті.'}`:`${media?.photo?.credit||''}. Офіційне зображення замість вигаданої 3D-конструкції.`} · UTC {clock.slice(0,19).replace('T',' ')}</p>
    <section className={styles.process}>
     <div className={styles.sectionHeading}><div><span className="eyebrow">HOW IT WORKS</span><h3>Від сигналу до перевірки поля</h3></div><button aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?'Ⅱ Зупинити показ':'▶ Показати кроки'}</button></div>
     <div className={styles.steps}>{mission.workflow.map((text,i)=><button key={text} aria-pressed={step===i} onClick={()=>{setStep(i);setPlaying(false)}}><b>0{i+1}</b><span>{text}</span></button>)}</div>
     <ProcessDiagram mission={mission} step={step}/><p className={styles.explanation}>{mission.workingPrinciple}</p><p className={styles.caption}>Схема пояснює рух інформації. Вона не імітує світловий промінь або підтверджену зйомку вашого поля.</p>
    </section>
    <MissionVideo mission={mission}/>
    <div className="mission-info-grid"><section><h3>Характеристики приладу</h3><dl>{mission.specs.map(s=><div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl></section><section><h3>Що варто перевірити</h3><p>Дата знімка, хмарність і вихідна роздільність визначають, що можна побачити. Поточна орбіта не підтверджує отримання даних.</p><p>{mission.kind==='instrument'?`${mission.name} — прилад; орбітальний трек належить платформі ${mission.platform}.`:mission.kind==='historical'?'Це історичний набір: нова дата перегляду не створює нового вимірювання.':'Порівнюйте продукти однієї місії з їхніми масками якості та метаданими.'}</p><p>Нижчий NDVI, регіональна вологість або температура поверхні самі по собі не встановлюють причину проблеми.</p></section></div>
    <section className="mission-integration"><span className="eyebrow">ЗАСТОСУВАТИ ДО СВОГО ПОЛЯ</span><h3>Оберіть поле й перевірте дані</h3><p>{mission.integrationNote}</p><FieldPicker fields={fields.data||[]} value={field?.id||''} onChange={setFieldId} label="Поле для демонстрації місії" compact/><Link className="button button-primary" href={href}>{mission.layerKey?'Перейти до даних обраного поля':'Джерела та доступність продукту'} ↗</Link></section>
    <MissionStats/>
    <section className="mission-sources"><h3>Першоджерела та матеріали</h3>{mission.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}{mission.modelSourceUrl&&<a href={mission.modelSourceUrl} target="_blank" rel="noreferrer">Джерело 3D-моделі ↗</a>}{media?.photo&&<a href={media.photo.source} target="_blank" rel="noreferrer">Зображення: {media.photo.credit} ↗</a>}</section>
   </article>
  </div>
 </main>
}

function MissionPhoto({mission}:{mission:MissionDefinition}){
 const media=MISSION_MEDIA[mission.id];const[failed,setFailed]=useState(false);
 return media?.photo&&!failed?<figure className={`${styles.photo} ${mission.id==='sentinel2'?styles.photoLight:''}`}><img src={media.photo.src} alt={media.photo.alt} onError={()=>setFailed(true)}/><figcaption>{media.photo.credit} · <a href={media.photo.source} target="_blank" rel="noreferrer">Джерело зображення ↗</a></figcaption></figure>:<div className={styles.fallback}><p>Зображення зараз недоступне.</p><a href={mission.sources[0].url} target="_blank" rel="noreferrer">Переглянути апарат на сайті агенції ↗</a></div>
}
function MissionVideo({mission,inline=false}:{mission:MissionDefinition;inline?:boolean}){
 const media=MISSION_MEDIA[mission.id];const src=media?.videoSrc||mission.video.mp4;const[failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[mission.id]);
 const content=src&&!failed?<video key={src} data-testid="mission-official-video" controls playsInline preload="metadata" poster={media?.photo?.src} onError={()=>setFailed(true)}><source src={src} type={media?.videoType||'video/mp4'}/>Ваш браузер не відтворює цей формат. Відкрийте матеріал агенції за посиланням нижче.</video>:failed?<p>Відео не вдалося завантажити. <a href={mission.video.url} target="_blank" rel="noreferrer">{mission.video.title} ↗</a></p>:null;
 if(inline)return <div className={styles.videoFrame}>{content}</div>;
 if(!content)return null;
 return <section className={styles.videoBlock}><div className={styles.sectionHeading}><div><span className="eyebrow">OFFICIAL MEDIA</span><h3>{src?'Відео: як працює місія':'Матеріали агенції'}</h3><p>{mission.video.title}</p></div><a href={mission.video.url} target="_blank" rel="noreferrer">Оригінал та повні титри ↗</a></div>{content}<p className={styles.caption}>Архівна навчальна анімація агенції, не прямий ефір. Для SMAP відео 2015 року показує початкову конфігурацію; сучасний статус радара наведено вище.</p></section>
}
function ProcessDiagram({mission,step}:{mission:MissionDefinition;step:number}){
 const first=mission.id==='smap'?'Природне випромінювання':mission.id==='gpm'?'Радар + радіометр':mission.id==='gedi'?'Лазерні повернення':mission.id==='srtm'?'Радарна інтерферометрія':mission.id==='iss'?'Орбітальна платформа':'Спектральне спостереження';
 return <svg className={styles.diagram} viewBox="0 0 850 135" role="img" aria-label={`Крок ${step+1}: ${mission.workflow[step]}`}><defs><marker id={`arrow-${mission.id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#5a8991"/></marker></defs>{[0,1,2].map(i=><g key={i}><rect x={15+i*285} y="20" width="250" height="94" rx="12" fill={step===i?'#163c32':'#102632'} stroke={step===i?'#b5ed80':'#294a56'}/><circle cx={43+i*285} cy="45" r="7" fill={step===i?'#b8ec89':'#4d747c'}/><text x={64+i*285} y="49" className={step===i?styles.activeText:''}>{i===0?first:i===1?'Продукт із датою та якістю':'Рішення + огляд на місці'}</text><text x={35+i*285} y="87">{i===0?mission.name.split(' / ')[0].slice(0,22):i===1?'Маска · піксель · покриття':'Датчик · поле · план робіт'}</text>{i<2&&<path d={`M${267+i*285} 67h26`} stroke="#5a8991" strokeWidth="2" markerEnd={`url(#arrow-${mission.id})`}/>}</g>)}</svg>
}

function MissionScene({mission,mode,record,field}:{mission:MissionDefinition;mode:'model'|'orbit';record?:GP;field?:Field}){
 const host=useRef<HTMLDivElement>(null);const latest=useRef(record);latest.current=record;
 const[speed,setSpeed]=useState(60);const speedRef=useRef(speed);speedRef.current=speed;const[passInfo,setPassInfo]=useState('');const target=fieldCenter(field);const swathInfo=SWATH[mission.id];
 const[status,setStatus]=useState('Завантажуємо модель…');const[failed,setFailed]=useState(false);const[orbitStats,setOrbitStats]=useState('');
 useEffect(()=>{
  if(!host.current)return;const el=host.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true})}catch{setFailed(true);return}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#030b18');
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(el.clientWidth,el.clientHeight);el.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,el.clientWidth/el.clientHeight,.1,800);camera.position.set(15,10,20);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=mode==='orbit'?7:5;controls.maxDistance=mode==='orbit'?35:60;
  const hemi=new THREE.HemisphereLight('#c7e6ff','#243335',2);scene.add(hemi);const light=new THREE.DirectionalLight('#fff2dc',3);light.position.set(20,25,10);scene.add(light);
  let active=true,model:THREE.Object3D|null=null,frame=0,last=0,lastTrack=0,lastText=0;const draco=new DRACOLoader();draco.setDecoderPath('/missions/draco/');
  const load=(value:THREE.Object3D)=>{
   if(!active){disposeTree(value);return}const bounds=new THREE.Box3().setFromObject(value),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());value.position.sub(center);
   const group=new THREE.Group();group.add(value);group.scale.setScalar((mode==='model'?11:.65)/Math.max(size.x,size.y,size.z));scene.add(group);model=group;
   setStatus(mode==='model'?'Офіційна 3D-модель · обертайте для огляду':'SGP4 · розраховане положення UTC');
  };
  if(mode==='model'){
   const error=()=>{if(active)setFailed(true)};
   if(mission.modelPath&&mission.modelFormat==='stl')new STLLoader().load(mission.modelPath,g=>load(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#cbd5d3',metalness:.35,roughness:.55}))),undefined,error);
   else if(mission.modelPath){const loader=new GLTFLoader();loader.setDRACOLoader(draco);loader.load(mission.modelPath,r=>load(r.scene),undefined,error)}else error();
  }
  const vector=(lat:number,lon:number,radius:number)=>new THREE.Vector3(Math.cos(lat)*Math.sin(lon)*radius,Math.sin(lat)*radius,Math.cos(lat)*Math.cos(lon)*radius);
  let track:THREE.Line|null=null,ground:THREE.Mesh|null=null,tether:THREE.Line|null=null,swath:THREE.Mesh|null=null,passDone=false,simBase=Date.now(),realBase=performance.now(),curSpeed=speedRef.current,lastTrackSim=0;
  if(mode==='orbit'){
   camera.position.set(10,7,13);controls.target.set(0,0,0);
   const earth=new THREE.Mesh(new THREE.SphereGeometry(5,128,80),new THREE.MeshPhongMaterial({color:'#2d5a6d',shininess:6,specular:'#223'}));earth.rotation.y=-Math.PI/2;scene.add(earth);
   loadEarthCanvas().then(canvas=>{if(!active)return;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();const m=earth.material as THREE.MeshPhongMaterial;m.map=texture;m.color.set('#ffffff');m.needsUpdate=true}).catch(()=>{});
   scene.add(new THREE.Mesh(new THREE.SphereGeometry(5.18,64,40),new THREE.MeshBasicMaterial({color:'#5fb4ff',transparent:true,opacity:.09,side:THREE.BackSide,depthWrite:false})));
   const starPositions=new Float32Array(4500);for(let i=0;i<4500;i+=3){const v=new THREE.Vector3().randomDirection().multiplyScalar(260+Math.random()*120);starPositions.set([v.x,v.y,v.z],i)}const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.BufferAttribute(starPositions,3));scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:'#cfe3ff',size:.9,sizeAttenuation:true,transparent:true,opacity:.7})));
   hemi.intensity=.35;
   const equator=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:180},(_,i)=>new THREE.Vector3(Math.cos(i/180*Math.PI*2)*5.02,0,Math.sin(i/180*Math.PI*2)*5.02))),new THREE.LineBasicMaterial({color:'#7ba4ac',transparent:true,opacity:.6}));scene.add(equator);
   model=new THREE.Group();model.add(new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),new THREE.MeshBasicMaterial({color:'#ddf9b0'})));scene.add(model);model.visible=false;
   ground=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),new THREE.MeshBasicMaterial({color:'#84cdeb'}));scene.add(ground);ground.visible=false;
   track=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#7fb2c1',dashSize:.1,gapSize:.08,transparent:true,opacity:.65}));scene.add(track);
   tether=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#a4db9a',transparent:true,opacity:.65}));scene.add(tether);
   swath=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:'#a8e27e',transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));scene.add(swath);
   if(target){const pin=new THREE.Group();pin.add(new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),new THREE.MeshBasicMaterial({color:'#ffd166'})));const ring=new THREE.Mesh(new THREE.RingGeometry(.12,.16,40),new THREE.MeshBasicMaterial({color:'#ffd166',transparent:true,opacity:.8,side:THREE.DoubleSide}));pin.add(ring);const p=vector(target.lat*Math.PI/180,target.lon*Math.PI/180,5.035);pin.position.copy(p);pin.lookAt(p.clone().multiplyScalar(2));scene.add(pin);camera.position.copy(vector(target.lat*Math.PI/180,target.lon*Math.PI/180,17));}
   setStatus('Очікуємо свіжі орбітальні елементи…');
  }
  const animate=()=>{
   frame=requestAnimationFrame(animate);const now=performance.now();if(now-last<33)return;last=now;
   if(mode==='orbit'&&model&&track&&ground&&tether){
    const r=latest.current;model.visible=ground.visible=track.visible=tether.visible=false;
    if(usableOrbit(r))try{
     if(curSpeed!==speedRef.current){simBase=simBase+(now-realBase)*curSpeed;realBase=now;curSpeed=speedRef.current}
     const sat=satellite.twoline2satrec(r!.line1!,r!.line2!),date=new Date(simBase+(now-realBase)*curSpeed),result=satellite.propagate(sat,date);
     const sun=subsolar(date);light.position.copy(vector(sun.lat,sun.lon,60));
     if(!passDone&&target){passDone=true;setTimeout(()=>{if(active)setPassInfo(nextPass(sat,target,swathInfo))},50)}
     if(result?.position){
      const point=satellite.eciToGeodetic(result.position,satellite.gstime(date)),radius=5*(6371+point.height)/6371;model.position.copy(vector(point.latitude,point.longitude,radius));ground.position.copy(vector(point.latitude,point.longitude,5.03));
      model.visible=ground.visible=track.visible=tether.visible=true;
      tether.geometry.dispose();tether.geometry=new THREE.BufferGeometry().setFromPoints([ground.position,model.position]);
      if(Math.abs(date.getTime()-lastTrackSim)>20000||lastTrack===0){const points:THREE.Vector3[]=[];for(let minutes=-45;minutes<=45;minutes+=.5){const t=new Date(date.getTime()+minutes*60000),state=satellite.propagate(sat,t);if(state?.position){const p=satellite.eciToGeodetic(state.position,satellite.gstime(t));points.push(vector(p.latitude,p.longitude,5.025))}}track.geometry.dispose();track.geometry=new THREE.BufferGeometry().setFromPoints(points);track.computeLineDistances();if(swath&&swathInfo){swath.geometry.dispose();swath.geometry=swathGeometry(points.map(p=>p.clone().normalize()),Math.max(swathInfo.km,40)/2/R_EARTH)}lastTrack=now;lastTrackSim=date.getTime()}
      if(now-lastText>1000){setOrbitStats(`${Math.abs(point.latitude*180/Math.PI).toFixed(2)}° ${point.latitude>=0?'N':'S'} · ${Math.abs(point.longitude*180/Math.PI).toFixed(2)}° ${point.longitude>=0?'E':'W'} · ${point.height.toFixed(0)} км`);setStatus(`SGP4 · ${date.toISOString().slice(0,16).replace('T',' ')} UTC${curSpeed>1?` · ×${curSpeed}`:''} · зелена смуга — зона, яку прилад бачить за прольоту`);lastText=now}
     }
    }catch{model.visible=false}
    else if(now-lastText>1000){setStatus('Немає свіжих елементів · випадкова орбіта не показується');setOrbitStats('');lastText=now}
   }
   controls.update();renderer.render(scene,camera);
  };
  animate();const resize=new ResizeObserver(()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix()});resize.observe(el);
  return()=>{active=false;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();draco.dispose();disposeTree(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()};
 },[mission.id,mode,failed]);
 if(failed)return <MissionPhoto mission={mission}/>;
 return <div className="mission-model-wrap"><div className="mission-model" ref={host}/>{mode==='orbit'&&<div className={styles.orbitStats}>{orbitStats&&<span>{orbitStats}</span>}{swathInfo&&<span>{swathInfo.label}</span>}{passInfo&&<span className={styles.passInfo}>{passInfo}</span>}</div>}{mode==='orbit'&&<div className={styles.speed} role="group" aria-label="Швидкість часу">{[1,60,600].map(v=><button key={v} aria-pressed={speed===v} onClick={()=>setSpeed(v)}>{v===1?'Реальний час':`×${v}`}</button>)}</div>}<span className="mission-model-status">{status}</span></div>
}

function swathGeometry(units:THREE.Vector3[],halfAngle:number){
 const positions:number[]=[],index:number[]=[];
 units.forEach((u,i)=>{const next=units[Math.min(i+1,units.length-1)],prev=units[Math.max(i-1,0)];const d=next.clone().sub(prev);const n=u.clone().cross(d).normalize();const a=u.clone().multiplyScalar(Math.cos(halfAngle)),b=n.multiplyScalar(Math.sin(halfAngle));const l=a.clone().add(b).multiplyScalar(5.028),r=a.clone().sub(b).multiplyScalar(5.028);positions.push(l.x,l.y,l.z,r.x,r.y,r.z);if(i<units.length-1){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2)}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(index);return g;
}
function nextPass(sat:satellite.SatRec,target:{lat:number;lon:number;name:string},swath?:{km:number;daylight:boolean}){
 if(!swath)return '';
 const lat=target.lat*Math.PI/180,lon=target.lon*Math.PI/180,fu=new THREE.Vector3(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));const half=Math.max(swath.km,8)/2;
 const at=(t:Date)=>{const st=satellite.propagate(sat,t);if(!st?.position)return null;const g=satellite.eciToGeodetic(st.position,satellite.gstime(t));const u=new THREE.Vector3(Math.cos(g.latitude)*Math.sin(g.longitude),Math.sin(g.latitude),Math.cos(g.latitude)*Math.cos(g.longitude));return Math.acos(Math.min(1,u.dot(fu)))*R_EARTH};
 const lit=(t:Date)=>{const s=subsolar(t);const su=new THREE.Vector3(Math.cos(s.lat)*Math.sin(s.lon),Math.sin(s.lat),Math.cos(s.lat)*Math.cos(s.lon));return su.dot(fu)>.1};
 const start=Date.now(),horizon=(swath.km<500?17:4)*864e5;
 for(let t=start;t<start+horizon;t+=30000){const d=at(new Date(t));if(d===null||d>half+260)continue;let best=d,bt=t;for(let f=t-30000;f<=t+30000;f+=1000){const x=at(new Date(f));if(x!==null&&x<best){best=x;bt=f}}if(best<=half&&(!swath.daylight||lit(new Date(bt)))){const hours=(bt-start)/36e5;return `Наступний проліт над «${target.name}»: ${new Date(bt).toISOString().slice(0,16).replace('T',' ')} UTC · через ${hours<1?`${Math.round(hours*60)} хв`:`${hours.toFixed(1)} год`} · ${Math.round(best)} км від треку${swath.daylight?' · денний проліт, хмарність не врахована':''}`}t+=600000}
 return `За ${Math.round(horizon/864e5)} діб поле «${target.name}» не потрапляє в смугу огляду${swath.daylight?' вдень':''}.`;
}
