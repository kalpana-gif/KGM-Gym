import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Conflict, Entity, LocalRecord, Operation, Payload } from '../types';

interface Schema extends DBSchema {
  records: { key: string; value: LocalRecord; indexes: { owner: string } };
  operations: { key: string; value: Operation; indexes: { owner: string } };
  conflicts: { key: string; value: Conflict; indexes: { owner: string } };
}
let connection: Promise<IDBPDatabase<Schema>> | undefined;
const dbPromise = () => connection ??= openDB<Schema>('lankafit-v1', 1, {
  upgrade(db) {
    db.createObjectStore('records').createIndex('owner', 'owner');
    db.createObjectStore('operations', { keyPath: 'id' }).createIndex('owner', 'owner');
    db.createObjectStore('conflicts', { keyPath: 'id' }).createIndex('owner', 'owner');
  },
  terminated() { connection = undefined; },
});
export const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('lankafit-data')); };
export async function records<T = Payload>(owner: string, entity?: Entity, includeDeleted = false): Promise<LocalRecord<T>[]> {
  const db = await dbPromise();
  const rows = await db.getAllFromIndex('records', 'owner', owner);
  return rows.filter(r => (!entity || r.entity === entity) && (includeDeleted || !r.deleted)) as LocalRecord<T>[];
}
export async function save<T extends Payload>(owner: string, entity: Entity, data: T, id: string = crypto.randomUUID(), deleted = false) {
  const db = await dbPromise();
  const tx = db.transaction(['records', 'operations'], 'readwrite');
  const key = `${owner}:${id}`;
  const old = await tx.objectStore('records').get(key);
  const record: LocalRecord<T> = { id, owner, entity, data, deleted, version: (old?.version ?? 0) + 1, syncedVersion: old?.syncedVersion ?? 0, modifiedAt: new Date().toISOString() };
  await tx.objectStore('records').put(record as LocalRecord, key);
  // Photos stay local until a separate, explicit storage upload. Never sync their base64 data.
  if (owner.startsWith('user:') && entity !== 'photo_metadata') {
    await tx.objectStore('operations').put({ id: crypto.randomUUID(), owner, recordId: id, entity, baseVersion: old?.version ?? 0, record: record as LocalRecord, createdAt: record.modifiedAt });
  }
  await tx.done; changed(); return record;
}
export async function remove(record: LocalRecord) {
  if (record.entity === 'photo_metadata') {
    const db = await dbPromise(); await db.delete('records', `${record.owner}:${record.id}`); changed(); return;
  }
  return save(record.owner, record.entity, record.data, record.id, true);
}
export async function pending(owner: string) {
  const db = await dbPromise(); return (await db.getAllFromIndex('operations', 'owner', owner)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.record.version - b.record.version);
}
export async function acknowledge(op: Operation) {
  const db = await dbPromise(); const tx = db.transaction(['records', 'operations'], 'readwrite');
  await tx.objectStore('operations').delete(op.id);
  const key = `${op.owner}:${op.recordId}`; const local = await tx.objectStore('records').get(key);
  if (local) await tx.objectStore('records').put({ ...local, syncedVersion: Math.max(local.syncedVersion, op.record.version) }, key);
  await tx.done; changed();
}
export async function mergeRemote(remote: LocalRecord) {
  const db = await dbPromise(); const tx = db.transaction(['records', 'operations', 'conflicts'], 'readwrite');
  const key = `${remote.owner}:${remote.id}`; const local = await tx.objectStore('records').get(key);
  const ops = (await tx.objectStore('operations').index('owner').getAll(remote.owner)).filter(o => o.recordId === remote.id);
  if (ops.length) { await tx.done; return; }
  const updated = !local || remote.version > local.version || (remote.version === local.version && local.syncedVersion < remote.version);
  if (updated) await tx.objectStore('records').put({ ...remote, syncedVersion: remote.version }, key);
  await tx.done; if (updated) changed();
}
export async function resolveServerConflict(op: Operation, remote: LocalRecord) {
  const db = await dbPromise(); const tx = db.transaction(['records', 'operations', 'conflicts'], 'readwrite');
  const key = `${op.owner}:${op.recordId}`; const latest = await tx.objectStore('records').get(key);
  await tx.objectStore('conflicts').put({ id: crypto.randomUUID(), owner: op.owner, record: latest ?? op.record, remote, createdAt: new Date().toISOString() });
  const ops = await tx.objectStore('operations').index('owner').getAll(op.owner);
  for (const row of ops.filter(o => o.recordId === op.recordId)) await tx.objectStore('operations').delete(row.id);
  await tx.objectStore('records').put({ ...remote, syncedVersion: remote.version }, key);
  await tx.done; changed();
}
export async function conflicts(owner: string) { return (await dbPromise()).getAllFromIndex('conflicts', 'owner', owner); }
export async function dismissConflict(id: string) { const db = await dbPromise(); await db.delete('conflicts', id); changed(); }
export async function clearOwner(owner: string) {
  const db = await dbPromise(); const tx = db.transaction(['records', 'operations', 'conflicts'], 'readwrite');
  for (const r of await tx.objectStore('records').index('owner').getAll(owner)) await tx.objectStore('records').delete(`${owner}:${r.id}`);
  for (const o of await tx.objectStore('operations').index('owner').getAll(owner)) await tx.objectStore('operations').delete(o.id);
  for (const c of await tx.objectStore('conflicts').index('owner').getAll(owner)) await tx.objectStore('conflicts').delete(c.id);
  await tx.done; changed();
}
export async function importOwner(from: string, to: string) {
  if (from === to || !from.startsWith('guest:') || !to.startsWith('user:')) return;
  const db = await dbPromise();
  const tx = db.transaction(['records', 'operations'], 'readwrite');
  const rows = await tx.objectStore('records').index('owner').getAll(from);
  const existing = new Set((await tx.objectStore('records').index('owner').getAll(to)).map(r => r.id));
  let imported = false;
  for (const row of rows) {
    if (row.deleted || row.entity === 'photo_metadata' || existing.has(row.id)) continue;
    const record: LocalRecord = { ...row, owner: to, version: 1, syncedVersion: 0, modifiedAt: new Date().toISOString() };
    await tx.objectStore('records').put(record, `${to}:${row.id}`);
    await tx.objectStore('operations').put({
      id: crypto.randomUUID(), owner: to, recordId: row.id, entity: row.entity,
      baseVersion: 0, record, createdAt: record.modifiedAt,
    });
    imported = true;
  }
  await tx.done; if (imported) changed();
}
