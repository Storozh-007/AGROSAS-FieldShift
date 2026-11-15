import {describe,it,expect} from 'vitest';
import {simulateDesignStep} from '../lib/farm-network';
import {defaultDesign,normalizeDesign,clampPlacement,compatible} from '../lib/farm-design';
import {DEFAULT_LAB,INITIAL_LAB} from '../lib/farm-simulation';
import type {Field} from '../lib/types';
const field={id:'f',crop_history:['wheat']} as Field;const design=normalizeDesign(defaultDesign(field));const night=new Date('2026-06-21T00:00:00Z');
describe('modular topology',()=>{
 it('cannot use another island battery or grid to power a disconnected pump',()=>{const d={...design,connections:design.connections!.filter(e=>!e.id.includes('initial-pump'))};const r=simulateDesignStep(d,{...DEFAULT_LAB,irrigation:true},INITIAL_LAB,night,49.62,34.46,60,.1);expect(r.unservedKw).toBeCloseTo(12);expect(r.pumpFlow).toBe(0)});
 it('restores supply through an actual cable',()=>{const r=simulateDesignStep(design,{...DEFAULT_LAB,irrigation:true},INITIAL_LAB,night,49.62,34.46,60,.1);expect(r.unservedKw).toBe(0);expect(r.pumpFlow).toBeGreaterThan(0)});
 it('keeps rotated and enlarged parts inside the farm board',()=>{const p=clampPlacement('barn',100,100,45,2,1);const half=(20+22)*Math.SQRT1_2;expect(p.x+half).toBeLessThanOrEqual(55.01);expect(p.z+half).toBeLessThanOrEqual(39.01)});
 it('prevents incompatible ports and self wiring',()=>{const a=design.objects.find(o=>o.kind==='solar')!,b=design.objects.find(o=>o.kind==='sensor')!;expect(compatible(a,a,'power')).toBe(false);expect(compatible(a,b,'water')).toBe(false)});
});
