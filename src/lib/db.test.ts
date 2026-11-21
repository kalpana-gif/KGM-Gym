import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { acknowledge, clearOwner, conflicts, dismissConflict, importOwner, mergeRemote, pending, records, remove, resolveServerConflict, save } from './db';
import type { Meal } from '../types';
import { foodById } from '../data/catalog';
import { total } from './calories';
const meal = (): Meal=>({ name:'Lunch',date:'2026-11-21',slot:'lunch',timestamp:'2026-11-21T05:00:00Z',timezone:'Asia/Colombo',items:[{id:crypto.randomUUID(),food:foodById('rice-white'),grams:150}] });
describe('durable local data and synchronization',()=>{
  it('persists edits and tombstones, updates totals, and supports undo',async()=>{
    const owner=`guest:${crypto.randomUUID()}`;const m=await save(owner,'meal_logs',meal());
    expect(total((await records<Meal>(owner,'meal_logs'))[0].data.items).kcal).toBe(195);
    await save(owner,'meal_logs',{...m.data,items:m.data.items.map(i=>({...i,grams:200}))},m.id);
    expect(total((await records<Meal>(owner,'meal_logs'))[0].data.items).kcal).toBe(260);
    await remove((await records(owner))[0]);expect(await records(owner)).toHaveLength(0);
    const deleted=(await records<Meal>(owner,'meal_logs',true))[0];
    await save(owner,'meal_logs',deleted.data,deleted.id);
    expect((await records(owner))[0].id).toBe(m.id);await clearOwner(owner);
  });
  it('isolates owners and imports guest records only once',async()=>{
    const guest=`guest:${crypto.randomUUID()}`,user=`user:${crypto.randomUUID()}`,other=`user:${crypto.randomUUID()}`;
    await save(guest,'meal_logs',meal());expect(await records(other)).toHaveLength(0);
    await importOwner(guest,user);await importOwner(guest,user);
    expect(await records(user)).toHaveLength(1);expect(await pending(user)).toHaveLength(1);
    await Promise.all([clearOwner(guest),clearOwner(user)]);
  });
  it('keeps queued versions in order and acknowledgement cannot replace a newer local edit',async()=>{
    const owner=`user:${crypto.randomUUID()}`;const first=await save(owner,'meal_logs',meal());
    await save(owner,'meal_logs',{...first.data,name:'Changed offline'},first.id);
    const ops=await pending(owner);expect(ops.map(o=>o.baseVersion)).toEqual([0,1]);
    await acknowledge(ops[0]);expect((await records<Meal>(owner))[0].data.name).toBe('Changed offline');
    expect((await records(owner))[0].syncedVersion).toBe(1);
    await acknowledge(ops[1]);expect(await pending(owner)).toHaveLength(0);await clearOwner(owner);
  });
  it('preserves local conflict recovery and rejects stale remote resurrection',async()=>{
    const owner=`user:${crypto.randomUUID()}`;const first=await save(owner,'meal_logs',meal());
    const op=(await pending(owner))[0];
    const remote={...first,data:{...first.data,name:'Remote version'},version:2,syncedVersion:2};
    await resolveServerConflict(op,remote);
    expect((await records<Meal>(owner))[0].data.name).toBe('Remote version');
    expect((await conflicts(owner))[0].record.data).toEqual(first.data);
    await remove((await records(owner))[0]);await mergeRemote(remote);
    expect(await records(owner)).toHaveLength(0);
    const ops=await pending(owner);await acknowledge(ops[0]);
    await mergeRemote({...remote,version:1});
    expect(await records(owner)).toHaveLength(0);
    await dismissConflict((await conflicts(owner))[0].id);await clearOwner(owner);
  });
  it('never queues base64 photo drafts for cloud synchronization',async()=>{
    const owner=`user:${crypto.randomUUID()}`;
    await save(owner,'photo_metadata',{ date:'2026-11-21',mime:'image/jpeg',base64:'PRIVATE-PHOTO',description:'meal',analyzed:false });
    expect(await pending(owner)).toHaveLength(0);expect(await records(owner)).toHaveLength(1);await clearOwner(owner);
  });
});
