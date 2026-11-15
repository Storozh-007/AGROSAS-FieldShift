import {describe,it,expect} from 'vitest';
import {irrigationWindows,comparableWater,type DecisionHour,type DecisionPlan} from '../lib/farmer-decisions';
const hour=(time:string,water:number,grid=0):DecisionHour=>({time,pv_kw:8,load_kw:6,grid_kw:grid,unserved_kw:0,water_m3:water,moisture_pct:22,soc_pct:55,rain_mm:0,temperature_c:22,reason:''});
describe('irrigation work windows',()=>{
 it('keeps a dry hour as a break, including over midnight',()=>{
  const windows=irrigationWindows([hour('2026-11-14T23:00:00Z',5,2),hour('2026-11-15T00:00:00Z',7,3),hour('2026-11-15T01:00:00Z',0),hour('2026-11-15T02:00:00Z',4,1)]);
  expect(windows).toHaveLength(2);expect(windows[0]).toMatchObject({start:'2026-11-14T23:00:00Z',end:'2026-11-15T01:00:00.000Z',water:12,grid:5,hours:2});expect(windows[1].water).toBe(4);
 });
 it('does not present no-water output as a successful irrigation window',()=>expect(irrigationWindows([hour('2026-11-14T12:00:00Z',0)])).toEqual([]));
 it('does not join separated records into a continuous work window',()=>expect(irrigationWindows([hour('2026-11-14T12:00:00Z',5),hour('2026-11-14T14:00:00Z',5)])).toHaveLength(2));
});
describe('fair energy comparison',()=>{
 const plan=(optimized:number,baseline:number)=>({optimized:{totals:{water_m3:optimized}},baseline:{totals:{water_m3:baseline}}}) as unknown as DecisionPlan;
 it('rejects an apparent electricity saving obtained by delivering less water',()=>expect(comparableWater(plan(30,150))).toBe(false));
 it('allows equivalent water within rounding tolerance',()=>expect(comparableWater(plan(149.8,150))).toBe(true));
});
