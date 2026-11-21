import { createClient } from '@supabase/supabase-js';
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export async function authenticate(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Cloud service is not configured.');
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error('Sign in to use this feature.');
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Your session expired. Sign in again.');
  return { user: data.user, client };
}
export function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Account deletion / AI limits are not configured.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
export async function smallBody(request: Request, limit: number) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Send a JSON request.');
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('Request is too large.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Missing request body.');
  let length = 0; const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error('Request is too large.'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
