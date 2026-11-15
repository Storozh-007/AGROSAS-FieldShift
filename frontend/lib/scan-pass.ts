/** Local educational overpass: straight ground track, footprint directly below spacecraft.
 * Scene units and playback seconds are compressed and never treated as an acquisition. */
export function demoScanPass(seconds:number,center:{x:number;z:number},duration=28){
 const progress=((seconds%duration)+duration)%duration/duration;
 const along={x:.92,z:.392};const distance=(progress-.5)*110;
 return {progress,along,x:center.x+along.x*distance,z:center.z+along.z*distance,height:30};
}
