-- Versão 1.2. Execute após 001 e 002, como administrador da migração.
begin;
alter table public.profiles add column deletion_requested_at timestamptz;
create schema if not exists rosalie_private;
revoke all on schema rosalie_private from public, anon, authenticated;
alter function public.rosalie_save(jsonb, bigint) set schema rosalie_private;
alter function rosalie_private.rosalie_save(jsonb, bigint) rename to save_v11;
alter function rosalie_private.save_v11(jsonb, bigint) security definer;
revoke all on function rosalie_private.save_v11(jsonb, bigint) from public, anon, authenticated;
alter function public.rosalie_initialize(text) security definer;
alter function public.rosalie_load() security definer;

create function public.rosalie_save(payload jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare collection text; fields jsonb; item jsonb; field record;
  schema_fields jsonb := '{
    "income_plans":["id","amount","start_month"],"tasks":["id","title","due_date","priority","done"],
    "habits":["id","name"],"habit_checks":["id","habit_id","date"],"planner_notes":["id","month","focus","notes"],
    "incomes":["id","description","amount","date","received_date","category"],
    "expenses":["id","description","amount","category","due_date","paid_date","method","recurrence_id","skipped"],
    "recurrences":["id","description","amount","category","day","start_month","end_month","method","active"],
    "cards":["id","name","brand","closing_day","due_day","credit_limit","color"],
    "purchases":["id","card_id","description","amount","category","date","count"],
    "installments":["id","purchase_id","card_id","number","amount","statement_month"],
    "statements":["id","card_id","statement_month","paid_date"],
    "wishes":["id","name","amount","category","priority","url","image_path","status","planned_month","purchase_id"],
    "events":["id","title","description","start_at","end_at","reminder_minutes","done"]}'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  -- Impede novo upload/gravação enquanto a exclusão é processada ou retomada.
  perform 1 from public.profiles where user_id = auth.uid() and deletion_requested_at is null for update;
  if not found then raise exception 'account_unavailable'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 2097152 then raise exception 'invalid_payload'; end if;
  if expected_revision is null or expected_revision < 0 then raise exception 'invalid_revision'; end if;
  if exists (select 1 from jsonb_object_keys(payload) k where k not in ('profile','preferences') and not schema_fields ? k) then raise exception 'unexpected_field'; end if;
  if jsonb_typeof(payload->'profile') is distinct from 'object' or jsonb_typeof(payload->'preferences') is distinct from 'object' then raise exception 'invalid_profile'; end if;
  if exists (select 1 from jsonb_object_keys(payload->'profile') k where k not in ('name','avatar_path'))
    or exists (select 1 from jsonb_object_keys(payload->'preferences') k where k <> 'reminders') then raise exception 'unexpected_field'; end if;
  if jsonb_typeof(payload->'profile'->'name') is distinct from 'string'
    or jsonb_typeof(payload->'profile'->'avatar_path') is distinct from 'string'
    or jsonb_typeof(payload->'preferences'->'reminders') is distinct from 'boolean' then raise exception 'invalid_profile'; end if;
  for collection, fields in select * from jsonb_each(schema_fields) loop
    if jsonb_typeof(payload->collection) is distinct from 'array' then raise exception 'missing_collection'; end if;
    if jsonb_array_length(payload->collection) > 1000 then raise exception 'collection_limit'; end if;
    for item in select * from jsonb_array_elements(payload->collection) loop
      if jsonb_typeof(item) <> 'object' then raise exception 'invalid_record'; end if;
      for field in select * from jsonb_each(item) loop
        if not fields ? field.key then raise exception 'unexpected_field'; end if;
        if jsonb_typeof(field.value) not in ('string','number','boolean','null') or length(field.value::text) > 4096 then raise exception 'invalid_value'; end if;
      end loop;
    end loop;
  end loop;
  return rosalie_private.save_v11(payload, expected_revision);
end $$;
revoke all on function public.rosalie_save(jsonb, bigint) from public, anon;
grant execute on function public.rosalie_save(jsonb, bigint) to authenticated;

do $$ declare t text;
begin
  foreach t in array array['profiles','notification_preferences','cards','recurrence_rules','incomes','expenses','card_purchases','card_installments','card_statements','wishlist_items','planner_events','income_plans','planner_tasks','habits','habit_checks','planner_notes'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

grant select, update(deletion_requested_at) on public.profiles to service_role;
create function public.rosalie_account_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and deletion_requested_at is null);
$$;
revoke all on function public.rosalie_account_active() from public, anon;
grant execute on function public.rosalie_account_active() to authenticated;

-- Somente os dois buckets conhecidos; sem parâmetro de usuário controlado pelo cliente.
create function public.rosalie_owned_files(batch_limit integer default 100) returns table(bucket_id text, name text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id in ('avatars','wishlist') and split_part(o.name,'/',1) = auth.uid()::text
  order by o.bucket_id, o.name limit greatest(1, least(coalesce(batch_limit,100),1000));
$$;
revoke all on function public.rosalie_owned_files(integer) from public, anon;
grant execute on function public.rosalie_owned_files(integer) to authenticated;

drop policy wishlist_read on storage.objects;
drop policy wishlist_insert on storage.objects;
drop policy wishlist_update on storage.objects;
drop policy wishlist_delete on storage.objects;
drop policy avatar_read on storage.objects;
drop policy avatar_insert on storage.objects;
drop policy avatar_update on storage.objects;
drop policy avatar_delete on storage.objects;
create policy rosalie_image_read on storage.objects for select to authenticated using (
  bucket_id in ('avatars','wishlist') and split_part(name,'/',1) = auth.uid()::text and (select public.rosalie_account_active()));
create policy rosalie_image_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('avatars','wishlist') and split_part(name,'/',1) = auth.uid()::text and name !~ '[\\\\]' and name not like '%..%' and (select public.rosalie_account_active()));
-- Sem UPDATE/upsert: cada imagem recebe um nome novo.
create policy rosalie_image_delete on storage.objects for delete to authenticated using (
  bucket_id in ('avatars','wishlist') and split_part(name,'/',1) = auth.uid()::text and (select public.rosalie_account_active()));
update storage.buckets set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/webp'] where id in ('avatars','wishlist');
commit;
