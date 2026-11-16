import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { demoData } from '../src/seed';
import { expensesInMonth, putExpense, uid } from '../src/domain';

let db: PGlite;
const alice = '00000000-0000-4000-8000-000000000001', bob = '00000000-0000-4000-8000-000000000002';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public, auth, storage to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611150001_rosalie.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160002_planner_profile_income.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160003_security_privacy.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec(`begin; set role authenticated; set request.jwt.claim.sub = '${alice}'; select public.rosalie_initialize();`); });
afterEach(async () => { await db.exec('rollback;'); });
async function save(payload = demoData(), revision = 0) { return db.query('select public.rosalie_save($1::jsonb, $2::bigint) as revision', [JSON.stringify(payload), revision]); }

describe('PostgreSQL, RLS e transações (PGlite, sem serviço remoto)', () => {
  it('persiste o cenário completo e lê snapshot consistente', async () => {
    expect((await save()).rows[0]).toEqual({ revision: 1 });
    const result = await db.query<{ data: { payload: { cards: unknown[]; installments: unknown[] }; revision: number } }>('select public.rosalie_load() as data');
    expect(result.rows[0].data.payload.cards).toHaveLength(2);
    expect(result.rows[0].data.payload.installments).toHaveLength(7);
    expect(result.rows[0].data.revision).toBe(1);
  });
  it('SELECT, INSERT, UPDATE e DELETE de todas as tabelas isolam dois usuários', async () => {
    let fixture = demoData();
    fixture.incomes.push({ id: uid(), description: 'Extra', amount: 10000, category: 'Extra', date: '2026-12-05', received_date: '2026-12-05' });
    fixture.tasks.push({ id: uid(), title: 'Estudar', due_date: '2026-12-10', priority: 'Alta', done: false });
    const habitId = uid(); fixture.habits.push({ id: habitId, name: 'Ler' });
    fixture.habit_checks.push({ id: uid(), habit_id: habitId, date: '2026-12-10' });
    fixture.planner_notes.push({ id: uid(), month: '2026-12', focus: 'Cuidar de mim', notes: 'Meu mês' });
    fixture = putExpense(fixture, expensesInMonth(fixture, '2026-12')[0]);
    fixture.statements.push({ id: uid(), card_id: fixture.cards[0].id, statement_month: '2026-12', paid_date: '2026-12-05' });
    await save(fixture);
    const tables = ['profiles', 'notification_preferences', 'cards', 'recurrence_rules', 'incomes', 'expenses', 'card_purchases', 'card_installments', 'card_statements', 'wishlist_items', 'planner_events', 'income_plans', 'planner_tasks', 'habits', 'habit_checks', 'planner_notes'];
    const samples = new Map<string, unknown>();
    for (const table of tables) samples.set(table, (await db.query<{ sample: unknown }>(`select to_jsonb(t) as sample from public.${table} t limit 1`)).rows[0].sample);
    await db.exec(`set request.jwt.claim.sub = '${bob}'; select public.rosalie_initialize();`);
    for (const table of tables) {
      const rows = await db.query(`select * from public.${table} where user_id = $1`, [alice]);
      expect(rows.rows, table).toEqual([]);
      for (const sql of [`update public.${table} set user_id = $1 where user_id = $1 returning user_id`, `delete from public.${table} where user_id = $1 returning user_id`]) {
        await db.exec('savepoint denied_dml');
        await expect(db.query(sql, [alice]), table).rejects.toThrow(/permission denied/);
        await db.exec('rollback to denied_dml');
      }
      const policies = await db.query<{ cmd: string }>('select cmd from pg_policies where schemaname = $1 and tablename = $2', ['public', table]);
      expect(policies.rows.map(r => r.cmd).sort(), table).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      await db.exec('savepoint insert_other_user');
      await expect(db.query(`insert into public.${table} select * from jsonb_populate_record(null::public.${table}, $1::jsonb)`, [JSON.stringify(samples.get(table))]), table).rejects.toThrow(/permission denied|row-level security/);
      await db.exec('rollback to insert_other_user');
    }
    await db.exec('savepoint denied_insert');
    await expect(db.query("insert into public.incomes (id, user_id, description, amount, category, date) values (gen_random_uuid(), $1, 'Ataque', 100, 'Outros', '2026-12-01')", [alice])).rejects.toThrow(/permission denied|row-level security/);
    await db.exec('rollback to denied_insert');
    await db.exec(`set request.jwt.claim.sub = '${alice}';`);
    expect((await db.query('select * from public.cards')).rows).toHaveLength(2);
  });
  it('rejeita revisão antiga sem perder registros', async () => {
    await save(); await db.exec('savepoint revision_test');
    await expect(save(demoData(), 0)).rejects.toThrow(/revision_conflict/);
    await db.exec('rollback to revision_test');
    expect((await db.query('select * from public.cards')).rows).toHaveLength(2);
  });
  it('rollback preserva compras se parcelas não conciliam', async () => {
    const data = demoData(); await save(data);
    data.installments[0].amount += 1;
    await db.exec('savepoint bad_installment');
    await expect(save(data, 1)).rejects.toThrow(/installments_do_not_reconcile/);
    await db.exec('rollback to bad_installment');
    expect((await db.query<{ amount: number }>('select amount from public.card_installments where id = $1', [data.installments[0].id])).rows[0].amount).toBe(2000);
  });
  it('rejeita meses não consecutivos e duplicação de ocorrência mensal', async () => {
    const data = demoData(); data.installments[1].statement_month = '2027-02';
    await db.exec('savepoint bad_month');
    await expect(save(data)).rejects.toThrow(/installment_months_not_consecutive/);
    await db.exec('rollback to bad_month');
    await save(demoData());
    await db.exec("reset role; insert into public.expenses (id,user_id,description,amount,category,due_date,method,recurrence_id) select gen_random_uuid(),user_id,description,amount,category,'2026-12-01','pix',id from public.recurrence_rules limit 1");
    await db.exec('savepoint duplicate_month');
    await expect(db.exec("insert into public.expenses (id,user_id,description,amount,category,due_date,method,recurrence_id) select gen_random_uuid(),user_id,description,amount,category,'2026-12-15','pix',recurrence_id from public.expenses limit 1")).rejects.toThrow(/duplicate key/);
    await db.exec('rollback to duplicate_month; set role authenticated');
  });
  it('isola leitura, upload, atualização e exclusão de imagens por pasta', async () => {
    await db.query('insert into storage.objects values (gen_random_uuid(), $1, $2)', ['wishlist', `${alice}/foto.png`]);
    await db.query('insert into storage.objects values (gen_random_uuid(), $1, $2)', ['avatars', `${alice}/foto.webp`]);
    await db.exec(`set request.jwt.claim.sub = '${bob}';`);
    expect((await db.query('select * from storage.objects')).rows).toEqual([]);
    expect((await db.query("update storage.objects set name = 'roubado.png' returning id")).rows).toEqual([]);
    expect((await db.query('delete from storage.objects returning id')).rows).toEqual([]);
    await db.exec('savepoint bad_upload');
    await expect(db.query('insert into storage.objects values (gen_random_uuid(), $1, $2)', ['wishlist', `${alice}/outra.png`])).rejects.toThrow(/permission denied|row-level security/);
    await db.exec('rollback to bad_upload');
    await db.exec('savepoint bad_avatar');
    await expect(db.query('insert into storage.objects values (gen_random_uuid(), $1, $2)', ['avatars', `${alice}/outra.webp`])).rejects.toThrow(/permission denied|row-level security/);
    await db.exec('rollback to bad_avatar');
    await db.exec('reset role');
    expect((await db.query("select public from storage.buckets where id = 'wishlist'")).rows[0]).toEqual({ public: false });
    expect((await db.query("select public from storage.buckets where id = 'avatars'")).rows[0]).toEqual({ public: false });
  });
  it('nega DML direto próprio e campos extras de saúde sem alterar a revisão', async () => {
    await save();
    await db.exec('savepoint direct_write');
    await expect(db.exec("update public.profiles set revision = 50")).rejects.toThrow(/permission denied/);
    await db.exec('rollback to direct_write; savepoint health_payload');
    await expect(save({ ...demoData(), cycle: { start: '2026-01-01' } } as any, 1)).rejects.toThrow(/unexpected_field/);
    await db.exec('rollback to health_payload; savepoint row_health');
    const payload = demoData(); Object.assign(payload.events[0], { health_data: 'sensível' });
    await expect(save(payload, 1)).rejects.toThrow(/unexpected_field/);
    await db.exec('rollback to row_health');
    expect((await db.query('select revision from public.profiles')).rows[0]).toEqual({ revision: 1 });
  });
  it('RPC não pode reutilizar IDs de outra conta, acessar arquivos alheios ou o helper privado', async () => {
    const payload = demoData(); await save(payload);
    await db.query('insert into storage.objects values (gen_random_uuid(), $1, $2)', ['avatars', `${alice}/foto.webp`]);
    await db.exec(`set request.jwt.claim.sub = '${bob}'; select public.rosalie_initialize(); savepoint foreign_id`);
    await expect(save(payload)).rejects.toThrow(/duplicate key/);
    await db.exec('rollback to foreign_id');
    expect((await db.query('select * from public.rosalie_owned_files(100)')).rows).toEqual([]);
    expect((await db.query('select * from public.cards')).rows).toEqual([]);
    await db.exec('savepoint private_helper');
    await expect(db.query('select rosalie_private.save_v11($1::jsonb,0)', [JSON.stringify(payload)])).rejects.toThrow(/permission denied/);
    await db.exec('rollback to private_helper');
  });
  it('exclusão pendente bloqueia gravações e upload; excluir identidade apaga as 16 tabelas', async () => {
    await save();
    await db.exec("reset role; update public.profiles set deletion_requested_at = now(); set role authenticated; savepoint frozen_save");
    await expect(save(demoData(), 1)).rejects.toThrow(/account_unavailable/);
    await db.exec('rollback to frozen_save; savepoint frozen_upload');
    await expect(db.query('insert into storage.objects values (gen_random_uuid(), $1, $2)', ['wishlist', `${alice}/nova.webp`])).rejects.toThrow(/row-level security/);
    await db.exec('rollback to frozen_upload');
    await db.exec(`reset role; delete from auth.users where id = '${alice}'; set role authenticated;`);
    for (const table of ['profiles','notification_preferences','cards','recurrence_rules','incomes','expenses','card_purchases','card_installments','card_statements','wishlist_items','planner_events','income_plans','planner_tasks','habits','habit_checks','planner_notes']) expect((await db.query(`select * from public.${table}`)).rows, table).toEqual([]);
    expect((await db.query('select public.rosalie_account_active() as active')).rows[0]).toEqual({ active: false });
  });
  it('bloqueia acesso anônimo às tabelas e às funções', async () => {
    await db.exec('set role anon; savepoint anon_read');
    await expect(db.query('select * from public.cards')).rejects.toThrow(/permission denied/);
    await db.exec('rollback to anon_read; savepoint anon_rpc');
    await expect(db.query('select public.rosalie_load()')).rejects.toThrow(/permission denied/);
    await db.exec('rollback to anon_rpc');
  });
});
