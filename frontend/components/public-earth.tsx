'use client';
import {useEffect,useRef,useState} from 'react';
import {Map as LibreMap,setWorkerUrl} from 'maplibre-gl';
import {orbitalLayer} from '@/lib/orbital-layer';

export default function PublicEarth(){
 const container=useRef<HTMLDivElement>(null);const[selected,setSelected]=useState('');
 useEffect(()=>{
  if(!container.current)return;setWorkerUrl('/maplibre-worker.mjs');
  let map:LibreMap;try{map=new LibreMap({container:container.current,center:[34,30],zoom:.95,canvasContextAttributes:{antialias:true},pixelRatio:Math.min(devicePixelRatio,2),scrollZoom:false,doubleClickZoom:false,attributionControl:{compact:true},style:{version:8,projection:{type:'globe'},sky:{'sky-color':'#06111f','horizon-color':'#3c7b91','atmosphere-blend':.8},sources:{earth:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'© Esri, Maxar, Earthstar Geographics'}},layers:[{id:'ocean',type:'background',paint:{'background-color':'#092333'}},{id:'earth',type:'raster',source:'earth'}]}})}catch{return}
  map.on('error',()=>{});map.once('style.load',()=>map.addLayer(orbitalLayer(map,setSelected)));
  const timer=setInterval(()=>map.triggerRepaint(),1200);const resize=new ResizeObserver(()=>map.resize());resize.observe(container.current);
  return()=>{clearInterval(timer);resize.disconnect();map.remove()};
 },[]);
 return <div className="public-earth"><div className="public-earth-map" ref={container} aria-label="Interactive Earth globe"/><span className="public-earth-label">ORBITAL SIMULATION / ESRI IMAGERY</span>{selected&&<button className="public-earth-selected" onClick={()=>setSelected('')}>{selected} · MODELLED ×</button>}</div>
}
