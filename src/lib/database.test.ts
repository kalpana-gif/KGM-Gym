import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { initialProfile } from '../types';
import { foodById } from '../data/catalog';

const db=new PGlite();
const alice=crypto.randomUUID(),bob=crypto.randomUUID(),recordId=crypto.randomUUID();
const operation=crypto.randomUUID();
const meal={name:'Rice',slot:'lunch',date:'2026-11-21',timezone:'Asia/Colombo',timestamp:'2026-11-21T05:00:00Z',
  items:[{id:crypto.randomUUID(),food:foodById('rice-white'),grams:150}]};
async function asUser<T>(id:string,action:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>){
  return db.transaction(async tx=>{
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
    return action(tx);
  });
}
async function apply(id:string,op:string,base:number,payload:unknown=meal,deleted=false,entity='meal_logs',rid=recordId){
  return asUser(id,async tx=>(await tx.query<{result:{status:string;record?:{version:number}}}>(
    'select public.apply_change($1,$2,$3,$4,$5::jsonb,$6) as result',[op,entity,rid,base,JSON.stringify(payload),deleted])).rows[0].result);
}
beforeAll(async()=>{
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  await db.query('insert into auth.users(id) values($1),($2)',[alice,bob]);
  await db.exec(await readFile('supabase/migrations/001_lankafit.sql','utf8'));
},30000);
afterAll(()=>db.close());
describe('PostgreSQL migrations and access rules',()=>{
  it('applies one operation exactly once, even if a request is retried',async()=>{
    expect((await apply(alice,operation,0)).status).toBe('applied');
    expect((await apply(alice,operation,0)).status).toBe('applied');
    const rows=await asUser(alice,tx=>tx.query<{version:number}>('select version from meal_logs'));
    expect(rows.rows).toEqual([{version:1}]);
  });
  it('does not expose another user’s rows or children, including through the sync function',async()=>{
    const rows=await asUser(bob,tx=>tx.query('select * from meal_logs'));expect(rows.rows).toHaveLength(0);
    const items=await asUser(bob,tx=>tx.query('select * from meal_log_items'));expect(items.rows).toHaveLength(0);
    await expect(apply(bob,crypto.randomUUID(),1)).rejects.toThrow(/Not authorized/);
    await expect(asUser(bob,tx=>tx.query('insert into meal_log_items(id,meal_id,user_id,grams,food_snapshot) values($1,$2,$3,100,$4::jsonb)',[crypto.randomUUID(),recordId,bob,JSON.stringify(foodById('rice-white'))]))).rejects.toThrow(/permission denied/);
  });
  it('returns a conflict on stale writes and tombstones cannot be overwritten by an older version',async()=>{
    expect((await apply(alice,crypto.randomUUID(),0)).status).toBe('conflict');
    expect((await apply(alice,crypto.randomUUID(),1,meal,true)).status).toBe('applied');
    expect((await apply(alice,crypto.randomUUID(),1,meal,false)).status).toBe('conflict');
    const child=await asUser(alice,tx=>tx.query('select * from meal_log_items'));expect(child.rows).toHaveLength(0);
    const rows=await asUser(alice,tx=>tx.query<{deleted:boolean;version:number}>('select deleted,version from meal_logs'));
    expect(rows.rows).toEqual([{deleted:true,version:2}]);
  });
  it('restricts shared-catalog edits and private photo access to the correct owner',async()=>{
    await expect(asUser(bob,tx=>tx.query("insert into foods(id,name,payload) values('fake','Fake','{}')"))).rejects.toThrow(/row-level security|permission denied/);
    await asUser(alice,tx=>tx.query("insert into storage.objects(bucket_id,name) values('meal-photos',$1)",[`${alice}/photo.jpg`]));
    const result=await asUser(bob,tx=>tx.query('select * from storage.objects'));expect(result.rows).toHaveLength(0);
    await expect(asUser(bob,tx=>tx.query("insert into storage.objects(bucket_id,name) values('meal-photos',$1)",[`${alice}/attack.jpg`]))).rejects.toThrow(/row-level security/);
  });
  it('prevents clients from bypassing quotas or writing profiles directly',async()=>{
    await expect(asUser(alice,tx=>tx.query('select consume_ai_quota($1)',[alice]))).rejects.toThrow(/permission denied/);
    await expect(asUser(alice,tx=>tx.query('insert into profiles(id,user_id,payload) values($1,$2,$3)',[crypto.randomUUID(),alice,JSON.stringify(initialProfile)]))).rejects.toThrow(/permission denied/);
  });
});
