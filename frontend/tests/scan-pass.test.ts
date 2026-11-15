import {describe,it,expect} from 'vitest';
import {demoScanPass} from '../lib/scan-pass';

describe('educational satellite overpass geometry',()=>{
 it('follows one straight ground track in a constant direction through a field',()=>{
  const centre={x:17,z:-9};const times=[3,6,9,12,15];const passes=times.map(time=>demoScanPass(time,centre));
  for(let i=1;i<passes.length;i++){
   const dx=passes[i].x-passes[i-1].x,dz=passes[i].z-passes[i-1].z;
   expect(dx).toBeGreaterThan(0);expect(dz).toBeGreaterThan(0);
   // A cross-product of consecutive velocity vectors is zero on a straight track.
   if(i>1){const px=passes[i-1].x-passes[i-2].x,pz=passes[i-1].z-passes[i-2].z;expect(dx*pz-dz*px).toBeCloseTo(0,9);expect(Math.hypot(dx,dz)).toBeCloseTo(Math.hypot(px,pz),9)}
   expect(passes[i].height).toBeGreaterThan(0);expect(passes[i].height).toBe(passes[0].height);
  }
  const middle=demoScanPass(14,centre);expect(middle.x).toBeCloseTo(centre.x,9);expect(middle.z).toBeCloseTo(centre.z,9);
 });
 it('replays deterministically and remains bounded across negative or wrapped times',()=>{
  const centre={x:5,z:8};const initial=demoScanPass(0,centre);
  for(const cycle of [-4,-1,0,1,8]){
   const pass=demoScanPass(cycle*28,centre);expect(pass.x).toBeCloseTo(initial.x,9);expect(pass.z).toBeCloseTo(initial.z,9);expect(pass.progress).toBeGreaterThanOrEqual(0);expect(pass.progress).toBeLessThan(1);
  }
  expect(demoScanPass(-1,centre)).toEqual(demoScanPass(27,centre));
 });
});
