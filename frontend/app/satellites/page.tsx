import {Suspense} from 'react';
import EarthScreen from '@/components/earth-screen';
export default function Page(){return <Suspense fallback={<div className="lab-loading">Завантажуємо карту…</div>}><EarthScreen/></Suspense>}
