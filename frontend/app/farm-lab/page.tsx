import {Suspense} from 'react';
import FarmLab from '@/components/farm-lab';
export default function Page(){return <Suspense fallback={<div className="lab-loading">Завантажуємо ферму…</div>}><FarmLab/></Suspense>}
