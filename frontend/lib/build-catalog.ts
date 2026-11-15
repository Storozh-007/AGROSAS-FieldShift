import {MODULES,type ModuleId} from './farm-modules';
export type BuildKind=ModuleId|'tank'|'silo'|'tractor'|'combine'|'road'|'fence'|'tree'|'pole'|'irrigation'|'wind';
export type LinkKind='power'|'water'|'data';
export type BuildSpec={id:BuildKind;name:string;size:[number,number];height:number;ports:LinkKind[];category:string};
export const BUILD_CATALOG:BuildSpec[]=[
 {id:'wind',name:'Вітряк Bergey EXCEL 15',size:[10,10],height:20,ports:['power'],category:'Енергія'},
 {id:'solar',name:'Сонячна станція',size:[18,14],height:3,ports:['power'],category:'Енергія'},
 {id:'battery',name:'Накопичувач',size:[5,4],height:5,ports:['power'],category:'Енергія'},
 {id:'pole',name:'Ввід мережі / опора',size:[3,3],height:12,ports:['power'],category:'Енергія'},
 {id:'pump',name:'Насос',size:[4,3],height:2,ports:['power','water'],category:'Вода'},
 {id:'tank',name:'Резервуар',size:[9,9],height:6,ports:['water'],category:'Вода'},
 {id:'irrigation',name:'Поливна установка',size:[16,3],height:3,ports:['water'],category:'Вода'},
 {id:'sensor',name:'Датчик ґрунту',size:[1,1],height:1.5,ports:['data'],category:'Дані'},
 {id:'weather',name:'Метеостанція',size:[3,3],height:9,ports:['data'],category:'Дані'},
 {id:'gateway',name:'LoRa / Starlink',size:[4,4],height:10,ports:['power','data'],category:'Дані'},
 {id:'barn',name:'Господарські будівлі',size:[20,22],height:10,ports:['power'],category:'Ферма'},
 {id:'silo',name:'Силос',size:[7,7],height:13,ports:[],category:'Ферма'},
 {id:'combine',name:'Зернозбиральний комбайн',size:[8,12],height:6,ports:[],category:'Ферма'},
 {id:'tractor',name:'Трактор',size:[5,7],height:5,ports:[],category:'Ферма'},
 {id:'road',name:'Секція дороги',size:[4,12],height:.15,ports:[],category:'Територія'},
 {id:'fence',name:'Секція огорожі',size:[6,1],height:2,ports:[],category:'Територія'},
 {id:'tree',name:'Дерево',size:[4,4],height:6,ports:[],category:'Територія'},
];
export const buildSpec=(kind:BuildKind)=>BUILD_CATALOG.find(s=>s.id===kind)!;
export function moduleFor(kind:BuildKind):ModuleId{return MODULES.some(m=>m.id===kind)?kind as ModuleId:kind==='tank'||kind==='irrigation'?'pump':'barn'}

/** Real-world sizing from rated capacity, relative to the reference model geometry.
 * Solar ≈ 6.5 m² of ground per kWp (rows with spacing); tank diameter from volume at fixed height;
 * battery steps from cabinet to container; wind turbine scales with rotor area. */
const REF:Partial<Record<BuildKind,number>>={solar:45,tank:150,battery:100,pump:12,wind:15.6};
export function capacityScale(kind:BuildKind,capacity:number):[number,number,number]{
 const ref=REF[kind];if(!ref||!(capacity>0))return[1,1,1];const r=capacity/ref;const c=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
 if(kind==='solar'||kind==='tank'){const k=c(Math.sqrt(r),.35,4);return[k,1,k]}
 if(kind==='battery'){const k=c(Math.cbrt(r),.5,3);return[k,c(Math.sqrt(k),.7,1.6),k]}
 const k=c(Math.sqrt(r),.5,2.2);return[k,k,k];
}
export function footprint(kind:BuildKind,capacity:number,scale=1):{w:number;d:number;h:number;area:number}{
 const s=buildSpec(kind);const[cx,cy,cz]=capacityScale(kind,capacity);const w=+(s.size[0]*scale*cx).toFixed(1),d=+(s.size[1]*scale*cz).toFixed(1);return{w,d,h:+(s.height*scale*cy).toFixed(1),area:Math.round(w*d)};
}
export function realityNote(kind:BuildKind,capacity:number):string{
 switch(kind){
  case 'solar':return `${capacity} кВт ≈ ${Math.round(capacity*5)} м² панелей (${Math.round(capacity/.45)} модулів по 450 Вт), ~${Math.round(capacity*1.1)} МВт·год/рік в Україні`;
  case 'tank':{const d=2*Math.sqrt(capacity/(Math.PI*6));return `${capacity} м³ ≈ ${(capacity/50).toFixed(1)} ч. поливу 1 мм на 5 га · діаметр ${d.toFixed(1)} м при висоті 6 м`}
  case 'battery':return capacity>400?`${capacity} кВт·год — контейнер 20 футів (6.1 × 2.4 м)`:`${capacity} кВт·год — ${Math.ceil(capacity/15)} шаф LFP по 15 кВт·год`;
  case 'wind':return `Bergey Excel 15: ротор 9.6 м, щогла 30 м, старт від 2.5 м/с, ${Math.round(capacity*2.2)} МВт·год/рік при 5 м/с`;
  case 'pump':return `${capacity} кВт ≈ ${Math.round(capacity*2.5)} м³/год при напорі ~40 м`;
  case 'combine':return 'Клас John Deere S7: 9 × 3.5 м без жатки, жатка 10.7 м';
  case 'tractor':return 'Клас 150–200 к.с.: 5 × 2.5 м';
  case 'irrigation':return 'Барабанна установка: шланг до 400 м, захоплення ~50 м';
  case 'sensor':return 'Зонд вологості на 3 глибини: 10, 30, 60 см';
  case 'weather':return 'Щогла 2–10 м: T, RH, вітер, радіація, опади';
  case 'gateway':return 'LoRaWAN до 5–10 км у полі; Starlink Mini 25–40 Вт';
  default:return '';
 }
}
