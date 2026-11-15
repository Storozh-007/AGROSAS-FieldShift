import {Body,Equator,Horizon,Observer,GeoVector,Rotation_EQJ_EQD,RotateVector,SiderealTime,Illumination} from 'astronomy-engine';

export function celestial(date:Date){
 const angle=SiderealTime(date)*Math.PI/12;
 const body=(name:Body)=>{const v=RotateVector(Rotation_EQJ_EQD(date),GeoVector(name,date,true));const length=Math.hypot(v.x,v.y,v.z);const longitude=Math.atan2(v.y,v.x)-angle;return{longitude:((longitude*180/Math.PI+540)%360)-180,latitude:Math.asin(v.z/length)*180/Math.PI,distanceKm:length*149597870.7}};
 return{sun:body(Body.Sun),moon:body(Body.Moon),moonIllumination:Illumination(Body.Moon,date).phase_fraction};
}
export function sunAltitude(date:Date,latitude:number,longitude:number){const observer=new Observer(latitude,longitude,0);const equator=Equator(Body.Sun,date,observer,true,true);return Horizon(date,observer,equator.ra,equator.dec,'normal').altitude}
export type LabConfig={windKw?:number;windMs?:number;solarKw:number;batteryKwh:number;baseLoadKw:number;pumpKw:number;cloudPct:number;irrigation:boolean;grid:boolean;rainMmHour:number};
export const DEFAULT_LAB:LabConfig={windKw:0,windMs:5,solarKw:45,batteryKwh:100,baseLoadKw:8,pumpKw:12,cloudPct:20,irrigation:false,grid:true,rainMmHour:0};
export type LabState={soc:number;moisture:number;tankM3:number;generatedKwh:number;consumedKwh:number;gridKwh:number;unservedKwh:number;curtailedKwh:number;waterM3:number};
export const INITIAL_LAB:LabState={soc:55,moisture:25,tankM3:150,generatedKwh:0,consumedKwh:0,gridKwh:0,unservedKwh:0,curtailedKwh:0,waterM3:0};
export function sanitizeConfig(raw:unknown):LabConfig{const result={...DEFAULT_LAB};if(raw&&typeof raw==='object'){for(const key of ['windKw','windMs','solarKw','batteryKwh','baseLoadKw','pumpKw','cloudPct','rainMmHour'] as const){const value=(raw as Record<string,unknown>)[key];if(typeof value==='number'&&Number.isFinite(value))result[key]=Math.max(0,Math.min(key==='windMs'?60:key==='cloudPct'?100:key==='rainMmHour'?20:600000,value))}for(const key of ['irrigation','grid'] as const)if(typeof(raw as Record<string,unknown>)[key]==='boolean')result[key]=(raw as Record<string,boolean>)[key]}return result}
export function simulateStep(config:LabConfig,state:LabState,date:Date,lat:number,lon:number,areaHa:number,hours:number){
 const dt=Math.max(0,Math.min(hours,1));const altitude=sunAltitude(date,lat,lon);
 // Explicit educational policy model: clear-sky sine incidence × clouds × 0.86 system factor.
 const pvKw=config.solarKw*Math.max(0,Math.sin(altitude*Math.PI/180))*(1-.85*config.cloudPct/100)*.86;
 const nominalFlow=config.pumpKw*2.5;const duty=dt>0&&nominalFlow>0?Math.min(1,state.tankM3/(nominalFlow*dt)):state.tankM3>0?1:0;const requestedPump=config.irrigation&&state.tankM3>0?config.pumpKw*duty:0;const demandKw=config.baseLoadKw+requestedPump;
 const stored=state.soc/100*config.batteryKwh;let chargeKw=0,dischargeKw=0,gridKw=0,unservedKw=0,exportKw=0;
 const windMs=config.windMs??5;const windPowerKw=(config.windKw||0)*(windMs<2.5?0:windMs>=11?1:Math.pow((windMs-2.5)/(11-2.5),3));const net=pvKw+windPowerKw-demandKw;
 if(net>=0){chargeKw=dt>0?Math.min(net,config.batteryKwh*.5,(config.batteryKwh-stored)/(.95*dt)):0;exportKw=config.grid?Math.max(0,net-chargeKw):0}
 else{dischargeKw=dt>0?Math.min(-net,config.batteryKwh*.5,stored*.95/dt):0;const deficit=Math.max(0,-net-dischargeKw);gridKw=config.grid?deficit:0;unservedKw=config.grid?0:deficit}
 const suppliedFraction=demandKw>0?Math.max(0,1-unservedKw/demandKw):1;const pumpFlow=requestedPump*2.5*suppliedFraction;const curtailedKw=Math.max(0,pvKw+windPowerKw+dischargeKw+gridKw-(demandKw-unservedKw)-chargeKw-exportKw);
 const water=Math.min(state.tankM3,pumpFlow*dt);const irrigationMm=areaHa>0?water/(areaHa*10):0;
 const evapMmHour=Math.max(0,Math.sin(altitude*Math.PI/180))*.25;
 // Root zone 0.3 m: one volumetric percentage point represents 3 mm water.
 const next:LabState={soc:config.batteryKwh>0?Math.max(0,Math.min(100,(stored+(chargeKw*.95-dischargeKw/.95)*dt)/config.batteryKwh*100)):0,moisture:Math.max(5,Math.min(45,state.moisture+(irrigationMm+config.rainMmHour*dt-evapMmHour*dt)/3)),tankM3:Math.max(0,state.tankM3-water),generatedKwh:state.generatedKwh+(pvKw+windPowerKw)*dt,consumedKwh:state.consumedKwh+(demandKw-unservedKw)*dt,gridKwh:state.gridKwh+gridKw*dt,unservedKwh:state.unservedKwh+unservedKw*dt,curtailedKwh:state.curtailedKwh+curtailedKw*dt,waterM3:state.waterM3+water};
 return{state:next,pvKw,windPowerKw,demandKw,chargeKw,dischargeKw,gridKw,unservedKw,exportKw,curtailedKw,pumpFlow:dt>0?water/dt:0,altitude};
}
export type PlanNode={id:string;kind:'sensor'|'weather'|'pump';longitude:number;latitude:number};
export function planNodes(coordinates:number[][][]):PlanNode[]{const ring=coordinates[0];const inside=(x:number,y:number)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes};const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);const candidates:[number,number][]=[];for(let y=1;y<8;y++)for(let x=1;x<8;x++){const p:[number,number]=[Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*x/8,Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*y/8];if(inside(...p))candidates.push(p)}return(['sensor','weather','pump'] as const).flatMap((kind,i)=>{const p=candidates[Math.floor(candidates.length*(i+1)/4)];return p?[{id:`plan-${kind}`,kind,longitude:p[0],latitude:p[1]}]:[]})}
