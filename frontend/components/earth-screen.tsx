'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useQuery,useQueryClient,useMutation} from '@tanstack/react-query';
import {api} from '@/lib/api';
import Brand from './brand';
import type {Field,Dataset,Evaluation} from '@/lib/types';
const Explorer=dynamic(()=>import('./farm-earth-explorer'),{ssr:false});
export default function EarthScreen(){
 const searchParams=useSearchParams();const client=useQueryClient();const[id,setId]=useState('');useEffect(()=>{const id=searchParams.get('field');if(id)setId(id)},[searchParams.toString()]);
 const query=useQuery({queryKey:['fields'],queryFn:()=>api<Field[]>('/fields')});
 const fields=query.data||[];const selected=fields.find(f=>f.id===id)||fields[0];
 const observations=useQuery({queryKey:['observations',selected?.id],queryFn:()=>api<Dataset[]>(`/fields/${selected!.id}/observations`),enabled:!!selected});const dataset=observations.data?.[0];
 const evaluation=useQuery({queryKey:['earth-evaluation',selected?.id,dataset?.id],queryFn:()=>api<Evaluation>('/rotations/compare',{field_id:selected!.id,dataset_id:dataset!.id,weights:selected!.priorities}),enabled:!!selected&&!!dataset,retry:false});
 const download=useMutation({mutationFn:()=>{const year=new Date().getFullYear()-1;return api('/nasa/power',{field_id:selected!.id,start:`${year}-04-01`,end:`${year}-09-30`})},onSuccess:()=>client.invalidateQueries({queryKey:['observations',selected?.id]})});
 return <main className="earth-dedicated"><header><Link href="/dashboard"><Brand/></Link><nav><Link href="/dashboard">Господарство</Link><Link href="/fields">Мої поля</Link><Link href="/farm-lab">3D-ферма</Link><Link href="/missions">Місії</Link><Link href="/network">Господарства</Link><Link href="/sources">Джерела даних</Link></nav><span>EARTH OBSERVATION WORKSPACE</span></header>{selected?<Explorer fields={fields} selected={selected} onSelect={setId} lang="uk" dataset={dataset} evaluation={evaluation.data} onLoad={()=>download.mutate()} loading={download.isPending} onOpen={()=>location.assign('/fields')}/>:<section className="card empty"><h1>AGROSAS Earth</h1><p>{query.isError?query.error.message:query.isPending?'Завантаження господарства…':'Додайте поле, щоб розпочати орбітальний огляд.'}</p><Link className="button button-primary" href="/fields">Мої поля</Link></section>}{download.isError&&<p className="error" role="alert">{download.error.message}</p>}</main>
}
