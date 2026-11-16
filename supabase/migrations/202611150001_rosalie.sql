-- Execute no SQL Editor de um projeto Supabase novo. Nunca exponha service_role.
begin;

create type public.expense_category as enum ('Moradia', 'Alimentação', 'Beleza/cuidados', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Assinaturas', 'Outros');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Rosalie' check (length(trim(name)) between 1 and 80),
  revision bigint not null default 0 check (revision >= 0)
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminders boolean not null default true
);
create table public.cards (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  brand text not null default '',
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  credit_limit bigint check (credit_limit between 1 and 999999999999),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  unique(id, user_id)
);
create table public.recurrence_rules (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 120),
  amount bigint not null check (amount between 1 and 999999999999),
  category public.expense_category not null,
  day integer not null check (day between 1 and 31),
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  end_month text check (end_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and end_month >= start_month),
  method text not null check (method in ('pix', 'dinheiro', 'debito')),
  active boolean not null default true,
  unique(id, user_id)
);
create table public.incomes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 120),
  amount bigint not null check (amount between 1 and 999999999999),
  category text not null check (length(trim(category)) between 1 and 60),
  date date not null,
  received_date date
);
create table public.expenses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 120),
  amount bigint not null check (amount between 1 and 999999999999),
  category public.expense_category not null,
  due_date date not null,
  paid_date date,
  method text not null check (method in ('pix', 'dinheiro', 'debito')),
  recurrence_id uuid,
  skipped boolean not null default false,
  foreign key (recurrence_id, user_id) references public.recurrence_rules(id, user_id),
  check (not skipped or (recurrence_id is not null and paid_date is null))
);
create unique index expense_occurrence_unique on public.expenses (user_id, recurrence_id, extract(year from due_date), extract(month from due_date)) where recurrence_id is not null;
create table public.card_purchases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 120),
  amount bigint not null check (amount between 1 and 999999999999),
  category public.expense_category not null,
  date date not null,
  count integer not null check (count between 1 and 120 and count <= amount),
  foreign key (card_id, user_id) references public.cards(id, user_id),
  unique (id, card_id, user_id)
);
create table public.card_installments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null,
  card_id uuid not null,
  number integer not null check (number between 1 and 120),
  amount bigint not null check (amount between 1 and 999999999999),
  statement_month text not null check (statement_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  foreign key (purchase_id, card_id, user_id) references public.card_purchases(id, card_id, user_id),
  unique (purchase_id, number)
);
create table public.card_statements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  statement_month text not null check (statement_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  paid_date date,
  foreign key (card_id, user_id) references public.cards(id, user_id),
  unique (card_id, statement_month)
  -- O total é derivado das parcelas. Pagamento não é uma nova despesa.
);
create table public.wishlist_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  amount bigint not null check (amount between 1 and 999999999999),
  category public.expense_category not null,
  priority text not null check (priority in ('Alta', 'Média', 'Baixa')),
  url text not null default '' check (url = '' or url ~ '^https?://'),
  image_path text not null default '',
  status text not null check (status in ('desired', 'reserved', 'bought')),
  planned_month text check (planned_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  purchase_id uuid,
  check ((status = 'reserved' and planned_month is not null) or (status <> 'reserved' and planned_month is null)),
  check (image_path = '' or image_path like user_id::text || '/%')
);
create table public.planner_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reminder_minutes integer not null check (reminder_minutes in (0, 30, 60, 1440, 10080)),
  done boolean not null default false,
  check (end_at > start_at)
);

-- Políticas separadas para testar as quatro operações explicitamente.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'notification_preferences', 'cards', 'recurrence_rules', 'incomes', 'expenses', 'card_purchases', 'card_installments', 'card_statements', 'wishlist_items', 'planner_events'] loop
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

create function public.rosalie_initialize() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.profiles(user_id) values (auth.uid()) on conflict do nothing;
  insert into public.notification_preferences(user_id) values (auth.uid()) on conflict do nothing;
end $$;

create function public.rosalie_load() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'revision', p.revision,
    'payload', jsonb_build_object(
      'profile', jsonb_build_object('name', p.name),
      'preferences', jsonb_build_object('reminders', coalesce((select reminders from public.notification_preferences where user_id = auth.uid()), true)),
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

-- Snapshot transacional para compras, parcelas e reservas mudarem juntas.
-- Revisão impede que uma aba sobrescreva silenciosamente outra.
create function public.rosalie_save(payload jsonb, expected_revision bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; next_revision bigint; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select revision into current_revision from public.profiles where user_id = owner_id for update;
  if expected_revision is null or current_revision is null or current_revision <> expected_revision then raise exception 'revision_conflict'; end if;
  if jsonb_typeof(payload) <> 'object' then raise exception 'invalid_payload'; end if;

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

  update public.profiles set name = payload->'profile'->>'name', revision = revision + 1 where user_id = owner_id returning revision into next_revision;
  update public.notification_preferences set reminders = (payload->'preferences'->>'reminders')::boolean where user_id = owner_id;
  return next_revision;
end $$;

revoke all on function public.rosalie_initialize() from public, anon;
revoke all on function public.rosalie_load() from public, anon;
revoke all on function public.rosalie_save(jsonb, bigint) from public, anon;
grant execute on function public.rosalie_initialize() to authenticated;
grant execute on function public.rosalie_load() to authenticated;
grant execute on function public.rosalie_save(jsonb, bigint) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist', 'wishlist', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']);
create policy wishlist_read on storage.objects for select to authenticated using (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy wishlist_insert on storage.objects for insert to authenticated with check (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy wishlist_update on storage.objects for update to authenticated using (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy wishlist_delete on storage.objects for delete to authenticated using (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
