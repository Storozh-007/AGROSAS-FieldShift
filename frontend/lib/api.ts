export async function api<T>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const response = await fetch(`/api/backend${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((x: {msg: string}) => x.msg).join('; ') : `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}
