'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';
import FieldDrawChat from './field-draw-chat';
import './farm-assistant.css';
import {currentLang} from '@/lib/i18n-runtime';

type Step={label:string;status:'start'|'done'|'error';error?:string};
type Draw={center:[number,number]|null;area_ha?:number|null;name:string;crops:string[];done?:boolean};
type Msg={role:'user'|'assistant';content:string;steps?:Step[];links?:string[];draw?:Draw;suggestions?:string[]};
const STORE='agrosas-assistant-v1';
const SUGGEST=['Що загрожує моєму полю?','Яку сівозміну обрати на 5 років?','Коли можна обприскувати цього тижня?','Створи поле 40 га біля Полтави','Покажи зони мого поля','Як SMAP допомагає фермеру?'];

/** Minimal, safe markdown: **bold**, lists, internal links. No HTML injection. */
function Rich({text,onLink}:{text:string;onLink:(href:string)=>void}){
 const lines=text.split('\n');
 const inline=(s:string,k:number)=>s.split(/(\*\*[^*]+\*\*|\/(?:farm-lab|dashboard|missions|network)[^\s)]*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<b key={`${k}-${i}`}>{part.slice(2,-2)}</b>:/^\/(farm-lab|dashboard|missions|network)/.test(part)?<button key={`${k}-${i}`} className="as-link" onClick={()=>onLink(part)}>{part}</button>:<span key={`${k}-${i}`}>{part}</span>);
 return <>{lines.filter((l,k)=>l.trim()||(k>0&&lines[k-1].trim())).map((l,k)=>/^\s*[-•*]\s+/.test(l)?<p key={k} className="as-li">{inline(l.replace(/^\s*[-•*]\s+/,''),k)}</p>:/^\s*\d+[.)]\s+/.test(l)?<p key={k} className="as-li num">{inline(l,k)}</p>:l.trim()?<p key={k}>{inline(l.replace(/^#+\s*/,''),k)}</p>:<br key={k}/>)}</>;
}

export default function FarmAssistant(){
 const[open,setOpen]=useState(false);const[msgs,setMsgs]=useState<Msg[]>([]);const[input,setInput]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const msgsRef=useRef<Msg[]>([]);msgsRef.current=msgs;const path=usePathname();const params=useSearchParams();const router=useRouter();const qc=useQueryClient();const end=useRef<HTMLDivElement>(null);const abort=useRef<AbortController|null>(null);
 const status=useQuery({queryKey:['assistant-status'],queryFn:()=>api<{ready:boolean;model:string;mode:'claude'|'local'}>('/assistant/status'),enabled:open,staleTime:60000,retry:false});
 useEffect(()=>{try{const s=sessionStorage.getItem(STORE);if(s)setMsgs(JSON.parse(s))}catch{}},[]);
 useEffect(()=>{try{sessionStorage.setItem(STORE,JSON.stringify(msgs.slice(-30)))}catch{};end.current?.scrollIntoView({behavior:'smooth',block:'end'})},[msgs]);
 const go=(href:string)=>{router.push(href);if(href.includes('#')){const tab=href.split('#')[1];setTimeout(()=>{location.hash=tab;window.dispatchEvent(new HashChangeEvent('hashchange'))},300)}};

 async function send(text:string){
  const q=text.trim();if(!q||busy)return;setError('');setInput('');
  const history:Msg[]=[...msgsRef.current,{role:'user',content:q}];setMsgs([...history,{role:'assistant',content:'',steps:[],links:[]}]);setBusy(true);
  const ctrl=new AbortController();abort.current=ctrl;
  try{
   const res=await fetch('/api/backend/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,body:JSON.stringify({messages:history.filter(m=>m.content).map(m=>({role:m.role,content:m.content.slice(0,8000)})).slice(-20),page:path+(location.search||''),field_id:params.get('field')||undefined})});
   if(!res.ok||!res.body){const e=await res.json().catch(()=>({}));throw new Error(e.detail||`Помилка ${res.status}`)}
   const reader=res.body.getReader();const dec=new TextDecoder();let buf='';
   const patch=(fn:(m:Msg)=>Msg)=>setMsgs(all=>{const c=[...all];c[c.length-1]=fn(c[c.length-1]);return c});
   for(;;){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line)continue;let ev:Record<string,unknown>;try{ev=JSON.parse(line)}catch{continue}
     if(ev.type==='text')patch(m=>({...m,content:m.content+String(ev.delta)}));
     else if(ev.type==='tool')patch(m=>{const steps=[...(m.steps||[])];const idx=steps.map(s=>s.label).lastIndexOf(String(ev.label));if(ev.status==='start'||idx<0)steps.push({label:String(ev.label),status:ev.status as Step['status']});else steps[idx]={label:String(ev.label),status:ev.status as Step['status'],error:ev.error as string|undefined};return{...m,steps}});
     else if(ev.type==='action'){if(ev.kind==='field_draw')patch(m=>({...m,draw:{center:(ev.center as [number,number]|null)||null,area_ha:ev.area_ha as number|null,name:String(ev.name||'Нове поле'),crops:(ev.crops as string[])||[]}}));else if(ev.href){patch(m=>({...m,links:[...(m.links||[]),String(ev.href)]}));go(String(ev.href))}const keys=(ev.refresh||ev.keys) as string[]|undefined;keys?.forEach(k=>qc.invalidateQueries({queryKey:[k]}))}
     else if(ev.type==='suggestions')patch(m=>({...m,suggestions:ev.items as string[]}));
     else if(ev.type==='error')setError(String(ev.message));
   }}
  }catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message)}
  finally{setBusy(false);abort.current=null}
 }

 return <>
  <button className={`as-fab ${open?'open':''}`} onClick={()=>setOpen(!open)} aria-label={open?'Закрити асистента':'Відкрити асистента'} aria-expanded={open}>
   {open?<span className="as-x">×</span>:<><span className="as-orb"><i/></span><span className="as-fab-text">Агроном AI</span></>}
  </button>
  {open&&<section className="as-panel" role="dialog" aria-label="Агроном-асистент">
   <header><div className="as-avatar"><i/></div><div><b>Агроном AI</b><small>{busy?'працює з даними поля…':'бачить ваші поля, клімат NASA і модель сівозміни'}{status.data&&<em className="as-mode">{status.data.mode==='claude'?'Claude':'вбудований агент'}</em>}</small></div>{msgs.length>0&&<button className="as-clear" onClick={()=>{abort.current?.abort();setMsgs([]);setError('')}}>Нова розмова</button>}</header>
   <div className="as-body">
    {!msgs.length&&<div className="as-hello"><h4>Привіт! Я знаю ваші поля.</h4><p>Питайте про загрози, сівозміну, погоду для робіт, зони поля або супутники. Можу створити нове поле й відкрити потрібну сторінку.</p><div className="as-suggest">{SUGGEST.map(s=><button key={s} onClick={()=>send(s)} disabled={busy}>{s}</button>)}</div></div>}
    {msgs.map((m,i)=><div key={i} className={`as-msg ${m.role}`}>
     {m.steps&&m.steps.length>0&&<div className="as-steps">{m.steps.map((s,k)=><span key={k} className={s.status} title={s.error}><i/>{s.label}{s.status==='error'?' — помилка':''}</span>)}</div>}
     {m.content?<div className="as-text"><Rich text={busy&&i===msgs.length-1&&currentLang()==='en'?m.content.slice(0,m.content.lastIndexOf('\n')+1):m.content} onLink={go}/></div>:m.role==='assistant'&&busy&&i===msgs.length-1?<div className="as-typing"><i/><i/><i/></div>:null}
     {m.draw&&!m.draw.done&&<FieldDrawChat draw={m.draw} onCreated={(f)=>{const next=msgsRef.current.map((x,k)=>k===i?{...x,draw:{...x.draw!,done:true},content:x.content+`\n\n✓ Поле **${f.name}** створено: ${f.area_ha.toFixed(1)} га.`}:x);msgsRef.current=next;setMsgs(next);qc.invalidateQueries({queryKey:['fields']});go(`/farm-lab?field=${f.id}`);setTimeout(()=>send(`Паспорт поля ${f.name}`),900)}}/>}
     {m.suggestions&&m.suggestions.length>0&&i===msgs.length-1&&!busy&&<div className="as-next">{m.suggestions.map(x=><button key={x} onClick={()=>send(x)}>{x}</button>)}</div>}
     {m.links&&m.links.length>0&&<div className="as-links">{[...new Set(m.links)].map(l=><button key={l} onClick={()=>go(l)}>Відкрити {l.split('?')[0].replace('/','')} →</button>)}</div>}
    </div>)}
    {error&&<p className="as-error" role="alert">{error}</p>}
    <div ref={end}/>
   </div>
   <form className="as-input" onSubmit={e=>{e.preventDefault();send(input)}}><textarea rows={1} value={input} placeholder="Запитайте про поле…" onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(input)}}} />{busy?<button type="button" onClick={()=>abort.current?.abort()} aria-label="Зупинити">■</button>:<button type="submit" disabled={!input.trim()} aria-label="Надіслати">↑</button>}</form>
   <p className="as-foot">{status.data?.mode==='claude'?'Claude':'Вбудований агент'} · відповіді спираються на дані платформи; рішення — за вами й агрономом.</p>
  </section>}
 </>;
}
