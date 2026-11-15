/** Geodesic helpers for field boundaries (WGS84 lon/lat). */
const R=6378137;
const rad=(d:number)=>d*Math.PI/180;
export function openRing(ring:number[][]){return ring.length>1&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1]?ring.slice(0,-1):ring}
/** Spherical polygon area (Chamberlain & Duquette 2007), hectares. */
export function polygonAreaHa(ring:number[][]){const pts=openRing(ring);if(pts.length<3)return 0;let sum=0;for(let i=0;i<pts.length;i++){const[l1,p1]=pts[i],[l2,p2]=pts[(i+1)%pts.length];sum+=rad(l2-l1)*(2+Math.sin(rad(p1))+Math.sin(rad(p2)))}return Math.abs(sum*R*R/2)/1e4}
export function perimeterKm(ring:number[][]){const pts=openRing(ring);if(pts.length<2)return 0;let d=0;for(let i=0;i<pts.length;i++){const[a,b]=[pts[i],pts[(i+1)%pts.length]];const dl=rad(b[0]-a[0]),dp=rad(b[1]-a[1]);const h=Math.sin(dp/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dl/2)**2;d+=2*R*Math.asin(Math.sqrt(h))}return d/1000}
export function centroid(ring:number[][]):[number,number]|null{const pts=openRing(ring);if(!pts.length)return null;return [pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length]}
/** Accepts "49.62, 34.46" (lat, lon) and returns [lon, lat]. */
export function parseLatLon(text:string):[number,number]|null{const m=text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);if(!m)return null;const lat=Number(m[1]),lon=Number(m[2]);return Math.abs(lat)<=90&&Math.abs(lon)<=180?[lon,lat]:null}
