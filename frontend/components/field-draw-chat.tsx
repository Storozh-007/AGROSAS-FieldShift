'use client';
import {useEffect,useRef,useState} from 'react';
import {Map as LibreMap,Marker,setWorkerUrl,type GeoJSONSource} from 'maplibre-gl';
import {api} from '@/lib/api';
import {polygonAreaHa,parseLatLon} from '@/lib/geo';
import type {Field} from '@/lib/types';

const CROPS:[string,string][]=[['wheat','Озима пшениця'],['maize','Кукурудза'],['sunflower','Соняшник'],['soybean','Соя'],['barley','Ячмінь'],['rapeseed','Ріпак'],['pea','Горох'],['sorghum','Сорго']];
type Draw={center:[number,number]|null;area_ha?:number|null;name:string;crops:string[]};

function square([lon,lat]:[number,number],ha:number){const s=Math.sqrt(ha*1e4)/2,dl=s/111320,dn=s/(111320*Math.cos(lat*Math.PI/180));return [[lon-dn,lat-dl],[lon+dn,lat-dl],[lon+dn,lat+dl],[lon-dn,lat+dl]]}

export default function FieldDrawChat({draw,onCreated}:{draw:Draw;onCreated:(f:Field)=>void}){
 const host=useRef<HTMLDivElement>(null);const map=useRef<LibreMap|null>(null);const markers=useRef<Marker[]>([]);
 const start:[number,number]=draw.center||[34.47,49.66];
 const[pts,setPts]=useState<number[][]>(draw.center&&draw.area_ha?square(draw.center,draw.area_ha):[]);
 const[name,setName]=useState(draw.name);const[crops,setCrops]=useState<string[]>(draw.crops.length?draw.crops:['wheat']);
 const[query,setQuery]=useState('');const[busy,setBusy]=useState(false);const[err,setErr]=useState('');const ptsRef=useRef(pts);ptsRef.current=pts;
 useEffect(()=>{if(!host.current)return;setWorkerUrl('/maplibre-worker.mjs');
  const m=new LibreMap({container:host.current,center:start,zoom:draw.center?14:5,attributionControl:false,style:{version:8,sources:{s:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19},l:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],tileSize:256}},layers:[{id:'s',type:'raster',source:'s'},{id:'l',type:'raster',source:'l'}]}});
  map.current=m;m.getCanvas().style.cursor='crosshair';m.doubleClickZoom.disable();
  m.on('load',()=>{m.addSource('p',{type:'geojson',data:{type:'FeatureCollection',features:[]}});m.addLayer({id:'pf',type:'fill',source:'p',paint:{'fill-color':'#f2c94c','fill-opacity':.3}});m.addLayer({id:'pl',type:'line',source:'p',paint:{'line-color':'#ffd84d','line-width':2.5}});paint(ptsRef.current)});
  m.on('click',e=>setPts(p=>[...p,[+e.lngLat.lng.toFixed(6),+e.lngLat.lat.toFixed(6)]]));
  return()=>{markers.current.forEach(x=>x.remove());m.remove();map.current=null};
 },[]);// eslint-disable-line react-hooks/exhaustive-deps
 function paint(p:number[][]){const m=map.current;if(!m?.getSource('p'))return;(m.getSource('p') as GeoJSONSource).setData({type:'FeatureCollection',features:p.length>=3?[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...p,p[0]]]}}]:p.length===2?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:p}}]:[]});
  markers.current.forEach(x=>x.remove());markers.current=p.map((pt,i)=>{const el=document.createElement('div');el.className='vertex-handle';const mk=new Marker({element:el,draggable:true}).setLngLat(pt as [number,number]).addTo(m);mk.on('dragend',()=>{const ll=mk.getLngLat();setPts(q=>q.map((v,j)=>j===i?[+ll.lng.toFixed(6),+ll.lat.toFixed(6)]:v))});return mk})}
 useEffect(()=>{paint(pts)},[pts]);
 async function find(e:React.FormEvent){e.preventDefault();const c=parseLatLon(query);if(c){map.current?.flyTo({center:c,zoom:15});return}if(!query.trim())return;try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);const j=await r.json();if(j[0])map.current?.flyTo({center:[+j[0].lon,+j[0].lat],zoom:14});else setErr('Місце не знайдено')}catch{setErr('Пошук недоступний')}}
 async function create(){setBusy(true);setErr('');try{const f=await api<Field>('/fields',{name:name.trim()||'Нове поле',geometry:{type:'Polygon',coordinates:[[...pts,pts[0]]]},crop_history:crops,soil_type:'unknown',soil_ph:null,irrigation:false,priorities:{water:30,soil:30,resilience:25,economy:15}});onCreated(f)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 const area=polygonAreaHa(pts);
 return <div className="fdc">
  <form className="fdc-search" onSubmit={find}><input placeholder="Місце або 49.62, 34.46" value={query} onChange={e=>setQuery(e.target.value)}/><button>Знайти</button></form>
  <div className="fdc-map" ref={host}/>
  <div className="fdc-bar"><span>{pts.length<3?`Клацніть кути поля (${pts.length}/3+)`:`${area.toFixed(1)} га · ${pts.length} вершин`}</span><button type="button" onClick={()=>setPts(p=>p.slice(0,-1))} disabled={!pts.length}>↶</button><button type="button" onClick={()=>setPts([])} disabled={!pts.length}>Очистити</button></div>
  <input className="fdc-name" value={name} onChange={e=>setName(e.target.value)} maxLength={100} aria-label="Назва поля"/>
  <div className="fdc-crops"><small>Що росло (від старшого року):</small>{CROPS.map(([id,n])=><button key={id} type="button" aria-pressed={crops.includes(id)} onClick={()=>setCrops(c=>c.includes(id)?c.filter(x=>x!==id):[...c,id])}>{n}</button>)}</div>
  {err&&<p className="as-error">{err}</p>}
  <button className="fdc-go" disabled={pts.length<3||busy||area<.1||!crops.length} onClick={create}>{busy?'Створюю…':`Створити поле${pts.length>=3?` · ${area.toFixed(1)} га`:''}`}</button>
 </div>;
}
