import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Providers from '@/components/providers';
import FarmAssistant from '@/components/farm-assistant';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
export const metadata: Metadata = { title: 'AGROSAS OS', description: 'From Space to Soil. From Data to Decisions.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AGROSAS OS' }, icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#06111f' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="uk"><body suppressHydrationWarning><Providers>{children}<Suspense fallback={null}><FarmAssistant/></Suspense></Providers></body></html>; }
