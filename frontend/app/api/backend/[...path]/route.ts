import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
// Local demo proxy. Bind Next to loopback: this is deliberately not public SaaS authentication.
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const allowed = new Set(['farms', 'fields', 'nasa', 'rotations', 'scenarios', 'health', 'recommendations', 'devices', 'telemetry', 'safety','network','events','orbits','farm','assistant','sources']);
  if (!allowed.has(path[0]) || path.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return Response.json({ detail: 'Not found' }, { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin && new URL(origin).host !== request.headers.get('host')) return Response.json({ detail: 'Cross-origin writes are not allowed' }, { status: 403 });
    if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ detail: 'JSON required' }, { status: 415 });
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  if (body && body.length > 100_000) return Response.json({ detail: 'Request too large' }, { status: 413 });
  try {
    const upstream = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8000'}/api/${path.join('/')}${request.nextUrl.search}`, { method: request.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.APP_TOKEN || ''}` }, body, signal: AbortSignal.timeout(150_000), cache: 'no-store' });
    if (upstream.headers.get('content-type')?.includes('ndjson')) return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
    return new Response(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ detail: 'Backend unavailable. Start FastAPI and PostgreSQL, then retry.' }, { status: 503 }); }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
