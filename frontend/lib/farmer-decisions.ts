export type DecisionInputs={target_mm:number;water_m3:number;initial_moisture:number;root_depth_m:number;field_capacity:number;wilting_point:number;kc:number;reserve_pct:number;initial_soc:number;grid_price:number;outage_start:number;outage_end:number;outage:boolean};
export type DecisionHour={time:string;pv_kw:number;wind_kw?:number;load_kw:number;grid_kw:number;unserved_kw:number;water_m3:number;moisture_pct:number;soc_pct:number;rain_mm:number;temperature_c:number;reason:string};
export type DecisionPlan={conditional:boolean;design_revision:number;model_version:string;equipment?:Record<string,number>;optimized:{hours:DecisionHour[];totals:Record<string,number>};baseline:{hours:DecisionHour[];totals:Record<string,number>};warnings:string[];assumptions:string[];grid_saving_kwh:number;cost_difference_uah:number;requested_water_m3:number;unmet_water_m3:number;weather:{source:string;fetched_at:string;attribution_url:string};inputs:DecisionInputs};
export type IrrigationWindow={start:string;end:string;water:number;grid:number;generation:number;hours:number;unserved:number};
export const DECISION_DEFAULTS:DecisionInputs={target_mm:5,water_m3:150,initial_moisture:25,root_depth_m:.3,field_capacity:32,wilting_point:14,kc:1,reserve_pct:20,initial_soc:55,grid_price:6,outage_start:18,outage_end:22,outage:false};
/** Consecutive feasible pumping hours form one work window; dry or unserved hours never appear as successful watering. */
export function irrigationWindows(hours:DecisionHour[]):IrrigationWindow[]{
 const windows:IrrigationWindow[]=[];
 for(const h of hours){
  if(h.water_m3<=.001)continue;
  const last=windows.at(-1);const end=new Date(new Date(h.time).getTime()+3600000).toISOString();
  if(last&&new Date(h.time).getTime()===new Date(last.end).getTime()){
   last.end=end;last.water+=h.water_m3;last.grid+=h.grid_kw;last.generation+=h.pv_kw+(h.wind_kw||0);last.unserved+=h.unserved_kw;last.hours++;
  }else windows.push({start:h.time,end,water:h.water_m3,grid:h.grid_kw,generation:h.pv_kw+(h.wind_kw||0),hours:1,unserved:h.unserved_kw});
 }
 return windows;
}
/** A lower electricity figure is not a saving if the reference delivered substantially different water. */
export function comparableWater(plan:DecisionPlan){const a=plan.optimized.totals.water_m3,b=plan.baseline.totals.water_m3;return Math.abs(a-b)<=Math.max(1,Math.max(a,b)*.01)}
export function formatWindow(value:string){return new Date(value).toLocaleString('uk-UA',{timeZone:'UTC',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
