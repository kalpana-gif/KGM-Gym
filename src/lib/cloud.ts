import { createClient, type Session } from '@supabase/supabase-js';
import type { Entity, LocalRecord } from '../types';
import { acknowledge, conflicts, importOwner, mergeRemote, pending, resolveServerConflict } from './db';
import { storedAccountOwner } from './account';

export const cloudConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
// Match Supabase's existing storage key so previously signed-in users stay in
// their account after this update.
const sessionKey = cloudConfigured ? `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token` : '';
export const savedAccountOwner = () => cloudConfigured ? storedAccountOwner(sessionKey) : null;
const cloudFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
});
export const supabase = cloudConfigured ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: cloudFetch },
  auth: { storageKey: sessionKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
const entities: Entity[] = ['profiles', 'meal_logs', 'daily_targets', 'weight_entries', 'custom_foods', 'recipes', 'meal_plans', 'workout_sessions', 'favorites'];
const flights = new Map<string, Promise<SyncResult>>();
export type SyncResult = { pending: number; conflicts: number; syncedAt: string };
export type CloudSyncState = {
  owner: string; status: 'device' | 'checking' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
  message: string; pending: number; lastSyncedAt?: string;
};
export class CloudSyncError extends Error {
  constructor(message: string, public kind: 'auth' | 'setup' | 'temporary' = 'temporary') { super(message); }
}
function serviceError(error: { code?: string; status?: number; message?: string }) {
  if (error.status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' ||
      /jwt.*expired|invalid.*jwt|refresh.token/i.test(error.message ?? ''))
    return new CloudSyncError('Your session could not be renewed. Open a new email sign-in link to reconnect.', 'auth');
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? ''))
    return new CloudSyncError('Supabase database setup is incomplete. Apply the database migrations, then retry sync.', 'setup');
  if (error.code === '42501' || error.status === 403 || /permission denied/i.test(error.message ?? ''))
    return new CloudSyncError('Supabase rejected database access. Check the database grants and owner policies, then retry sync.', 'setup');
  return new CloudSyncError('Supabase could not complete synchronization. Saved changes are waiting and will retry automatically.');
}
async function refreshedSession(owner: string, ensureCurrent: () => void): Promise<Session> {
  ensureCurrent();
  const { data: { session }, error } = await supabase!.auth.refreshSession();
  ensureCurrent();
  if (error) throw serviceError(error);
  if (!session || session.user.id !== owner.slice(5))
    throw new CloudSyncError('Sign in again to sync your account.', 'auth');
  return session;
}
function fromServer(owner: string, entity: Entity, r: { id: string; payload: unknown; version: number; deleted: boolean; updated_at: string }): LocalRecord {
  return { id: r.id, owner, entity, data: r.payload as LocalRecord['data'], version: r.version, deleted: r.deleted, modifiedAt: r.updated_at, syncedVersion: r.version };
}
// Every request in a cycle uses the verified account's token, even if another
// tab signs out or changes accounts while an earlier request is in flight.
async function synchronize(owner: string, guestOwner?: string, isCurrent = () => true, retryAuth = true): Promise<SyncResult> {
  if (!supabase || !owner.startsWith('user:')) throw new CloudSyncError('Connect a Supabase account to synchronize.', 'auth');
  if (!navigator.onLine) throw new CloudSyncError('You’re offline. Saved changes will sync when you reconnect.');
  const ensureCurrent = () => {
    if (!isCurrent()) throw new CloudSyncError('The connected account changed. Synchronization stopped.', 'auth');
  };
  ensureCurrent();
  const { data: { session: savedSession }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw serviceError(sessionError);
  if (!savedSession || savedSession.user.id !== owner.slice(5))
    throw new CloudSyncError('Sign in again to sync your account.', 'auth');
  let session = savedSession;
  let { data, error } = await supabase.auth.getUser(session.access_token);
  if (error && serviceError(error).kind === 'auth' && retryAuth) {
    session = await refreshedSession(owner, ensureCurrent);
    ({ data, error } = await supabase.auth.getUser(session.access_token));
    retryAuth = false;
  }
  if (error) throw serviceError(error);
  if (!data.user || data.user.id !== owner.slice(5))
    throw new CloudSyncError('Your account could not be verified. Sign in again before synchronizing.', 'auth');
  ensureCurrent();
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${session.access_token}` },
      fetch: cloudFetch,
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const pull = async () => {
    for (const entity of entities) {
      let start = 0;
      while (true) {
        ensureCurrent();
        const { data: rows, error: readError } = await client.from(entity).select('id,payload,version,deleted,updated_at').eq('user_id', data.user!.id).order('id').range(start, start + 499);
        if (readError) throw serviceError(readError);
        ensureCurrent();
        for (const row of rows ?? []) { ensureCurrent(); await mergeRemote(fromServer(owner, entity, row)); }
        if (!rows || rows.length < 500) break;
        start += 500;
      }
    }
  };
  try {
    // Load the account first so previously imported guest entries cannot be
    // recreated after clearing this device's cache.
    await pull();
    if (guestOwner?.startsWith('guest:')) {
      ensureCurrent();
      const key = `kgm-fit-guest-account:${guestOwner}`;
      const linked = localStorage.getItem(key);
      if (!linked || linked === owner) {
        // Bind once: this guest diary must not be sent to a different account.
        localStorage.setItem(key, owner);
        await importOwner(guestOwner, owner);
      }
    }
    // Drain edits made during an upload without requiring the queue count to
    // change. Limit each cycle so continuous editing does not starve refresh.
    for (let batch = 0; batch < 5; batch++) {
      const ops = await pending(owner);
      if (!ops.length) break;
      const blocked = new Set<string>();
      for (const op of ops) {
        if (blocked.has(op.recordId)) continue;
        ensureCurrent();
        const { data: result, error: rpcError } = await client.rpc('apply_change', {
          p_operation: op.id, p_entity: op.entity, p_id: op.recordId,
          p_base_version: op.baseVersion, p_payload: op.record.data, p_deleted: op.record.deleted,
        });
        if (rpcError) throw serviceError(rpcError);
        ensureCurrent();
        if (result?.status === 'conflict' && result.record) {
          await resolveServerConflict(op, fromServer(owner, op.entity, result.record));
          blocked.add(op.recordId);
        } else if (result?.status === 'applied') await acknowledge(op);
        else throw new CloudSyncError('Supabase returned an incomplete save confirmation. Your changes remain queued for retry.');
      }
    }
    await pull();
    ensureCurrent();
    const [ops, review] = await Promise.all([pending(owner), conflicts(owner)]);
    return { pending: ops.length, conflicts: review.length, syncedAt: new Date().toISOString() };
  } catch (error) {
    // A pinned token can expire during a long upload. Renew it and restart
    // once; operation IDs make already-applied writes safe to replay.
    if (error instanceof CloudSyncError && error.kind === 'auth' && retryAuth) {
      await refreshedSession(owner, ensureCurrent);
      return synchronize(owner, guestOwner, isCurrent, false);
    }
    throw error;
  }
}
export function sync(owner: string, guestOwner?: string, isCurrent?: () => boolean): Promise<SyncResult> {
  const existing = flights.get(owner);
  if (existing) return existing;
  // Share one upload between automatic/manual sync, and serialize tabs when
  // Web Locks are available. Operation IDs also make network retries safe.
  const execute = () => synchronize(owner, guestOwner, isCurrent);
  const promise = (navigator.locks
    ? navigator.locks.request(`kgm-fit-sync:${owner}`, execute)
    : execute()).finally(() => { if (flights.get(owner) === promise) flights.delete(owner); });
  flights.set(owner, promise);
  return promise;
}
export async function authenticatedRequest(path: string, body: unknown) {
  if (!supabase || !navigator.onLine) throw new Error('Sign in and connect to the internet to use this feature.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in before using online AI.');
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The online service is not connected on this server. You can still log meals manually.');
  const result = await response.json().catch(() => { throw new Error('The online service returned an unreadable response. Try again or log manually.'); });
  if (!response.ok) throw new Error(result.error || 'The online service is unavailable. Manual logging still works.');
  return result;
}
