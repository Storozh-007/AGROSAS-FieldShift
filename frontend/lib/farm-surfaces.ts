import * as THREE from 'three';
/** Repeatable surface detail for the editable model; not an aerial reconstruction. */
export function farmSurface(kind:'soil'|'grass'|'gravel'|'cut'){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d')!;let seed=18273;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const image=ctx.createImageData(512,512);const base=kind==='soil'?[101,74,44]:kind==='grass'?[77,94,49]:kind==='gravel'?[143,135,112]:[77,53,34];
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;const grain=(random()-.5)*42;const row=kind==='soil'?Math.sin(x*.28)*8:kind==='cut'?Math.sin(y*.052)*13:0;for(let c=0;c<3;c++)image.data[i+c]=base[c]+grain+row;image.data[i+3]=255}ctx.putImageData(image,0,0);
 if(kind==='grass'){for(let i=0;i<14000;i++){const x=random()*512,y=random()*512;ctx.strokeStyle=random()>.5?'#a1ad65':'#47552e';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1,y-2-random()*5);ctx.stroke()}}
 if(kind==='cut'){for(let i=0;i<110;i++){let x=random()*512;ctx.strokeStyle='#b0986b';ctx.lineWidth=.4+random();ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<180+random()*200;y+=12){x+=random()*12-6;ctx.lineTo(x,y)}ctx.stroke()}}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='cut'?5:7,kind==='cut'?1:6);texture.anisotropy=4;
 return new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:kind==='cut'?.18:.09,roughness:.95,color:'#ffffff'});
}
