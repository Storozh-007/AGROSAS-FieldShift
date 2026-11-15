'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Body,HelioVector,GeoVector,RotateVector,Rotation_EQJ_ECL,Illumination} from 'astronomy-engine';
import './solar-system.css';

/** Real heliocentric positions (Astronomy Engine, VSOP87) on a compressed distance scale: r_vis = 9·√r_AU.
 * Comets use published osculating elements solved with Kepler's equation. Sizes are exaggerated for visibility. */
type Planet={body:Body;name:string;color:string;size:number;periodDays:number;note:string;ring?:boolean};
const PLANETS:Planet[]=[
 {body:Body.Mercury,name:'Меркурій',color:'#b9aea2',size:.32,periodDays:87.97,note:'Найближча до Сонця планета; рік — 88 діб.'},
 {body:Body.Venus,name:'Венера',color:'#e8cf9a',size:.55,periodDays:224.7,note:'Парниковий ефект розігрів поверхню до 465 °C — урок для клімату Землі.'},
 {body:Body.Earth,name:'Земля',color:'#4f9cff',size:.58,periodDays:365.256,note:'Ваше поле тут. Супутники NASA обертаються на висоті 400–900 км.'},
 {body:Body.Mars,name:'Марс',color:'#e0703f',size:.42,periodDays:686.98,note:'NASA вивчає марсіанський ґрунт для майбутнього вирощування рослин.'},
 {body:Body.Jupiter,name:'Юпітер',color:'#d8b48a',size:1.25,periodDays:4332.6,note:'Найбільша планета; її гравітація відхиляє комети від внутрішньої системи.'},
 {body:Body.Saturn,name:'Сатурн',color:'#e6d29a',size:1.05,periodDays:10759,note:'Кільця з льоду й пилу завширшки 280 000 км.',ring:true},
 {body:Body.Uranus,name:'Уран',color:'#9fe3e8',size:.75,periodDays:30687,note:'Обертається «на боці» — нахил осі 98°.'},
 {body:Body.Neptune,name:'Нептун',color:'#5d7bff',size:.72,periodDays:60190,note:'Найсильніші вітри в Сонячній системі — до 2 100 км/год.'},
];
// a [AU], e, i, Ω, ω [deg], perihelion time (JD TT). Sources: JPL Small-Body Database osculating elements.
const COMETS=[
 {name:'1P/Галлея',a:17.834,e:.96714,i:162.26,node:58.42,peri:111.33,tp:2446470.96,note:'Повертається кожні 76 років; наступний перигелій — 2061.'},
 {name:'2P/Енке',a:2.2152,e:.8483,i:11.78,node:334.57,peri:186.55,tp:2460240.23,note:'Найкоротший період серед відомих комет — 3,3 року.'},
 {name:'67P/Чурюмова–Герасименко',a:3.463,e:.6497,i:3.87,node:36.33,peri:22.15,tp:2459520.6,note:'Перша комета, на яку сів апарат (Rosetta/Philae, 2014).'},
 {name:'C/2023 A3 Цзицзіньшань–ATLAS',a:-2933,e:1.000134,i:139.11,node:21.56,peri:308.49,tp:2460581.24,note:'Яскрава комета осені 2024 року; йде з Сонячної системи.'},
];
const STARS:[string,number,number,number][]=[ // name, RA h, Dec °, magnitude
 ['Сіріус',6.752,-16.72,-1.46],['Канопус',6.399,-52.7,-.74],['Арктур',14.261,19.18,-.05],['Вега',18.616,38.78,.03],['Капела',5.278,46,.08],['Рігель',5.242,-8.2,.13],['Процiон',7.655,5.22,.34],['Бетельгейзе',5.919,7.41,.5],['Альтаїр',19.846,8.87,.77],['Альдебаран',4.599,16.51,.86],['Антарес',16.49,-26.43,.96],['Спіка',13.42,-11.16,.97],['Полярна',2.53,89.26,1.98],['Денеб',20.69,45.28,1.25],['Регул',10.14,11.97,1.35],
];
const R=(au:number)=>9*Math.sqrt(au);
const ECL=Rotation_EQJ_ECL();
const toScene=(v:{x:number;y:number;z:number})=>{const e=RotateVector(ECL,v as never) as unknown as {x:number;y:number;z:number};const r=Math.hypot(e.x,e.y,e.z)||1e-9;const k=R(r)/r;return new THREE.Vector3(e.x*k,e.z*k,-e.y*k)};
const JD=(d:Date)=>d.getTime()/864e5+2440587.5;
function cometPos(c:typeof COMETS[number],date:Date){
 const rad=Math.PI/180,mu=.01720209895**2;const dt=JD(date)-c.tp;let x:number,y:number;
 if(c.e<1){const n=Math.sqrt(mu/c.a**3);const M=n*dt;let E=M;for(let k=0;k<30;k++)E-=(E-c.e*Math.sin(E)-M)/(1-c.e*Math.cos(E));x=c.a*(Math.cos(E)-c.e);y=c.a*Math.sqrt(1-c.e*c.e)*Math.sin(E)}
 else{const a=Math.abs(c.a);const n=Math.sqrt(mu/a**3);const M=n*dt;let H=Math.asinh(M/c.e);for(let k=0;k<50;k++)H-=(c.e*Math.sinh(H)-H-M)/(c.e*Math.cosh(H)-1);x=a*(c.e-Math.cosh(H));y=a*Math.sqrt(c.e*c.e-1)*Math.sinh(H)}
 const O=c.node*rad,w=c.peri*rad,i=c.i*rad;
 const X=(Math.cos(O)*Math.cos(w)-Math.sin(O)*Math.sin(w)*Math.cos(i))*x+(-Math.cos(O)*Math.sin(w)-Math.sin(O)*Math.cos(w)*Math.cos(i))*y;
 const Y=(Math.sin(O)*Math.cos(w)+Math.cos(O)*Math.sin(w)*Math.cos(i))*x+(-Math.sin(O)*Math.sin(w)+Math.cos(O)*Math.cos(w)*Math.cos(i))*y;
 const Z=Math.sin(w)*Math.sin(i)*x+Math.cos(w)*Math.sin(i)*y;
 const r=Math.hypot(X,Y,Z),k=R(r)/r;return{v:new THREE.Vector3(X*k,Z*k,-Y*k),au:r};
}

