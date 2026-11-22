import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { foodById } from '../data/catalog';
import { initialProfile, type Entity, type Payload } from '../types';
import { clearOwner, pending, records, remove, save } from './db';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), range: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient.mockImplementation(() => ({
    auth: { getSession: mocks.getSession, getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: mocks.range }) }) }) }),
  })),
}));
const owner = 'user:bb47df1f-e28c-437f-9b44-537b8d37e4a0';
const guest = 'guest:cloud-test';
let cloud: typeof import('./cloud');

beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-public-key');
  vi.stubGlobal('navigator', { onLine: true });
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: owner.slice(5) }, access_token: 'test-session' } }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: owner.slice(5) } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: 'applied' }, error: null });
  mocks.range.mockResolvedValue({ data: [], error: null });
  cloud = await import('./cloud');
});
afterEach(async () => {
  await Promise.all([clearOwner(owner), clearOwner(guest)]);
  vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('verified cloud synchronization', () => {
  it('imports every diary entity, syncs deletions and keeps photo drafts private', async () => {
    const food = foodById('rice-white');
    const items = [{ id: crypto.randomUUID(), food, grams: 150 }];
    const date = '2026-11-22';
    const diary: [Entity, Payload][] = [
      ['profiles', initialProfile],
      ['meal_logs', { name: 'Lunch', slot: 'lunch', date, timestamp: '2026-11-22T06:00:00Z', timezone: 'Asia/Colombo', items }],
      ['daily_targets', { date, kcal: 2000, maintenance: 2300, deficit: 13, proteinPercent: 25, fatPercent: 30 }],
      ['weight_entries', { date, kg: 99 }],
      ['custom_foods', { ...food, id: 'my-rice', name: 'My rice' }],
      ['recipes', { ...food, id: 'my-recipe', ingredients: [{ foodId: food.id, grams: 150 }], yieldGrams: 150 }],
      ['meal_plans', { date, name: 'Planned lunch', items }],
      ['workout_sessions', { date, name: 'Walking', minutes: 30, completed: true, exercises: [] }],
      ['favorites', { foodId: food.id }],
    ];
    for (const [entity, payload] of diary) await save(guest, entity, payload);
    await save(guest, 'photo_metadata', { date, mime: 'image/jpeg', base64: 'PRIVATE-PHOTO', description: 'Meal', analyzed: false });
    await cloud.sync(owner, guest);
    expect(mocks.rpc.mock.calls.map(([, change]) => change.p_entity).sort()).toEqual(diary.map(([entity]) => entity).sort());
    expect(await pending(owner)).toHaveLength(0);
    const uploaded = await records(owner);
    expect(uploaded).toHaveLength(diary.length);
    for (const record of uploaded) await remove(record);
    await cloud.sync(owner, guest);
    expect(mocks.rpc.mock.calls.slice(diary.length).every(([, change]) => change.p_deleted)).toBe(true);
    expect(await records(owner)).toHaveLength(0);
    expect(await pending(owner)).toHaveLength(0);
    expect(await records(guest, 'photo_metadata')).toHaveLength(1);
  });
  it('verifies the account before importing its guest diary and uploads all queued changes', async () => {
    await save(guest, 'profiles', initialProfile);
    const result = await cloud.sync(owner, guest);
    expect(mocks.getUser).toHaveBeenCalledWith('test-session');
    expect(mocks.rpc).toHaveBeenCalledWith('apply_change', expect.objectContaining({ p_entity: 'profiles', p_payload: initialProfile, p_base_version: 0 }));
    expect(await records(owner)).toHaveLength(1);
    expect(await pending(owner)).toHaveLength(0);
    expect(result.pending).toBe(0);
    await cloud.sync(owner, guest);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('keeps unacknowledged changes queued when the service returns errors or an invalid confirmation', async () => {
    await save(owner, 'profiles', initialProfile);
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'unexpected' }, error: null });
    await expect(cloud.sync(owner)).rejects.toThrow('incomplete save confirmation');
    expect(await pending(owner)).toHaveLength(1);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(cloud.sync(owner)).rejects.toMatchObject({ kind: 'setup' });
    expect(await pending(owner)).toHaveLength(1);
    await cloud.sync(owner);
    expect(await pending(owner)).toHaveLength(0);
  });
  it('refuses to import or upload when verification returns a different account', async () => {
    await save(guest, 'profiles', initialProfile);
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: crypto.randomUUID() } }, error: null });
    await expect(cloud.sync(owner, guest)).rejects.toMatchObject({ kind: 'auth' });
    expect(await records(owner)).toHaveLength(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('shares in-flight sync requests and drains an edit made while another version uploads', async () => {
    const first = await save(owner, 'profiles', initialProfile);
    mocks.rpc.mockImplementationOnce(async () => {
      await save(owner, 'profiles', { ...initialProfile, weight: 99 }, first.id);
      return { data: { status: 'applied' }, error: null };
    });
    const firstSync = cloud.sync(owner);
    expect(cloud.sync(owner)).toBe(firstSync);
    await firstSync;
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(await pending(owner)).toHaveLength(0);
    expect((await records(owner))[0].syncedVersion).toBe(2);
  });
  it('loads a previously imported backend record before considering the guest copy', async () => {
    const source = await save(guest, 'profiles', initialProfile);
    mocks.range.mockResolvedValueOnce({ data: [{
      id: source.id, payload: { ...initialProfile, weight: 98 }, version: 3, deleted: false, updated_at: new Date().toISOString(),
    }], error: null });
    await cloud.sync(owner, guest);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await records(owner))[0].data).toMatchObject({ weight: 98 });
  });
  it('does not send a guest diary already linked to another account', async () => {
    await save(guest, 'profiles', initialProfile);
    localStorage.setItem(`kgm-fit-guest-account:${guest}`, 'user:another-account');
    await cloud.sync(owner, guest);
    expect(await records(owner)).toHaveLength(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('leaves offline edits intact and identifies missing backend migrations', async () => {
    await save(owner, 'profiles', initialProfile);
    vi.stubGlobal('navigator', { onLine: false });
    await expect(cloud.sync(owner)).rejects.toThrow('offline');
    expect(await pending(owner)).toHaveLength(1);
    vi.stubGlobal('navigator', { onLine: true });
    mocks.range.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
    await expect(cloud.sync(owner)).rejects.toMatchObject({ kind: 'setup' });
    expect(await pending(owner)).toHaveLength(1);
  });
});
