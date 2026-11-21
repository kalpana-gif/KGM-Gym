-- Execute in a new Supabase project. All changes are atomic and owner scoped.
create table public.foods (id text primary key, name text not null, payload jsonb not null);
create table public.food_aliases (alias text not null, food_id text not null references public.foods(id), primary key(alias, food_id));
create table public.exercises (id text primary key, payload jsonb not null);
create table public.workout_plans (id text primary key, payload jsonb not null);
alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
create policy catalog_read on public.foods for select to anon, authenticated using (true);
create policy aliases_read on public.food_aliases for select to anon, authenticated using (true);
create policy exercises_read on public.exercises for select to anon, authenticated using (true);
create policy workouts_read on public.workout_plans for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['profiles','meal_logs','daily_targets','weight_entries','custom_foods','recipes','meal_plans','workout_sessions','photo_metadata','favorites']
  loop
    execute format('create table public.%I (
      id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
      payload jsonb not null check(jsonb_typeof(payload) = ''object''),
      version bigint not null default 1 check(version > 0), deleted boolean not null default false,
      updated_at timestamptz not null default now(), unique(id, user_id))', t);
    execute format('create index on public.%I(user_id, updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_select on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    -- Writes go through apply_change so they cannot bypass versioning / tombstones.
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end $$;
create index meal_date on public.meal_logs(user_id, (payload->>'date'));
create index target_date on public.daily_targets(user_id, (payload->>'date'));

create table public.meal_log_items (
  id uuid primary key, meal_id uuid not null, user_id uuid not null,
  grams numeric not null check(grams > 0 and grams <= 5000), food_snapshot jsonb not null,
  foreign key(meal_id, user_id) references public.meal_logs(id, user_id) on delete cascade
);
create table public.recipe_ingredients (
  recipe_id uuid not null, user_id uuid not null, ordinal integer not null,
  food_id text not null, grams numeric not null check(grams > 0),
  primary key(recipe_id, ordinal), foreign key(recipe_id, user_id) references public.recipes(id, user_id) on delete cascade
);
alter table public.meal_log_items enable row level security;
alter table public.recipe_ingredients enable row level security;
create policy owned_items on public.meal_log_items for select to authenticated using(auth.uid() = user_id);
create policy owned_ingredients on public.recipe_ingredients for select to authenticated using(auth.uid() = user_id);
revoke insert, update, delete on public.meal_log_items, public.recipe_ingredients from anon, authenticated;

create table public.sync_operations (
  operation_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null, record_id uuid not null, completed_at timestamptz not null default now()
);
alter table public.sync_operations enable row level security;
revoke all on public.sync_operations from anon, authenticated;

create or replace function public.apply_change(
  p_operation uuid, p_entity text, p_id uuid, p_base_version bigint, p_payload jsonb, p_deleted boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare who uuid := auth.uid(); old_row jsonb; result jsonb; item jsonb; ordinal integer := 0;
begin
  if who is null then raise exception 'Authentication required'; end if;
  if p_entity <> all(array['profiles','meal_logs','daily_targets','weight_entries','custom_foods','recipes','meal_plans','workout_sessions','photo_metadata','favorites']) then
    raise exception 'Invalid entity';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 100000 then raise exception 'Invalid payload'; end if;
  if p_payload ? 'base64' then raise exception 'Photos must not be embedded in database records'; end if;
  -- Serialize competing changes per record, including creation, without relying on timestamps.
  perform pg_advisory_xact_lock(hashtextextended(p_entity || p_id::text, 0));
  if exists(select 1 from sync_operations where operation_id = p_operation and user_id = who and entity = p_entity and record_id = p_id) then
    return jsonb_build_object('status','applied');
  end if;
  if exists(select 1 from sync_operations where operation_id = p_operation) then raise exception 'Invalid operation'; end if;
  execute format('select to_jsonb(r) from public.%I r where id = $1', p_entity) into old_row using p_id;
  if old_row is not null and (old_row->>'user_id')::uuid <> who then raise exception 'Not authorized'; end if;
  if coalesce((old_row->>'version')::bigint, 0) <> p_base_version then
    return jsonb_build_object('status','conflict','record',old_row);
  end if;
  if p_entity = 'meal_logs' then
    if p_payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_payload->'items') <> 'array'
      or jsonb_array_length(p_payload->'items') > 100 then raise exception 'Invalid meal'; end if;
  end if;
  execute format('insert into public.%I(id,user_id,payload,version,deleted) values($1,$2,$3,$4,$5)
    on conflict(id) do update set payload=excluded.payload,version=excluded.version,deleted=excluded.deleted,updated_at=now()
    returning to_jsonb(%I.*)', p_entity, p_entity)
    into result using p_id, who, p_payload, p_base_version + 1, p_deleted;
  if p_entity = 'meal_logs' then
    delete from meal_log_items where meal_id = p_id and user_id = who;
    if not p_deleted then
      for item in select value from jsonb_array_elements(p_payload->'items') loop
        insert into meal_log_items(id, meal_id, user_id, grams, food_snapshot)
          values((item->>'id')::uuid, p_id, who, (item->>'grams')::numeric, item->'food');
      end loop;
    end if;
  elsif p_entity = 'recipes' then
    delete from recipe_ingredients where recipe_id = p_id and user_id = who;
    if not p_deleted then
      for item in select value from jsonb_array_elements(coalesce(p_payload->'ingredients','[]'::jsonb)) loop
        insert into recipe_ingredients(recipe_id,user_id,ordinal,food_id,grams)
          values(p_id,who,ordinal,item->>'foodId',(item->>'grams')::numeric);
        ordinal := ordinal + 1;
      end loop;
    end if;
  end if;
  insert into sync_operations(operation_id,user_id,entity,record_id) values(p_operation,who,p_entity,p_id);
  return jsonb_build_object('status','applied','record',result);
end $$;
revoke all on function public.apply_change(uuid,text,uuid,bigint,jsonb,boolean) from public, anon;
grant execute on function public.apply_change(uuid,text,uuid,bigint,jsonb,boolean) to authenticated;

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null, count integer not null default 0, last_request timestamptz,
  primary key(user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
create or replace function public.consume_ai_quota(p_user uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare permitted integer; day_key date := (now() at time zone 'Asia/Colombo')::date;
begin
  insert into ai_usage(user_id,day,count,last_request) values(p_user,day_key,1,now())
  on conflict(user_id,day) do update set count=ai_usage.count+1,last_request=now()
  where ai_usage.count < 15 and (ai_usage.last_request is null or ai_usage.last_request < now()-interval '10 seconds')
  returning count into permitted;
  return permitted is not null;
end $$;
revoke all on function public.consume_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meal-photos','meal-photos',false,2000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy own_photo_read on storage.objects for select to authenticated using(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy own_photo_insert on storage.objects for insert to authenticated with check(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy own_photo_update on storage.objects for update to authenticated using(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy own_photo_delete on storage.objects for delete to authenticated using(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
