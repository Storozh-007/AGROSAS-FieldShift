'use client';
import {useEffect,useState} from 'react';
import {changeLang,currentLang,setUiLang,LANG_KEY,type UiLang} from '@/lib/i18n-runtime';

export default function LangSwitch(){
 const[lang,setLang]=useState<UiLang>('en');
 useEffect(()=>{const l=currentLang();setLang(l);setUiLang(l);const timers=[400,1200,3000,6000].map(ms=>setTimeout(()=>setUiLang(currentLang()),ms));const on=(e:Event)=>setLang((e as CustomEvent<UiLang>).detail);window.addEventListener(LANG_KEY,on);return()=>{window.removeEventListener(LANG_KEY,on);timers.forEach(clearTimeout)}},[]);
 return <div className="lang-switch notranslate" role="group" aria-label="Language / Мова">
  <button aria-pressed={lang==='en'} onClick={()=>changeLang('en')}>EN</button><button aria-pressed={lang==='uk'} onClick={()=>changeLang('uk')}>UA</button></div>;
}
