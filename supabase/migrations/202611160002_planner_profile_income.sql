-- Evolução 1.1. Aplicar depois de 202611150001_rosalie.sql, preservando os dados.
-- O módulo de ciclo não possui tabelas nem campos no servidor.
begin;
alter table public.profiles drop constraint profiles_name_check;
alter table public.profiles alter column name set default '';
alter table public.profiles add constraint profiles_name_check check (length(trim(name)) <= 80);
alter table public.profiles add column avatar_path text not null default '' check (avatar_path = '' or avatar_path like user_id::text || '/%');

create table public.income_plans (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount between 0 and 999999999999),
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), unique(user_id, start_month)
);
create table public.planner_tasks (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120), due_date date not null,
  priority text not null check (priority in ('Alta', 'Normal', 'Baixa')), done boolean not null default false
);
create table public.habits (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80), unique(id, user_id)
);
create table public.habit_checks (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null, date date not null,
  foreign key (habit_id, user_id) references public.habits(id, user_id), unique(habit_id, date)
);
create table public.planner_notes (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  focus text not null default '' check (length(focus) <= 180),
  notes text not null default '' check (length(notes) <= 4000), unique(user_id, month)
);
do $$
declare table_name text;
begin
  foreach table_name in array array['income_plans', 'planner_tasks', 'habits', 'habit_checks', 'planner_notes'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', table_name);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', table_name);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', table_name);
    execute format('create index on public.%I (user_id)', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

drop function public.rosalie_initialize();
create function public.rosalie_initialize(display_name text default '') returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.profiles(user_id, name) values (auth.uid(), left(trim(coalesce(display_name, '')), 80)) on conflict do nothing;
  insert into public.notification_preferences(user_id) values (auth.uid()) on conflict do nothing;
end $$;
revoke all on function public.rosalie_initialize(text) from public, anon;
grant execute on function public.rosalie_initialize(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 3145728, array['image/webp']);
create policy avatar_read on storage.objects for select to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.rosalie_load() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'revision', p.revision,
    'payload', jsonb_build_object(
      'profile', jsonb_build_object('name', p.name, 'avatar_path', p.avatar_path),
      'preferences', jsonb_build_object('reminders', coalesce((select reminders from public.notification_preferences where user_id = auth.uid()), true)),
      'income_plans', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.income_plans t where user_id = auth.uid()), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.planner_tasks t where user_id = auth.uid()), '[]'::jsonb),
      'habits', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.habits t where user_id = auth.uid()), '[]'::jsonb),
      'habit_checks', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.habit_checks t where user_id = auth.uid()), '[]'::jsonb),
      'planner_notes', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.planner_notes t where user_id = auth.uid()), '[]'::jsonb),
      'cards', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.cards t where user_id = auth.uid()), '[]'::jsonb),
      'incomes', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.incomes t where user_id = auth.uid()), '[]'::jsonb),
      'expenses', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.expenses t where user_id = auth.uid()), '[]'::jsonb),
      'recurrences', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.recurrence_rules t where user_id = auth.uid()), '[]'::jsonb),
      'purchases', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.card_purchases t where user_id = auth.uid()), '[]'::jsonb),
      'installments', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.card_installments t where user_id = auth.uid()), '[]'::jsonb),
      'statements', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.card_statements t where user_id = auth.uid()), '[]'::jsonb),
      'wishes', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.wishlist_items t where user_id = auth.uid()), '[]'::jsonb),
      'events', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.planner_events t where user_id = auth.uid()), '[]'::jsonb)
    )
  ) from public.profiles p where p.user_id = auth.uid();
$$;

