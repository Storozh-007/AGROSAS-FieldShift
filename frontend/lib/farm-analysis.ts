import type {FarmDesign} from './farm-design';
import {powerIslands} from './farm-network';
import type {EarthOverlay} from './earth-layers';
import type {SensorMeasurement} from './types';
export type AnalysisPin={id:string;title:string;detail:string;level:'info'|'warning';objectId?:string;longitude?:number;latitude?:number;basis:string};
export function analyzeFarm(design:FarmDesign,overlay:EarthOverlay|null|undefined,telemetry:SensorMeasurement[],flows:{unserved:number;solar:number;demand:number}){
 const pins:AnalysisPin[]=[];
 for(const island of powerIslands(design)){
  const source=island.some(x=>['solar','wind','battery','pole'].includes(x.kind)&&x.enabled);
  if(!source)for(const load of island.filter(x=>['barn','pump'].includes(x.kind)&&x.capacity>0))pins.push({id:`isolated-${load.id}`,title:'Обладнання без джерела живлення',detail:`${load.name}: у цьому електричному контурі немає сонячної станції, батареї або вводу мережі. Перевірте кабелі.`,level:'warning',objectId:load.id,basis:'Граф збережених/редагованих зʼєднань · PLAN'})
 }
 for(const item of design.objects.filter(x=>x.device_id)){
  const reading=telemetry.find(t=>t.device_id===item.device_id&&t.metric==='moisture_pct');if(!reading)continue;
  const age=(Date.now()-new Date(reading.timestamp).getTime())/3600000;
  if(reading.is_demo||age>6||age<0){pins.push({id:`stale-${item.id}`,title:reading.is_demo?'Демонстраційний датчик':'Потрібне свіже вимірювання',detail:`${item.name}: це показання не використовується для висновку про поточну вологість.`,level:'info',objectId:item.id,basis:`${reading.is_demo?'DEMO':'DEVICE RECORD'} · ${reading.timestamp}`});continue}
  pins.push({id:`probe-${item.id}`,title:`Вологість ${reading.value}% vol`,detail:`Запис привʼязаного датчика. Пороги залежать від ґрунту та глибини; значення слід зіставити з польовою вологоємністю й вологістю вʼянення.`,level:'info',objectId:item.id,basis:`DEVICE RECORD · ${reading.timestamp}`})
 }
 if(overlay){
  if(overlay.ndvi_mean!==undefined){for(const point of overlay.annotations||[])pins.push({id:`eo-${pins.length}`,title:point.title,detail:`NDVI ${point.value.toFixed(2)}. Це спектральний індикатор, а не діагноз. Порівняйте іншу безхмарну дату й перевірте ділянку на місці.`,level:'warning',longitude:point.longitude,latitude:point.latitude,basis:`Sentinel‑2 · ${overlay.date?.slice(0,10)} · маска якості`});pins.push({id:'eo-coverage',title:`Придатні дані: ${Math.round(overlay.valid_fraction*100)}% поля`,detail:overlay.valid_fraction<.6?'Частина поля закрита або відсіяна маскою. Середній NDVI не описує приховані ділянки.':`Середній NDVI ${overlay.ndvi_mean}. Зіставляйте дати з однаковою придатною площею.`,level:overlay.valid_fraction<.6?'warning':'info',basis:`Sentinel‑2 · ${overlay.date?.slice(0,10)}`})}
  else pins.push({id:'regional-layer',title:overlay.no_data?'Для поля немає пікселів':'Регіональний супутниковий контекст',detail:`${overlay.source}. ${overlay.resolution||''}. Колір GIBS не перетворюється на вигадане локальне числове значення.`,level:overlay.no_data?'warning':'info',basis:`NASA GIBS · ${overlay.date||'статичний набір'}`})
 }
 if(flows.unserved>.01)pins.push({id:'power-deficit',title:`Дефіцит ${flows.unserved.toFixed(1)} кВт`,detail:'У сценарії потужності недостатньо. Перевірте активні джерела, заряд, кабелі й мережу; зменште або перенесіть навантаження.',level:'warning',objectId:design.objects.find(x=>x.kind==='battery')?.id,basis:'Енергетична модель · SIM'})
 if(!pins.length)pins.push({id:'no-evidence',title:'Підготуйте дані для аналізу',detail:'Увімкніть супутниковий шар або привʼяжіть датчик. Відсутність попереджень у схемі не доводить здоровʼя посівів.',level:'info',basis:'Перевірка доступності даних'})
 return pins;
}
