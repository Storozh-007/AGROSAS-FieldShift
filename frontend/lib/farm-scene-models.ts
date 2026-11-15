import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {BuildKind} from './build-catalog';
export function createFarmPart(kind:BuildKind):THREE.Group{
 const g=new THREE.Group();
 const mat=(color:string,metalness=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.35:.8});
 const wall=mat('#bacbc3'),metal=mat('#a1bcc6',.65),dark=mat('#27444f',.4),green=mat('#739348'),blue=mat('#254c81',.65),black=mat('#17232c');
 const box=(w:number,h:number,d:number,m:THREE.Material,x=0,y=h/2,z=0,p:THREE.Object3D=g)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};
 const cyl=(r:number,h:number,m:THREE.Material,x=0,y=h/2,z=0)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 const glow=new THREE.MeshStandardMaterial({color:'#c4f98a',emissive:'#5c9e39',emissiveIntensity:.5});
 if(kind==='wind'){cyl(.35,16,wall);const nacelle=box(1.6,1.3,3,wall,0,16,0);const rotor=new THREE.Group();rotor.position.set(0,16.5,1.6);rotor.userData.windRotor=true;for(let i=0;i<3;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.45,4.7,.15),wall);const pivot=new THREE.Group();blade.position.y=2.3;pivot.rotation.z=i*Math.PI*2/3;pivot.add(blade);rotor.add(pivot)}g.add(rotor)}
 if(kind==='solar'){for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=-6.6+c*4.4,z=-4.5+r*4;box(.15,2.2,.15,metal,x,1.1,z);const panel=box(4,.2,3,blue,x,2.5,z);panel.rotation.x=-.3;for(let k=-1;k<=1;k++)box(.035,.04,2.9,metal,x+k,2.7,z)}}
 if(kind==='barn'){box(18,7,19,wall);for(const side of [-1,1]){const roof=box(10,.4,21,dark,side*4.5,8.2,0);roof.rotation.z=-side*.3}box(6,5,.2,dark,0,2.5,9.6);for(const x of [-6,6])box(2,1.5,.2,new THREE.MeshStandardMaterial({color:'#e3c78b',emissive:'#9f7947',emissiveIntensity:.3}),x,4.7,9.7)}
 if(kind==='battery'){box(5,5,3,wall);box(5.4,.3,3.5,dark,0,5.15);for(let i=0;i<4;i++)box(.2,2.5,.08,glow,-1.5+i,2.7,1.55)}
 if(kind==='pump'){box(4,.35,3,metal,0,.17);const motor=cyl(1.1,2.3,blue,0,1.3);motor.rotation.z=Math.PI/2;box(.7,.7,3.5,metal,0,.6,0);box(.8,.8,1,dark,-1.5,1.5)}
 if(kind==='tank'){cyl(4.3,5.5,wall);cyl(4.15,.12,mat('#3e9cb0',.2),0,5.55);box(1,1,2,metal,0,.6,4.4)}
 if(kind==='sensor'){box(1.1,.6,.8,black,0,1);for(const x of [-.35,0,.35])box(.09,.85,.09,metal,x,.3);box(.18,.18,.1,glow,0,1.05,.45)}
 if(kind==='weather'){cyl(.15,8,metal);box(1.6,.25,1,wall,0,6);for(let j=0;j<5;j++)cyl(.55,.1,wall,-.8,5+j*.16);cyl(.6,.7,black,1,5.8);const rotor=new THREE.Group();rotor.position.y=8.3;rotor.userData.spin=true;for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const arm=box(2.5,.08,.08,metal,0,0,0,rotor);arm.rotation.y=a;const cup=new THREE.Mesh(new THREE.SphereGeometry(.35,10,6),dark);cup.position.set(Math.cos(a)*1.2,0,Math.sin(a)*1.2);rotor.add(cup)}g.add(rotor)}
 if(kind==='gateway'){cyl(.17,8,metal);const dish=box(3,.18,2.5,wall,0,9,0);dish.rotation.z=.45;box(.8,1.5,.6,dark,0,5);box(2.7,.15,2.2,blue,0,2)}
 if(kind==='pole'){cyl(.3,11,wall);box(4,.22,.3,metal,0,10.5);for(const x of [-1.5,0,1.5])cyl(.2,.6,dark,x,10.9);box(1,1.8,1,dark,0,3)}
 if(kind==='silo'){cyl(3,11,metal);const cap=new THREE.Mesh(new THREE.ConeGeometry(3.15,2,24),metal);cap.position.y=12;g.add(cap);for(let y=.4;y<11;y+=.35){const ring=new THREE.Mesh(new THREE.TorusGeometry(3.02,.05,4,24),dark);ring.rotation.x=Math.PI/2;ring.position.y=y;g.add(ring)}}
 if(kind==='tractor'||kind==='combine'){
  const combine=kind==='combine',paint=mat('#46752e',.25),yellow=mat('#dab744',.4),glass=new THREE.MeshPhysicalMaterial({color:'#91afba',transparent:true,opacity:.66,roughness:.08,metalness:.1});
  const wheel=(x:number,y:number,z:number,r:number)=>{
   const tire=new THREE.Mesh(new THREE.TorusGeometry(r*.76,r*.24,12,28),black);tire.rotation.y=Math.PI/2;tire.position.set(x,y,z);tire.castShadow=true;g.add(tire);
   const hub=cyl(r*.42,.72,yellow,x,y,z);hub.rotation.z=Math.PI/2;
   for(let i=0;i<18;i++){const a=i*Math.PI*2/18;const tread=box(.78,.16,r*.25,black,x,y+Math.cos(a)*r,z+Math.sin(a)*r);tread.rotation.x=a;tread.rotation.z=i%2?.15:-.15}
  };
  if(!combine){
   box(2.6,.65,5.3,dark,0,1.3);box(2.2,1.35,2.8,paint,0,2.1,-1.35);box(2.65,.3,2.5,paint,0,2.45,1.15);box(2.3,1.95,2.15,glass,0,3.4,1);box(2.65,.22,2.6,paint,0,4.48,1);
   box(.65,.8,.6,black,0,3.1,1.3);box(2.1,.6,.08,dark,0,2.25,-2.8);for(let i=0;i<8;i++)box(.025,.52,.06,metal,-.86+i*.25,2.25,-2.86);
   for(const x of [-1.6,1.6]){wheel(x,1.25,1.6,1.28);wheel(x,.87,-1.9,.9);const fender=box(.85,.15,2.5,paint,x,2.65,1.6);fender.rotation.z=x>0?-.04:.04}
   cyl(.075,2,black,.9,3,-1.1);box(.15,1.7,.15,metal,-1.15,3.45,1.95);box(.15,1.7,.15,metal,1.15,3.45,1.95);
   for(const x of [-.85,.85])box(.35,.22,.08,new THREE.MeshStandardMaterial({color:'#fff4cc',emissive:'#f9e6a3',emissiveIntensity:.3}),x,2.6,-2.82);
  }else{
   box(3.7,2.5,6.6,paint,0,3,1);box(3.9,.45,4.4,paint,0,4.5,1.5);box(3.1,1.9,2.5,glass,0,3.9,-2);box(3.6,.22,3,paint,0,4.95,-2);box(3.6,.6,2.5,yellow,0,2.3,-2.4);
   for(const x of [-2.1,2.1]){wheel(x,1.3,-1.2,1.3);wheel(x,.85,3.2,.85)}
   box(7.6,.6,2.5,paint,0,.75,-5);box(7.8,.12,.3,metal,0,.4,-6.2);
   const reel=new THREE.Group();reel.position.set(0,1.5,-5.4);reel.userData.harvestReel=true;
   const axle=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,7.4,10),metal);axle.rotation.z=Math.PI/2;reel.add(axle);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;box(7.4,.055,.055,dark,0,Math.cos(a)*.6,Math.sin(a)*.6,reel)}g.add(reel);
   const auger=box(.35,.35,5.8,paint,3.4,4.1,.5);auger.rotation.y=-.75;
   for(let y=1;y<4;y+=.45)box(.8,.08,.2,metal,-2.1,y,-2.3);
  }
  const beacon=cyl(.12,.18,new THREE.MeshStandardMaterial({color:'#ffa637',emissive:'#c75d13',emissiveIntensity:.5}),combine?1.6:1,combine?5.2:4.7,combine?-2:1.1);beacon.userData.beacon=true;
 }
 if(kind==='barn'){for(const x of [-7.5,7.5])for(let z=-9;z<=9;z+=.6)box(.06,6.7,.04,metal,x,3.5,z);for(let y=.7;y<7;y+=.35)box(17.8,.045,.06,metal,0,y,-9.55)}
 if(kind==='road')box(4,.12,12,mat('#778582'),0,.06);
 if(kind==='fence'){for(const x of [-3,3])box(.14,2,.14,wall,x,1);for(const y of [.6,1.5])box(6,.09,.08,metal,0,y)}
 if(kind==='tree'){cyl(.25,2,mat('#69513b'));const crown=new THREE.Mesh(new THREE.ConeGeometry(2.1,5,8),mat('#3b704b'));crown.position.y=4; crown.castShadow=true;g.add(crown)}
 if(kind==='irrigation'){for(const x of [-7,0,7]){box(.15,2.5,.15,metal,x,1.25);const sprinkler=cyl(.2,.3,blue,x,2.8);sprinkler.userData.spin=true}box(16,.18,.18,metal,0,2.5)}
 // Dispose materials created by this factory but unused by the selected part.
 const used=new Set<THREE.Material>();g.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>used.add(m))});for(const m of [wall,metal,dark,green,blue,black,glow])if(!used.has(m))m.dispose();
 // Batch static parts by material: detailed wheels/siding must not create hundreds of draw calls.
 g.updateMatrixWorld(true);const batches=new Map<THREE.Material,{parts:THREE.BufferGeometry[];nodes:THREE.Mesh[]}>();
 for(const child of [...g.children])if(child instanceof THREE.Mesh&&!Array.isArray(child.material)&&!child.userData.spin&&!child.userData.beacon){
  const entry=batches.get(child.material)||{parts:[],nodes:[]};const geometry=child.geometry.clone();geometry.applyMatrix4(child.matrix);entry.parts.push(geometry.index?geometry.toNonIndexed():geometry);entry.nodes.push(child);batches.set(child.material,entry);
 }
 for(const [material,batch] of batches){if(batch.nodes.length<2){batch.parts.forEach(p=>p.dispose());continue}const geometry=mergeGeometries(batch.parts,false);if(geometry){for(const node of batch.nodes){g.remove(node);node.geometry.dispose()}const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh)}batch.parts.forEach(p=>p.dispose())}
 return g;
}
export function disposeTree(root:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>{for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose()})}