create or replace function public.rosalie_save(payload jsonb, expected_revision bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; next_revision bigint; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select revision into current_revision from public.profiles where user_id = owner_id for update;
  if expected_revision is null or current_revision is null or current_revision <> expected_revision then raise exception 'revision_conflict'; end if;
  if jsonb_typeof(payload) <> 'object' then raise exception 'invalid_payload'; end if;

  if not (payload ?& array['income_plans', 'tasks', 'habits', 'habit_checks', 'planner_notes']) then raise exception 'client_upgrade_required'; end if;
  delete from public.habit_checks where user_id = owner_id;
  delete from public.habits where user_id = owner_id;
  delete from public.planner_tasks where user_id = owner_id;
  delete from public.planner_notes where user_id = owner_id;
  delete from public.income_plans where user_id = owner_id;
  delete from public.card_installments where user_id = owner_id;
  delete from public.card_statements where user_id = owner_id;
  delete from public.card_purchases where user_id = owner_id;
  delete from public.expenses where user_id = owner_id;
  delete from public.recurrence_rules where user_id = owner_id;
  delete from public.cards where user_id = owner_id;
  delete from public.incomes where user_id = owner_id;
  delete from public.wishlist_items where user_id = owner_id;
  delete from public.planner_events where user_id = owner_id;

  insert into public.cards select t.id, owner_id, t.name, t.brand, t.closing_day, t.due_day, t.credit_limit, t.color from jsonb_populate_recordset(null::public.cards, payload->'cards') t;
  insert into public.recurrence_rules select t.id, owner_id, t.description, t.amount, t.category, t.day, t.start_month, t.end_month, t.method, t.active from jsonb_populate_recordset(null::public.recurrence_rules, payload->'recurrences') t;
  insert into public.incomes select t.id, owner_id, t.description, t.amount, t.category, t.date, t.received_date from jsonb_populate_recordset(null::public.incomes, payload->'incomes') t;
  insert into public.expenses select t.id, owner_id, t.description, t.amount, t.category, t.due_date, t.paid_date, t.method, t.recurrence_id, coalesce(t.skipped, false) from jsonb_populate_recordset(null::public.expenses, payload->'expenses') t;
  insert into public.card_purchases select t.id, owner_id, t.card_id, t.description, t.amount, t.category, t.date, t.count from jsonb_populate_recordset(null::public.card_purchases, payload->'purchases') t;
  insert into public.card_installments select t.id, owner_id, t.purchase_id, t.card_id, t.number, t.amount, t.statement_month from jsonb_populate_recordset(null::public.card_installments, payload->'installments') t;
  insert into public.card_statements select t.id, owner_id, t.card_id, t.statement_month, t.paid_date from jsonb_populate_recordset(null::public.card_statements, payload->'statements') t;
  insert into public.wishlist_items select t.id, owner_id, t.name, t.amount, t.category, t.priority, t.url, t.image_path, t.status, t.planned_month, t.purchase_id from jsonb_populate_recordset(null::public.wishlist_items, payload->'wishes') t;
  insert into public.planner_events select t.id, owner_id, t.title, t.description, t.start_at, t.end_at, t.reminder_minutes, t.done from jsonb_populate_recordset(null::public.planner_events, payload->'events') t;
  insert into public.income_plans select t.id, owner_id, t.amount, t.start_month from jsonb_populate_recordset(null::public.income_plans, payload->'income_plans') t;
  insert into public.planner_tasks select t.id, owner_id, t.title, t.due_date, t.priority, t.done from jsonb_populate_recordset(null::public.planner_tasks, payload->'tasks') t;
  insert into public.habits select t.id, owner_id, t.name from jsonb_populate_recordset(null::public.habits, payload->'habits') t;
  insert into public.habit_checks select t.id, owner_id, t.habit_id, t.date from jsonb_populate_recordset(null::public.habit_checks, payload->'habit_checks') t;
  insert into public.planner_notes select t.id, owner_id, t.month, t.focus, t.notes from jsonb_populate_recordset(null::public.planner_notes, payload->'planner_notes') t;

  if exists (
    select p.id from public.card_purchases p left join public.card_installments i on i.purchase_id = p.id
    where p.user_id = owner_id group by p.id, p.amount, p.count
    having coalesce(sum(i.amount), 0) <> p.amount or count(i.id) <> p.count or min(i.number) <> 1 or max(i.number) <> p.count
  ) then raise exception 'installments_do_not_reconcile'; end if;
  if exists (
    select 1 from (
      select i.statement_month, i.number, min(i.statement_month) over(partition by i.purchase_id) as first_month
      from public.card_installments i where i.user_id = owner_id
    ) t where t.statement_month <> to_char((t.first_month || '-01')::date + (t.number - 1) * interval '1 month', 'YYYY-MM')
  ) then raise exception 'installment_months_not_consecutive'; end if;

  update public.profiles set name = payload->'profile'->>'name', avatar_path = coalesce(payload->'profile'->>'avatar_path', ''), revision = revision + 1 where user_id = owner_id returning revision into next_revision;
  update public.notification_preferences set reminders = (payload->'preferences'->>'reminders')::boolean where user_id = owner_id;
  return next_revision;
end $$;


commit;
