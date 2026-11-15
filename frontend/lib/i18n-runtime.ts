'use client';
import dict from './en-dict.json';

/** Runtime English layer: translates rendered Ukrainian UI text (including backend text) by dictionary.
 * Numbers are matched as {n} placeholders, so "Тренд: +0.30 °C за 10 років" maps to one entry. */
export type UiLang='uk'|'en';
export const LANG_KEY='fieldshift-language';
const D=dict as Record<string,string>;
const CY=/[А-Яа-яІіЇїЄєҐґ]/;const NUM=/[-+−]?\d+(?:[.,]\d+)?/g;const EDGE=/^([\s·,;:—–\-/|()«»"']*)([\s\S]*?)([\s·,;:—–\-/|()«»"'.!?…]*)$/;
const cache=new Map<string,string|null>();
function lookup(core:string):string|null{
 if(D[core])return D[core];if(D[core+'.'])return D[core+'.'].replace(/\.$/,'');
 const nums=core.match(NUM);if(nums){const hit=D[core.replace(NUM,'{n}')];if(hit){let i=0;return hit.replace(/\{n\}/g,()=>nums[i++]??'')}}
 return null;
}
export function translate(text:string):string|null{
 if(!CY.test(text))return null;if(cache.has(text))return cache.get(text)!;
 let res:string|null=null;const lead=text.match(/^\s*/)![0],trail=text.match(/\s*$/)![0];const full=text.trim().replace(/\s+/g,' ');
 const exact=lookup(full);if(exact){cache.set(text,lead+exact+trail);return lead+exact+trail}
 const m=text.match(EDGE)!;const core=m[2].replace(/\s+/g,' ');const direct=lookup(core);
 if(direct)res=m[1]+direct+m[3];
 if(!res&&/\d/.test(core)){const segs=core.split(/([-+−]?\d+(?:[.,]\d+)?)/);let ok=true,any=false;const out=segs.map(g=>{if(!CY.test(g))return g;const t=lookup(g.trim())??translate(g);if(t){any=true;return g.match(/^\s*/)![0]+t.trim()+g.match(/\s*$/)![0]}ok=false;return g});if(ok&&any)res=m[1]+out.join('')+m[3]}
 if(!res)for(const sep of [' · ','\n',' → ','. ','; ',' — ',': ',' + ',', ',' / ',' – ',' (','. ']){if(!core.includes(sep))continue;const parts=core.split(sep);let any=false,all=true;const out=parts.map(p=>{if(!CY.test(p))return p;const t=translate(p);if(t){any=true;return t}all=false;return p});if(any&&(all||sep===' · '||sep==='\n'||sep===' → ')){res=m[1]+out.join(sep)+m[3];break}}
 if(!res)res=fragments(text);
 cache.set(text,res);return res;
}
let KEYS:string[]|null=null;
/** Last resort: replace known fragments inside a composed string (numbers as {n}); accept only if no Ukrainian is left. */
function fragments(text:string):string|null{
 if(!KEYS)KEYS=Object.keys(D).filter(k=>k.length>=4&&CY.test(k)).sort((a,b)=>b.length-a.length);
 const nums:string[]=[];let t=text.replace(NUM,x=>{nums.push(x);return '{n}'});let hit=false;
 for(const k of KEYS){if(t.length<k.length)continue;if(t.includes(k)){t=t.split(k).join(D[k]);hit=true;if(!CY.test(t))break}}
 if(!hit||CY.test(t))return null;let i=0;return t.replace(/\{n\}/g,()=>nums[i++]??'');
}
const orig=new WeakMap<Node,string>(),mine=new WeakMap<Node,string>();
const attrOrig=new WeakMap<Element,Record<string,string>>();const ATTRS=['placeholder','title','aria-label'];
let lang:UiLang='uk';let observer:MutationObserver|null=null;let pending=new Set<Node>();let raf=0;
function skip(n:Node){const p=n.parentElement;return !p||!!p.closest('script,style,textarea,code,[translate=no],.notranslate')}
function doText(n:Text){if(skip(n))return;const v=n.nodeValue||'';
 if(lang==='en'){if(mine.get(n)===v)return;orig.set(n,v);const t=translate(v);if(t&&t!==v){mine.set(n,t);n.nodeValue=t}else mine.delete(n)}
 else if(orig.has(n)&&mine.get(n)===v){n.nodeValue=orig.get(n)!;mine.delete(n)}}
function doEl(el:Element){if(el.closest('[translate=no],.notranslate'))return;let rec=attrOrig.get(el);
 for(const a of ATTRS){const v=el.getAttribute(a);if(v==null)continue;
  if(lang==='en'){if(rec?.['~'+a]===v)continue;const t=translate(v);if(t){rec=rec||{};rec[a]=v;rec['~'+a]=t;attrOrig.set(el,rec);el.setAttribute(a,t)}}
  else if(rec&&rec['~'+a]===v){el.setAttribute(a,rec[a]);delete rec['~'+a]}}}
function walk(root:Node){if(root.nodeType===3){doText(root as Text);return}if(root.nodeType!==1)return;const el=root as Element;doEl(el);
 const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n=tw.nextNode();while(n){if(n.nodeType===3)doText(n as Text);else doEl(n as Element);n=tw.nextNode()}}
function flush(){raf=0;const nodes=pending;pending=new Set();nodes.forEach(n=>{if(n.isConnected)walk(n)})}
export function setUiLang(next:UiLang){if(next==='uk'&&lang==='uk'&&observer)return;lang=next;document.documentElement.lang=next==='en'?'en':'uk';
 if(!observer){observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')pending.add(m.target);else if(m.type==='attributes')pending.add(m.target);else m.addedNodes.forEach(x=>pending.add(x))}if(!raf)raf=window.setTimeout(flush,30)});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS})}
 walk(document.body);}
export function currentLang():UiLang{try{return localStorage.getItem(LANG_KEY)==='uk'?'uk':'en'}catch{return 'en'}}
export function changeLang(next:UiLang){localStorage.setItem(LANG_KEY,next);setUiLang(next);window.dispatchEvent(new CustomEvent(LANG_KEY,{detail:next}))}
/** Translate an HTML string before inserting it (for tooltips rebuilt on every frame/mouse move). */
export function translateHtml(html:string):string{
 if(currentLang()!=='en'||!CY.test(html))return html;
 const t=document.createElement('template');t.innerHTML=html;const w=document.createTreeWalker(t.content,NodeFilter.SHOW_TEXT);let n=w.nextNode();
 while(n){const v=n.nodeValue||'';const r=translate(v);if(r)n.nodeValue=r;n=w.nextNode()}
 return t.innerHTML;
}
/** Same for plain text written straight into the DOM. */
export function translateText(text:string):string{return currentLang()==='en'?(translate(text)??text):text}
