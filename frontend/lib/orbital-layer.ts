import type {Map as LibreMap,CustomLayerInterface,CustomRenderMethodInput} from 'maplibre-gl';
import * as satellite from 'satellite.js';
import {api} from './api';
import {celestial} from './farm-simulation';

/** Real-time fleet on the globe: every craft is propagated with SGP4 from fresh CelesTrak elements.
 * Craft without fresh elements are not drawn — no invented positions. */
export type FleetCraft={norad:number;name:string;agency:string;role:string;sensor:string;swathKm:number;color:string;group:'nasa'|'partner'|'starlink';farm:string};
export const FLEET:FleetCraft[]=[
 {norad:25994,name:'Terra',agency:'NASA',role:'MODIS: NDVI, температура поверхні щодня',sensor:'MODIS · 36 смуг · 250–1000 м',swathKm:2330,color:'#7dd3fc',group:'nasa',farm:'Регіональна вегетація і тепловий стрес'},
 {norad:39084,name:'Landsat 8',agency:'NASA / USGS',role:'Оптика й тепло для полів',sensor:'OLI + TIRS · 30 м',swathKm:185,color:'#59d9f7',group:'nasa',farm:'NDVI і температура окремого поля, 16 діб'},
 {norad:49260,name:'Landsat 9',agency:'NASA / USGS',role:'Оптика й тепло для полів',sensor:'OLI‑2 + TIRS‑2 · 30 м',swathKm:185,color:'#86efac',group:'nasa',farm:'Разом з Landsat 8 — знімок кожні 8 діб'},
 {norad:40376,name:'SMAP',agency:'NASA / JPL',role:'Вологість ґрунту, замерзання',sensor:'L‑діапазон радіометр · 9–36 км',swathKm:1000,color:'#22d3ee',group:'nasa',farm:'Волога кореневої зони, посуха'},
 {norad:39574,name:'GPM Core',agency:'NASA / JAXA',role:'Опади з космосу (IMERG)',sensor:'DPR радар + GMI · 5–15 км',swathKm:885,color:'#60a5fa',group:'nasa',farm:'Скільки дощу випало на поле'},
 {norad:25544,name:'МКС · ECOSTRESS / GEDI',agency:'NASA',role:'Тепло і випаровування, лідар',sensor:'ECOSTRESS 70 м · GEDI 25 м',swathKm:384,color:'#fbbf24',group:'nasa',farm:'Гарячі точки водного стресу вдень'},
 {norad:43013,name:'NOAA‑20 · VIIRS',agency:'NOAA / NASA',role:'Щоденна вегетація, пожежі',sensor:'VIIRS · 375–750 м',swathKm:3040,color:'#c4b5fd',group:'nasa',farm:'Щоденний огляд регіону, NDVI'},
 {norad:37849,name:'Suomi NPP',agency:'NASA / NOAA',role:'VIIRS, архів з 2011',sensor:'VIIRS · 375–750 м',swathKm:3040,color:'#a78bfa',group:'nasa',farm:'Довгий ряд вегетації'},
 {norad:42063,name:'Sentinel‑2B',agency:'ESA / Copernicus',role:'Оптика 10 м для полів',sensor:'MSI · 13 смуг · 10 м',swathKm:290,color:'#f472b6',group:'partner',farm:'NDVI 10 м — зони поля'},
 {norad:60989,name:'Sentinel‑2C',agency:'ESA / Copernicus',role:'Оптика 10 м для полів',sensor:'MSI · 13 смуг · 10 м',swathKm:290,color:'#fb7185',group:'partner',farm:'Разом з 2B — знімок кожні 5 діб'},
];
/** Which craft produces each data layer: when a layer is on, only these stay on the globe. */
export const LAYER_CRAFT:Record<string,number[]>={'modis-lst':[25994],'modis-ndvi':[25994],'viirs-ndvi':[43013,37849],gpm:[39574],smap:[40376],'smap-root':[40376],landsat:[39084,49260],'hls-sentinel':[42063,60989],'sentinel-ndvi':[42063,60989],gedi:[25544]};
type Live={craft:FleetCraft;rec:satellite.SatRec;epoch:string;age:number};
type Star={name:string;rec:satellite.SatRec;epoch:string};
const R=6371.0088;
function geo(rec:satellite.SatRec,date:Date){const pv=satellite.propagate(rec,date);if(!pv?.position||typeof pv.position==='boolean')return null;const g=satellite.eciToGeodetic(pv.position,satellite.gstime(date));const v=pv.velocity&&typeof pv.velocity!=='boolean'?Math.hypot(pv.velocity.x,pv.velocity.y,pv.velocity.z):0;return {lat:g.latitude,lon:g.longitude,h:g.height,v}}
function xyz(lat:number,lon:number,h:number):[number,number,number]{const r=1+h/R;return[Math.sin(lon)*Math.cos(lat)*r,Math.sin(lat)*r,Math.cos(lon)*Math.cos(lat)*r]}
function compile(gl:WebGL2RenderingContext,type:number,source:string){const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Orbit shader failed');return shader}
const hex=(c:string)=>[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255];
const deg=(r:number)=>r*180/Math.PI;

export function orbitalLayer(map:LibreMap,onSelect:(label:string)=>void,clock:()=>Date=()=>new Date(),focus:()=>number[]|null=()=>null):CustomLayerInterface{
 let removed=false,program:WebGLProgram|null=null,lineVao:WebGLVertexArrayObject|null=null,lineBuf:WebGLBuffer|null=null,starVao:WebGLVertexArrayObject|null=null,starBuf:WebGLBuffer|null=null,nightVao:WebGLVertexArrayObject|null=null,nightBuf:WebGLBuffer|null=null,nightCount=0;
 let uPlane:WebGLUniformLocation|null=null,uMatrix:WebGLUniformLocation|null=null,uColor:WebGLUniformLocation|null=null,uMode:WebGLUniformLocation|null=null,uSun:WebGLUniformLocation|null=null;
 let live:Live[]=[],stars:Star[]=[],starTotal=0,tracks:{offset:number;count:number;color:number[]}[]=[],lastTracks=0,lastEph=NaN,eph=celestial(clock());
 const craftEls:HTMLButtonElement[]=[],bodies:HTMLButtonElement[]=[];let tip:HTMLDivElement|null=null;let screen:{x:number;y:number;kind:'craft'|'star';i:number}[]=[];let hover:{kind:'craft'|'star';i:number}|null=null;
 const container=map.getCanvasContainer();
 const buildTracks=(gl:WebGL2RenderingContext,date:Date)=>{const v:number[]=[];tracks=[];for(const l of live){const period=2*Math.PI/l.rec.no*60000;const offset=v.length/3;for(let i=-80;i<=80;i++){const g=geo(l.rec,new Date(date.getTime()+i*period/160));if(g)v.push(...xyz(g.lat,g.lon,g.h))}tracks.push({offset,count:v.length/3-offset,color:hex(l.craft.color)})}gl.bindBuffer(gl.ARRAY_BUFFER,lineBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.DYNAMIC_DRAW);lastTracks=date.getTime()};
 const makeCraft=(l:Live,i:number)=>{const el=document.createElement('button');el.type='button';el.className=`orbital-craft craft-${l.craft.group}`;el.style.color=l.craft.color;el.setAttribute('aria-label',`${l.craft.name} · SGP4`);
  el.innerHTML='<svg viewBox="0 0 40 30" width="34" height="26" aria-hidden="true"><path d="m1 9 11-3 3 13-11 3Zm25-6 11-2 3 13-11 3Z" fill="#0e2c44" stroke="currentColor" stroke-width="1"/><path d="m14 7 9-2 5 15-10 3-4-16Z" fill="currentColor" fill-opacity=".85" stroke="#fff" stroke-width=".8"/></svg>';
  const label=document.createElement('span');label.textContent=l.craft.name;el.append(label);
  el.onmouseenter=()=>{hover={kind:'craft',i}};el.onmouseleave=()=>{hover=null};el.onclick=e=>{e.stopPropagation();onSelect(`${l.craft.name} · ${l.craft.agency}`)};container.append(el);craftEls.push(el)};
 const onMove=(e:MouseEvent)=>{if((e.target as HTMLElement).closest?.('.orbital-craft'))return;const rect=map.getCanvas().getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;let best=-1,bd=12*12;screen.forEach((p,k)=>{if(p.kind!=='star')return;const d=(p.x-x)**2+(p.y-y)**2;if(d<bd){bd=d;best=k}});hover=best>=0?{kind:'star',i:screen[best].i}:null};
 const card=(date:Date)=>{if(!tip)return;if(!hover||map.getZoom()>=5){tip.style.display='none';return}
  const isCraft=hover.kind==='craft';const rec=isCraft?live[hover.i]?.rec:stars[hover.i]?.rec;if(!rec){tip.style.display='none';return}const g=geo(rec,date);if(!g){tip.style.display='none';return}
  const pt=screen.find(p=>p.kind===hover!.kind&&p.i===hover!.i);if(!pt){tip.style.display='none';return}
  const period=2*Math.PI/rec.no;const inc=deg(rec.inclo);const coords=`${Math.abs(deg(g.lat)).toFixed(2)}° ${g.lat>=0?'N':'S'} · ${Math.abs(deg(g.lon)).toFixed(2)}° ${g.lon>=0?'E':'W'}`;
  if(isCraft){const l=live[hover.i];tip.innerHTML=`<header style="--c:${l.craft.color}"><i></i><div><b>${l.craft.name}</b><small>${l.craft.agency} · NORAD ${l.craft.norad}</small></div></header><p>${l.craft.role}</p><dl><div><dt>Висота</dt><dd>${g.h.toFixed(0)} км</dd></div><div><dt>Швидкість</dt><dd>${g.v.toFixed(2)} км/с</dd></div><div><dt>Оберт</dt><dd>${period.toFixed(1)} хв</dd></div><div><dt>Нахил орбіти</dt><dd>${inc.toFixed(1)}°</dd></div><div><dt>Смуга огляду</dt><dd>${l.craft.swathKm} км</dd></div><div><dt>Зараз над</dt><dd>${coords}</dd></div></dl><p class="tip-sensor">${l.craft.sensor}</p><p class="tip-farm">Для поля: ${l.craft.farm}</p><small>SGP4 · TLE ${l.epoch.slice(0,16).replace('T',' ')} UTC · вік ${l.age.toFixed(0)} год</small>`}
  else{const s=stars[hover.i];tip.innerHTML=`<header style="--c:#e8f0a0"><i></i><div><b>${s.name}</b><small>SpaceX Starlink · 1 з ${starTotal.toLocaleString('uk-UA')} апаратів</small></div></header><p>Зв'язок для датчиків поля там, де немає мобільної мережі.</p><dl><div><dt>Висота</dt><dd>${g.h.toFixed(0)} км</dd></div><div><dt>Швидкість</dt><dd>${g.v.toFixed(2)} км/с</dd></div><div><dt>Оберт</dt><dd>${period.toFixed(1)} хв</dd></div><div><dt>Нахил орбіти</dt><dd>${inc.toFixed(1)}°</dd></div><div><dt>Зараз над</dt><dd>${coords}</dd></div></dl><small>SGP4 · CelesTrak · TLE ${s.epoch.slice(0,10)}</small>`}
  const w=map.getCanvas().clientWidth;tip.style.display='block';tip.style.transform=`translate(${Math.min(pt.x+18,w-300)}px,${Math.max(10,pt.y-40)}px)`};
 return{
  id:'orbital-fleet',type:'custom',renderingMode:'3d',
  onAdd(_map,gl){
   const vs=compile(gl,gl.VERTEX_SHADER,'#version 300 es\nin vec3 a_position;uniform mat4 u_matrix;uniform float u_mode;out vec3 v_normal;out vec3 v_pos;void main(){v_normal=normalize(a_position);v_pos=a_position;gl_Position=u_matrix*vec4(a_position,1.0);gl_PointSize=u_mode>1.5?3.2:1.0;}');
   const fs=compile(gl,gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;in vec3 v_normal;in vec3 v_pos;uniform float u_mode;uniform vec3 u_sun;uniform vec4 u_color;uniform vec4 u_plane;out vec4 color;void main(){if(u_mode<0.5){if(dot(u_plane,vec4(v_pos,1.0))<0.0)discard;float c=dot(normalize(v_normal),u_sun);float night=1.0-smoothstep(-0.21,0.015,c);float twilight=smoothstep(-0.21,-0.02,c)*(1.0-smoothstep(-0.02,0.04,c));color=vec4(mix(vec3(0.004,0.012,0.035),vec3(0.06,0.09,0.22),twilight),night*0.74);}else if(u_mode>1.5){vec2 p=gl_PointCoord-0.5;if(dot(p,p)>0.25)discard;color=u_color;}else{color=u_color;}}');
   program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
   uMatrix=gl.getUniformLocation(program,'u_matrix');uColor=gl.getUniformLocation(program,'u_color');uMode=gl.getUniformLocation(program,'u_mode');uSun=gl.getUniformLocation(program,'u_sun');uPlane=gl.getUniformLocation(program,'u_plane');const attr=gl.getAttribLocation(program,'a_position');
   const vao=(buf:WebGLBuffer)=>{const a=gl.createVertexArray()!;gl.bindVertexArray(a);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);return a};
   lineBuf=gl.createBuffer()!;lineVao=vao(lineBuf);starBuf=gl.createBuffer()!;starVao=vao(starBuf);
   const sphere:number[]=[];const at=(lat:number,lon:number)=>{const a=lat*Math.PI/180,b=lon*Math.PI/180;return[Math.sin(b)*Math.cos(a)*1.0003,Math.sin(a)*1.0003,Math.cos(b)*Math.cos(a)*1.0003]};for(let lat=-90;lat<90;lat+=5)for(let lon=-180;lon<180;lon+=5)sphere.push(...at(lat,lon),...at(lat,lon+5),...at(lat+5,lon),...at(lat,lon+5),...at(lat+5,lon+5),...at(lat+5,lon));nightCount=sphere.length/3;nightBuf=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,nightBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(sphere),gl.STATIC_DRAW);nightVao=vao(nightBuf);
   tip=document.createElement('div');tip.className='orbit-tip';tip.style.display='none';container.append(tip);container.addEventListener('mousemove',onMove);
   api<{records:{norad_id:number;line1?:string;line2?:string;epoch?:string;age_hours?:number}[]}>('/orbits').then(d=>{if(removed)return;live=FLEET.flatMap(c=>{const r=d.records.find(x=>x.norad_id===c.norad);return r?.line1&&r.line2&&(r.age_hours??999)<336?[{craft:c,rec:satellite.twoline2satrec(r.line1,r.line2),epoch:r.epoch||'',age:r.age_hours||0}]:[]});live.forEach(makeCraft);buildTracks(gl,clock());map.triggerRepaint()}).catch(()=>{});
   api<{total:number;records:{name:string;line1:string;line2:string;epoch:string}[]}>('/orbits/starlink').then(d=>{if(removed)return;starTotal=d.total;stars=d.records.map(r=>({name:r.name,rec:satellite.twoline2satrec(r.line1,r.line2),epoch:r.epoch}));map.triggerRepaint()}).catch(()=>{});
   for(const kind of ['sun','moon']){const el=document.createElement('button');el.className=`celestial-body ${kind}`;el.type='button';el.innerHTML='<i></i><span></span>';el.setAttribute('aria-label',kind==='sun'?'Сонце · ефемериди':'Місяць · ефемериди');el.onclick=()=>onSelect(kind==='sun'?'Сонце · Astronomy Engine · EPHEMERIS':'Місяць · Astronomy Engine · EPHEMERIS');container.append(el);bodies.push(el)}
  },
  render(gl,input:CustomRenderMethodInput){
   const visible=map.getZoom()<5;for(const el of [...craftEls,...bodies])el.style.display=visible?'block':'none';if(!visible||!program){if(tip)tip.style.display='none';return}
   const date=clock();if(!Number.isFinite(lastEph)||Math.abs(date.getTime()-lastEph)>30000){eph=celestial(date);lastEph=date.getTime()}
   if(live.length&&Math.abs(date.getTime()-lastTracks)>20000)buildTracks(gl,date);
   const matrix=input.defaultProjectionData.mainMatrix;gl.useProgram(program);gl.uniformMatrix4fv(uMatrix,false,new Float32Array(matrix));
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
   const sl=eph.sun.latitude*Math.PI/180,so=eph.sun.longitude*Math.PI/180;gl.uniform3f(uSun,Math.sin(so)*Math.cos(sl),Math.sin(sl),Math.cos(so)*Math.cos(sl));
   const plane=input.defaultProjectionData.clippingPlane;gl.uniform4f(uPlane,plane[0],plane[1],plane[2],plane[3]);
   gl.uniform1f(uMode,0);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(nightVao);gl.drawArrays(gl.TRIANGLES,0,nightCount);
   gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniform1f(uMode,1);gl.bindVertexArray(lineVao);
   const only=focus();const shown=(i:number)=>!only||only.includes(live[i]?.craft.norad);
   tracks.forEach((t,i)=>{if(!shown(i))return;gl.uniform4f(uColor,t.color[0],t.color[1],t.color[2],only?.9:.55);gl.drawArrays(gl.LINE_STRIP,t.offset,t.count)})
   const width=map.getCanvas().clientWidth,height=map.getCanvas().clientHeight;
   const project=(p:[number,number,number])=>{const[x,y,z]=p;const w=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];const horizon=plane[0]*x+plane[1]*y+plane[2]*z+plane[3];if(w<=0||horizon<-.08)return null;return{x:((matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w*.5+.5)*width,y:(-(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w*.5+.5)*height}};
   const next:typeof screen=[];
   if(stars.length&&!only){const pts:number[]=[];stars.forEach((s,i)=>{const g=geo(s.rec,date);if(!g)return;const p=xyz(g.lat,g.lon,g.h);pts.push(...p);const sp=project(p);if(sp)next.push({...sp,kind:'star',i})});gl.bindBuffer(gl.ARRAY_BUFFER,starBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pts),gl.DYNAMIC_DRAW);gl.uniform1f(uMode,2);gl.uniform4f(uColor,.91,.94,.63,.85);gl.bindVertexArray(starVao);gl.drawArrays(gl.POINTS,0,pts.length/3)}
   gl.bindVertexArray(null);
   (['sun','moon'] as const).forEach((kind,i)=>{const body=eph[kind],lat=body.latitude*Math.PI/180,lon=body.longitude*Math.PI/180,r=kind==='sun'?3.4:2.3;const p:[number,number,number]=[Math.sin(lon)*Math.cos(lat)*r,Math.sin(lat)*r,Math.cos(lon)*Math.cos(lat)*r];const el=bodies[i];
    const w=matrix[3]*p[0]+matrix[7]*p[1]+matrix[11]*p[2]+matrix[15];const behind=plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]+plane[3]<-.6*r;
    let x=((matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12])/(w||1)*.5+.5)*width,y=(-(matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13])/(w||1)*.5+.5)*height;if(w<0){x=width-x;y=height-y}
    const m=34,off=w<0||x<m||x>width-m||y<m||y>height-m;if(off){const cx=width/2,cy=height/2,dx=x-cx,dy=y-cy,k=Math.min((cx-m)/Math.abs(dx||1e-6),(cy-m)/Math.abs(dy||1e-6));x=cx+dx*Math.min(1,k);y=cy+dy*Math.min(1,k)}
    el.style.display='block';el.classList.toggle('edge',off);el.classList.toggle('behind',behind&&!off);el.style.transform=`translate(${x-20}px,${y-20}px)`;
    el.querySelector('span')!.textContent=kind==='sun'?`СОНЦЕ · ${Math.abs(body.latitude).toFixed(1)}°${body.latitude>=0?'N':'S'} ${Math.abs(body.longitude).toFixed(1)}°${body.longitude>=0?'E':'W'}`:`МІСЯЦЬ · ${Math.round(eph.moonIllumination*100)}%`;
    if(kind==='moon')(el.querySelector('i') as HTMLElement).style.boxShadow=`inset ${(1-eph.moonIllumination)*27}px 0 2px #071522`;el.title=kind==='sun'?'Сонце в зеніті над цією точкою. Темна частина Землі — ніч зараз (Astronomy Engine).':'Місяць над цією точкою; фаза — освітлена частка диска.'});
   live.forEach((l,i)=>{const g=geo(l.rec,date);const el=craftEls[i];if(!g||!el)return;const sp=project(xyz(g.lat,g.lon,g.h));el.classList.toggle('focused',!!only&&shown(i));if(!sp||!shown(i)){el.style.visibility='hidden';return}el.style.visibility='visible';el.style.transform=`translate(${sp.x-17}px,${sp.y-13}px)`;next.push({...sp,kind:'craft',i})});
   screen=next;card(date);map.triggerRepaint();
  },
  onRemove(_map,gl){removed=true;container.removeEventListener('mousemove',onMove);tip?.remove();[...craftEls,...bodies].forEach(el=>el.remove());for(const b of [lineBuf,starBuf,nightBuf])if(b)gl.deleteBuffer(b);for(const v of [lineVao,starVao,nightVao])if(v)gl.deleteVertexArray(v);if(program)gl.deleteProgram(program)}
 }
}
