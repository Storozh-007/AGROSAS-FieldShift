import {describe,expect,it} from 'vitest';
import {polygonAreaHa,parseLatLon,perimeterKm} from '../lib/geo';
describe('geo',()=>{
 it('computes ~1 km² square near equator as ~100 ha',()=>{const d=0.008983;expect(polygonAreaHa([[0,0],[d,0],[d,d],[0,d],[0,0]])).toBeCloseTo(100,0)});
 it('shrinks with latitude like real geometry',()=>{const d=0.01;const eq=polygonAreaHa([[0,0],[d,0],[d,d],[0,d]]),north=polygonAreaHa([[0,60],[d,60],[d,60+d],[0,60+d]]);expect(north/eq).toBeCloseTo(0.5,1)});
 it('returns 0 for fewer than 3 vertices',()=>expect(polygonAreaHa([[0,0],[1,1]])).toBe(0));
 it('parses lat,lon',()=>{expect(parseLatLon('49.62, 34.46')).toEqual([34.46,49.62]);expect(parseLatLon('Poltava')).toBeNull()});
 it('measures perimeter',()=>expect(perimeterKm([[0,0],[0.008983,0],[0.008983,0.008983],[0,0.008983]])).toBeCloseTo(4,1));
});
