import {Suspense} from 'react';
import MissionObservatory from '@/components/mission-observatory';
export default function Page(){return <Suspense fallback={<div className="lab-loading">Завантажуємо обсерваторію…</div>}><MissionObservatory/></Suspense>}
