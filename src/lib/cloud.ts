import { createClient } from '@supabase/supabase-js';
import type { Entity, LocalRecord } from '../types';
import { acknowledge, mergeRemote, pending, resolveServerConflict } from './db';

export const cloudConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const supabase = cloudConfigured ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) : null;
const entities: Entity[] = ['profiles', 'meal_logs', 'daily_targets', 'weight_entries', 'custom_foods', 'recipes', 'meal_plans', 'workout_sessions', 'favorites'];
let running = false;
function fromServer(owner: string, entity: Entity, r: { id: string; payload: unknown; version: number; deleted: boolean; updated_at: string }): LocalRecord {
  return { id: r.id, owner, entity, data: r.payload as LocalRecord['data'], version: r.version, deleted: r.deleted, modifiedAt: r.updated_at, syncedVersion: r.version };
}
export async function sync(owner: string): Promise<string> {
  if (!supabase || !owner.startsWith('user:')) return 'Saved on this device';
  if (!navigator.onLine) return 'Offline · changes saved on this device';
  if (running) return 'Sync already in progress';
  running = true;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== owner.slice(5)) throw new Error('Sign in again to sync. Your local entries are safe.');
    const blocked = new Set<string>();
    for (const op of await pending(owner)) {
      if (blocked.has(op.recordId)) continue;
      const { data: result, error: rpcError } = await supabase.rpc('apply_change', {
        p_operation: op.id, p_entity: op.entity, p_id: op.recordId,
        p_base_version: op.baseVersion, p_payload: op.record.data, p_deleted: op.record.deleted,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (result.status === 'conflict') {
        await resolveServerConflict(op, fromServer(owner, op.entity, result.record));
        blocked.add(op.recordId);
      } else await acknowledge(op);
    }
    for (const entity of entities) {
      let start = 0;
      while (true) {
        const { data: rows, error: readError } = await supabase.from(entity).select('id,payload,version,deleted,updated_at').eq('user_id', data.user.id).order('id').range(start, start + 499);
        if (readError) throw new Error(readError.message);
        for (const row of rows ?? []) await mergeRemote(fromServer(owner, entity, row));
        if (!rows || rows.length < 500) break;
        start += 500;
      }
    }
    return 'All changes synced';
  } finally { running = false; }
}
export async function authenticatedRequest(path: string, body: unknown) {
  if (!supabase || !navigator.onLine) throw new Error('Sign in and connect to the internet to use this feature.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in before using online AI.');
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The online service is unavailable. Manual logging still works.');
  return result;
}
