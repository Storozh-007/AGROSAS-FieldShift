'use client';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Dataset } from '@/lib/types';
import type { Copy } from '@/lib/i18n';
export default function ClimateChart({ dataset, t }: { dataset: Dataset; t: Copy }) {
return <div className="chart"><ResponsiveContainer width="100%" height={270}><ComposedChart data={dataset.monthly} margin={{ top: 16, right: 4, left: -22, bottom: 4 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8ece5"/><XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false}/><YAxis yAxisId="rain" tick={{ fontSize: 11 }} unit="" axisLine={false} tickLine={false}/><YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 11 }} unit="°" axisLine={false} tickLine={false}/><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e0e7db' }}/><Bar yAxisId="rain" dataKey="precipitation" name={t.chartRain} fill="#b4c9d6" radius={[4, 4, 0, 0]} maxBarSize={24}/><Line yAxisId="temp" dataKey="temperature" name={t.chartTemperature} stroke="#176b45" strokeWidth={2.5} dot={false} connectNulls={false}/></ComposedChart></ResponsiveContainer><div className="chart-legend"><span><i style={{background:'#176b45'}}/>{t.chartTemperature}</span><span><i style={{background:'#b4c9d6'}}/>{t.chartRain}</span></div></div>;
}