export default function SolarSystem({onClose}:{onClose:()=>void}){
 const host=useRef<HTMLDivElement>(null);const tagsRef=useRef<HTMLDivElement>(null);const tipRef=useRef<HTMLDivElement>(null);
 const[days,setDays]=useState(0);const[play,setPlay]=useState(false);const daysRef=useRef(0);daysRef.current=days;const[leaving,setLeaving]=useState(false);
 useEffect(()=>{if(!play)return;const t=setInterval(()=>setDays(d=>d>=1095?-1095:d+3),50);return()=>clearInterval(t)},[play]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)});
 const close=()=>{setLeaving(true);setTimeout(onClose,450)};
 useEffect(()=>{
  const el=host.current,tagHost=tagsRef.current;if(!el||!tagHost)return;
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(el.clientWidth,el.clientHeight);el.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#01040b');
  const camera=new THREE.PerspectiveCamera(45,el.clientWidth/el.clientHeight,.1,4000);camera.position.set(0,46,78);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=6;controls.maxDistance=420;controls.autoRotate=true;controls.autoRotateSpeed=.25;
  // Stars: dense band along the galactic plane + uniform field + real bright stars.
  const starGeo=new THREE.BufferGeometry();const pos:number[]=[],col:number[]=[];const galPole=new THREE.Vector3(-.867,.455,-.198).normalize();
  for(let k=0;k<9000;k++){const v=new THREE.Vector3().randomDirection();if(k<5500){const d=Math.abs(v.dot(galPole));if(d>.18&&Math.random()>.12)continue}v.multiplyScalar(1500+Math.random()*300);pos.push(v.x,v.y,v.z);const t=Math.random();const c=new THREE.Color().setHSL(.58+t*.12,.4,.62+Math.random()*.3);col.push(c.r,c.g,c.b)}
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({size:2.1,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85})));
  const tags:{obj:THREE.Object3D|THREE.Vector3;el:HTMLDivElement;fixed?:boolean}[]=[];
  const tag=(text:string,obj:THREE.Object3D|THREE.Vector3,cls='')=>{const d=document.createElement('div');d.className=`ss-tag ${cls}`;d.textContent=text;tagHost.append(d);tags.push({obj,el:d});return d};
  STARS.forEach(([name,ra,dec,mag])=>{const a=ra*15*Math.PI/180,b=dec*Math.PI/180;const eq={x:Math.cos(b)*Math.cos(a),y:Math.cos(b)*Math.sin(a),z:Math.sin(b)};const v=toScene(eq).normalize().multiplyScalar(1400);const s=new THREE.Mesh(new THREE.SphereGeometry(Math.max(2.2,6-mag*2),8,8),new THREE.MeshBasicMaterial({color:'#fff6e0'}));s.position.copy(v);scene.add(s);tag(name,v,'star')});
  // Sun
  const sun=new THREE.Mesh(new THREE.SphereGeometry(2.4,48,32),new THREE.MeshBasicMaterial({color:'#ffd27a'}));scene.add(sun);
  const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!;const gr=g.createRadialGradient(128,128,0,128,128,128);gr.addColorStop(0,'rgba(255,220,140,1)');gr.addColorStop(.25,'rgba(255,170,60,.55)');gr.addColorStop(1,'rgba(255,120,20,0)');g.fillStyle=gr;g.fillRect(0,0,256,256);return new THREE.CanvasTexture(c)})();
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false}));glow.scale.set(12,12,1);scene.add(glow);tag('Сонце',sun,'sun');
  scene.add(new THREE.PointLight('#fff1d6',3.2,0,0));scene.add(new THREE.AmbientLight('#334',.6));
  const date0=new Date();const at=(d:number)=>new Date(date0.getTime()+d*864e5);
  const planets=PLANETS.map(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(p.size,40,28),new THREE.MeshStandardMaterial({color:p.color,roughness:.85,emissive:p.color,emissiveIntensity:.08}));scene.add(m);
   if(p.ring){const ring=new THREE.Mesh(new THREE.RingGeometry(p.size*1.4,p.size*2.3,64),new THREE.MeshBasicMaterial({color:'#d9c793',side:THREE.DoubleSide,transparent:true,opacity:.55}));ring.rotation.x=Math.PI/2.4;m.add(ring)}
   const pts:THREE.Vector3[]=[];for(let k=0;k<=240;k++)pts.push(toScene(HelioVector(p.body,at(k/240*p.periodDays))));
   scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:p.color,transparent:true,opacity:p.body===Body.Earth?.55:.22})));
   tag(p.name,m,p.body===Body.Earth?'earth':'');return{p,m}});
  const earth=planets.find(x=>x.p.body===Body.Earth)!;const moon=new THREE.Mesh(new THREE.SphereGeometry(.17,20,14),new THREE.MeshStandardMaterial({color:'#cfcfcf'}));scene.add(moon);
  const comets=COMETS.map(c=>{const head=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({color:'#dff6ff'}));scene.add(head);
   const span=c.e<1?2*Math.PI*Math.sqrt(c.a**3)/.01720209895:4000;const pts:THREE.Vector3[]=[];for(let k=0;k<=400;k++)pts.push(cometPos(c,new Date((c.tp-2440587.5+(k/400-.5)*span)*864e5)).v);
   scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:'#8fd8ff',dashSize:.6,gapSize:.5,transparent:true,opacity:.35})).computeLineDistances());
   const tail=new THREE.Mesh(new THREE.ConeGeometry(.35,1,16,1,true),new THREE.MeshBasicMaterial({color:'#9fe6ff',transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(tail);
   tag(c.name,head,'comet');return{c,head,tail}});
  // hover
  const ray=new THREE.Raycaster();const mouse=new THREE.Vector2();
  const targets=[...planets.map(x=>({obj:x.m as THREE.Object3D,info:()=>planetInfo(x.p)})),{obj:sun as THREE.Object3D,info:()=>`<b>Сонце</b><p>Джерело енергії для фотосинтезу. Сонячну радіацію над полем вимірює NASA POWER (ALLSKY_SFC_SW_DWN).</p>`},...comets.map(x=>({obj:x.head as THREE.Object3D,info:()=>{const p=cometPos(x.c,at(daysRef.current));return `<b>${x.c.name}</b><dl><div><dt>Від Сонця</dt><dd>${p.au.toFixed(2)} а.о.</dd></div><div><dt>Орбіта</dt><dd>${x.c.e<1?`${(Math.sqrt(x.c.a**3)).toFixed(1)} років`:'гіперболічна'}</dd></div></dl><p>${x.c.note}</p>`}})),{obj:moon as THREE.Object3D,info:()=>`<b>Місяць</b><p>Фаза ${Math.round(Illumination(Body.Moon,at(daysRef.current)).phase_fraction*100)}%. Нічне місячне світло впливає на теплові знімки й активність шкідників.</p>`}];
  function planetInfo(p:Planet){const d=at(daysRef.current);const h=HelioVector(p.body,d);const r=Math.hypot(h.x,h.y,h.z);const g=p.body===Body.Earth?null:GeoVector(p.body,d,true);const ge=g?Math.hypot(g.x,g.y,g.z):0;
   return `<b>${p.name}</b><dl><div><dt>Від Сонця</dt><dd>${r.toFixed(3)} а.о.</dd></div>${g?`<div><dt>Від Землі</dt><dd>${(ge*149.6).toFixed(0)} млн км</dd></div><div><dt>Світло йде</dt><dd>${(ge*8.317).toFixed(1)} хв</dd></div>`:''}<div><dt>Рік</dt><dd>${p.periodDays<1000?`${p.periodDays.toFixed(0)} діб`:`${(p.periodDays/365.25).toFixed(1)} р.`}</dd></div></dl><p>${p.note}</p>`}
  const onMove=(e:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);ray.params.Points={threshold:1};const hits=ray.intersectObjects(targets.map(t=>t.obj),false);const tip=tipRef.current;if(!tip)return;
   if(!hits.length){tip.style.display='none';return}const t=targets.find(x=>x.obj===hits[0].object);if(!t)return;tip.innerHTML=t.info();tip.style.display='block';tip.style.transform=`translate(${Math.min(e.clientX-r.left+16,r.width-270)}px,${Math.max(8,e.clientY-r.top-10)}px)`};
  renderer.domElement.addEventListener('pointermove',onMove);
  let frame=0;const v=new THREE.Vector3();
  const loop=()=>{frame=requestAnimationFrame(loop);const d=at(daysRef.current);
   planets.forEach(({p,m})=>{m.position.copy(toScene(HelioVector(p.body,d)));m.rotation.y+=.01});
   const g=GeoVector(Body.Moon,d,true);const mv=new THREE.Vector3(g.x,g.z,-g.y).normalize().multiplyScalar(1.3);moon.position.copy(earth.m.position).add(mv);
   comets.forEach(({c,head,tail})=>{const p=cometPos(c,d);head.position.copy(p.v);const L=p.au<4?Math.min(9,6/Math.max(p.au,.3)):0;tail.visible=L>0;if(L>0){const dir=p.v.clone().normalize();tail.scale.set(1,L,1);tail.position.copy(p.v).add(dir.clone().multiplyScalar(L/2));tail.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),dir.negate())}});
   glow.material.rotation+=.0015;controls.update();renderer.render(scene,camera);
   const w=el.clientWidth,h=el.clientHeight;tags.forEach(t=>{const p=t.obj instanceof THREE.Vector3?t.obj:t.obj.position;v.copy(p).project(camera);t.el.style.display=v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1?'':'none';t.el.style.transform=`translate(-50%,-140%) translate(${(v.x+1)/2*w}px,${(1-v.y)/2*h}px)`})};
  loop();
  const ro=new ResizeObserver(()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix()});ro.observe(el);
  renderer.domElement.addEventListener('pointerdown',()=>{controls.autoRotate=false});
  return()=>{cancelAnimationFrame(frame);ro.disconnect();renderer.domElement.removeEventListener('pointermove',onMove);tags.forEach(t=>t.el.remove());controls.dispose();scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();const mat=m.material as THREE.Material|THREE.Material[]|undefined;if(Array.isArray(mat))mat.forEach(x=>x.dispose());else mat?.dispose()});renderer.dispose();renderer.domElement.remove()};
 },[]);
 const date=new Date(Date.now()+days*864e5);
 return createPortal(<div className={`ss-overlay ${leaving?'leaving':''}`} role="dialog" aria-label="Сонячна система">
  <div ref={host} className="ss-canvas"/><div ref={tagsRef} className="ss-tags"/><div ref={tipRef} className="ss-tip"/>
  <header className="ss-head"><div><span>AGROSAS · SOLAR SYSTEM</span><h2>Сонячна система зараз</h2><p>Реальні положення планет (Astronomy Engine / VSOP87), орбіти комет з JPL. Відстані стиснуто (√r), розміри збільшено.</p></div><button onClick={close} aria-label="Повернутися до Землі">← До Землі</button></header>
  <div className="ss-time"><button onClick={()=>setPlay(!play)}>{play?'❚❚':'▶'}</button><input type="range" min={-1095} max={1095} value={days} onChange={e=>{setPlay(false);setDays(Number(e.target.value))}} aria-label="Дата"/><b>{date.toISOString().slice(0,10)}</b><button onClick={()=>{setPlay(false);setDays(0)}}>Сьогодні</button></div>
  </div>,document.body);
}
