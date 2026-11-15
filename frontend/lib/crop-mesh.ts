import * as THREE from 'three';
import {CROP_VISUALS} from './farm-design';
function blade(width:number,length:number){
 const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let i=0;i<=8;i++){const t=i/8,w=Math.sin(Math.PI*t)*width;for(const side of [-1,1]){vertices.push(side*w,length*t,Math.sin(t*Math.PI*.8)*length*.35);uv.push(side===1?1:0,t)}if(i<8){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
/** Species-shaped instanced plants. Stage is an editable scenario, not inferred BBCH. */
export function addCropPlants(scene:THREE.Scene,positions:[number,number][],cropId:string,stage:number,detailed=false){
 const crop=CROP_VISUALS[cropId]||CROP_VISUALS.wheat,group=new THREE.Group();group.name=`crop-${cropId}`;scene.add(group);if(stage<.12)return group;
 const mature=stage>.84,height=(crop.shape==='maize'?3:crop.shape==='sunflower'?2.5:1.35)*(.18+stage*.82);
 const green=new THREE.MeshStandardMaterial({color:mature&&crop.shape==='grain'?'#aa9254':'#527b30',roughness:.92,side:THREE.DoubleSide});
 const bloom=new THREE.MeshStandardMaterial({color:crop.shape==='grain'?(mature?'#d8bc73':'#9ba24d'):crop.color,roughness:.8,side:THREE.DoubleSide});
 const brown=new THREE.MeshStandardMaterial({color:'#423022',roughness:1});
 const wind={value:0};group.userData.windUniform=wind;
 for(const material of [green,bloom,brown]){material.onBeforeCompile=shader=>{shader.uniforms.farmWind=wind;shader.vertexShader='uniform float farmWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x += sin(farmWind + instanceMatrix[3].x*.43 + instanceMatrix[3].z*.19)*position.y*position.y*.014;\n#endif')};material.customProgramCacheKey=()=>`crop-sway-v1`}
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material,offset:[number,number,number],scale:[number,number,number]=[1,1,1],rotation:[number,number,number]=[0,0,0])=>{
  const mesh=new THREE.InstancedMesh(geometry,material,positions.length),dummy=new THREE.Object3D();
  positions.forEach(([x,z],i)=>{const jitter=.86+.22*(Math.sin(i*7.13)*.5+.5);dummy.position.set(x+offset[0]+Math.sin(i*2.3)*.06,offset[1]*jitter,z+offset[2]);dummy.rotation.set(...rotation);dummy.scale.set(scale[0]*jitter,scale[1]*jitter,scale[2]*jitter);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
 };
 add(new THREE.CylinderGeometry(.018,.03,1,6),green,[0,height/2,0],[1,height,1]);
 if(crop.shape==='grain'){
  for(const side of [-1,1])add(blade(.055,height*.6),green,[0,height*.25,0],[1,1,1],[0,side*1.6,-side*.45]);
  if(detailed)for(let i=0;i<5;i++)for(const side of [-1,1])add(new THREE.SphereGeometry(1,6,4),bloom,[side*.042,height+.025+i*.038,0],[.044,.065,.029],[0,0,side*.3]);
  if(!detailed)add(new THREE.CapsuleGeometry(.065,.22,1,5),bloom,[0,height+.12,0]);
  add(new THREE.CylinderGeometry(.009,.014,.3,4),bloom,[0,height+.14,0]);
 }else if(crop.shape==='maize'){
  for(let i=0;i<6;i++){const angle=i*2.4;add(blade(.13,height*.42),green,[0,height*(.2+i*.1),0],[1,1,1],[0,angle,-.72])}
  if(stage>.55){add(new THREE.CapsuleGeometry(.1,.3,3,8),bloom,[.12,height*.62,.06],[1,1,1],[0,0,-.25]);for(const side of [-1,1])add(new THREE.ConeGeometry(.07,.45,5),bloom,[side*.055,height+.12,0],[1,1,1],[0,0,side*.25])}
 }else if(crop.shape==='sunflower'){
  for(let i=0;i<5;i++)add(blade(.22,height*.25),green,[0,height*(.3+i*.1),0],[1,1,1],[0,i*2.4,-.6]);
  if(stage>.5){add(new THREE.CylinderGeometry(.27,.27,.07,20),brown,[0,height+.1,.02],[1,1,1],[Math.PI/2.7,0,0]);for(let i=0;i<12;i++){const a=i*Math.PI/6;add(new THREE.SphereGeometry(1,6,4),bloom,[Math.cos(a)*.32,height+.1+Math.sin(a)*.3,.05],[.08,.17,.035],[0,0,-a])}}
 }else{
  for(let i=0;i<8;i++){const angle=i*2.4;add(blade(.16,height*.48),green,[Math.cos(angle)*.1,height*.2,Math.sin(angle)*.1],[1,1,1],[0,angle,-.65])}
  if(stage>.6)for(let i=0;i<3;i++)add(new THREE.SphereGeometry(.055,6,4),bloom,[Math.cos(i*2.1)*.17,height*.85,Math.sin(i*2.1)*.17]);
 }
 return group;
}
