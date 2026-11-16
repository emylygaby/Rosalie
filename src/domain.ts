export const categories = ['Moradia', 'Alimentação', 'Beleza/cuidados', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Assinaturas', 'Outros'] as const;
export type Category = typeof categories[number];
export type Month = string;
export interface Income { id: string; description: string; amount: number; date: string; received_date: string | null; category: string }
export interface Expense { id: string; description: string; amount: number; category: Category; due_date: string; paid_date: string | null; method: string; recurrence_id: string | null; skipped?: boolean }
export interface Recurrence { id: string; description: string; amount: number; category: Category; day: number; start_month: Month; end_month: Month | null; method: string; active: boolean }
export interface Card { id: string; name: string; brand: string; closing_day: number; due_day: number; credit_limit: number | null; color: string }
export interface Purchase { id: string; card_id: string; description: string; amount: number; category: Category; date: string; count: number }
export interface Installment { id: string; purchase_id: string; card_id: string; number: number; amount: number; statement_month: Month }
export interface Statement { id: string; card_id: string; statement_month: Month; paid_date: string | null }
export interface Wish { id: string; name: string; amount: number; category: Category; priority: string; url: string; image_path: string; status: 'desired' | 'reserved' | 'bought'; planned_month: Month | null; purchase_id: string | null }
export interface PlannerEvent { id: string; title: string; description: string; start_at: string; end_at: string; reminder_minutes: number; done: boolean }
export interface IncomePlan { id: string; amount: number; start_month: Month }
export interface PlannerTask { id: string; title: string; due_date: string; priority: 'Alta' | 'Normal' | 'Baixa'; done: boolean }
export interface Habit { id: string; name: string }
export interface HabitCheck { id: string; habit_id: string; date: string }
export interface PlannerNote { id: string; month: Month; focus: string; notes: string }
export interface Profile { name: string; avatar_path: string }
export interface AppData { profile: Profile; preferences: { reminders: boolean }; income_plans: IncomePlan[]; tasks: PlannerTask[]; habits: Habit[]; habit_checks: HabitCheck[]; planner_notes: PlannerNote[]; incomes: Income[]; expenses: Expense[]; recurrences: Recurrence[]; cards: Card[]; purchases: Purchase[]; installments: Installment[]; statements: Statement[]; wishes: Wish[]; events: PlannerEvent[] }
export const uid = () => crypto.randomUUID();
export const emptyData = (): AppData => ({ profile: { name: '', avatar_path: '' }, preferences: { reminders: true }, income_plans: [], tasks: [], habits: [], habit_checks: [], planner_notes: [], incomes: [], expenses: [], recurrences: [], cards: [], purchases: [], installments: [], statements: [], wishes: [], events: [] });
export function normalizeData(raw: Partial<AppData>): AppData {
  const defaults = emptyData();
  const known = Object.fromEntries(Object.keys(defaults).map(key => [key, raw[key as keyof AppData] ?? defaults[key as keyof AppData]])) as unknown as AppData;
  const next = { ...known, profile: { name: raw.profile?.name ?? '', avatar_path: raw.profile?.avatar_path ?? '' }, preferences: { reminders: raw.preferences?.reminders ?? true } };
  for (const key of Object.keys(emptyData()) as (keyof AppData)[]) if (!['profile', 'preferences'].includes(key) && !Array.isArray(next[key])) throw new Error('Os dados não puderam ser lidos. Preserve uma cópia antes de restaurar.');
  return next;
}
export function monthlyBase(data: AppData, month: Month) { return [...data.income_plans].filter(p => p.start_month <= month).sort((a, b) => b.start_month.localeCompare(a.start_month))[0]?.amount ?? 0; }
export function budgetDisplay(available: number) { return { amount: Math.abs(available), label: available < 0 ? 'Falta cobrir' : 'Disponível planejado', shortfall: available < 0 }; }
export function greeting(now = new Date()) { const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(now)); return hour >= 6 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'; }
export function addDays(date: string, days: number) { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export function parseMoney(raw: string): number {
  const normalized = raw.trim().replace(/R\$\s*/g, '').replace(/\s/g, '');
  const value = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Informe um valor válido, como 180,00.');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 999999999999) throw new Error('O valor deve ser positivo e menor que R$ 10 bilhões.');
  return cents;
}
export const moneyInput = (cents?: number | null) => cents == null ? '' : `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
export function today(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now); }
export function localTimestamp(iso: string) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
  return `${today(date)}T${time}-03:00`;
}
export function addMonths(month: Month, count: number): Month {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function dateInMonth(month: Month, day: number) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function monthLabel(month: Month, short = false) { return new Intl.DateTimeFormat('pt-BR', { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`)); }
export function dateLabel(date: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(date.length === 10 ? `${date}T12:00:00-03:00` : date)); }
export function firstStatementMonth(card: Card, purchaseDate: string): Month {
  const month = purchaseDate.slice(0, 7);
  // No dia do fechamento a compra entra na próxima fatura (convenção explícita do MVP).
  const afterClosing = purchaseDate >= dateInMonth(month, card.closing_day);
  const closingMonth = afterClosing ? addMonths(month, 1) : month;
  return card.due_day <= card.closing_day ? addMonths(closingMonth, 1) : closingMonth;
}
export function splitInstallments(amount: number, count: number): number[] {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isInteger(count) || count < 1 || count > 120 || amount < count) throw new Error('Use de 1 a 120 parcelas, com pelo menos R$ 0,01 por parcela.');
  const base = Math.floor(amount / count), remainder = amount % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
export function addPurchase(data: AppData, purchase: Purchase, firstMonth: Month): AppData {
  if (!data.cards.some(c => c.id === purchase.card_id)) throw new Error('Selecione um cartão válido.');
  const installments = splitInstallments(purchase.amount, purchase.count).map((amount, i): Installment => ({ id: uid(), purchase_id: purchase.id, card_id: purchase.card_id, number: i + 1, amount, statement_month: addMonths(firstMonth, i) }));
  if (installments.some(i => data.statements.some(s => s.card_id === i.card_id && s.statement_month === i.statement_month && s.paid_date))) throw new Error('Uma fatura está quitada. Reabra-a ou selecione outra primeira fatura.');
  return { ...data, purchases: [...data.purchases, purchase], installments: [...data.installments, ...installments] };
}
export function expensesInMonth(data: AppData, month: Month): Expense[] {
  const stored = data.expenses.filter(e => e.due_date.startsWith(month));
  const virtual = data.recurrences.filter(r => r.active && r.start_month <= month && (!r.end_month || r.end_month >= month) && !stored.some(e => e.recurrence_id === r.id)).map((r): Expense => ({ id: `recurring:${r.id}:${month}`, description: r.description, amount: r.amount, category: r.category, due_date: dateInMonth(month, r.day), paid_date: null, recurrence_id: r.id, method: r.method }));
  return [...stored, ...virtual].filter(e => !e.skipped).sort((a, b) => a.due_date.localeCompare(b.due_date));
}
export function putExpense(data: AppData, expense: Expense): AppData {
  const item = { ...expense, id: expense.id.startsWith('recurring:') ? uid() : expense.id };
  return { ...data, expenses: [...data.expenses.filter(e => e.id !== item.id && !(item.recurrence_id && e.recurrence_id === item.recurrence_id && e.due_date.slice(0, 7) === item.due_date.slice(0, 7))), item] };
}
export function statementTotal(data: AppData, cardId: string, month: Month) { return data.installments.filter(i => i.card_id === cardId && i.statement_month === month).reduce((sum, i) => sum + i.amount, 0); }
export function statementPaid(data: AppData, cardId: string, month: Month) { return data.statements.find(s => s.card_id === cardId && s.statement_month === month)?.paid_date ?? null; }
export function monthlySummary(data: AppData, month: Month) {
  const expenses = expensesInMonth(data, month);
  const baseIncome = monthlyBase(data, month);
  const extraIncome = data.incomes.filter(i => i.received_date?.startsWith(month)).reduce((sum, i) => sum + i.amount, 0);
  const income = baseIncome + extraIncome;
  const cash = expenses.reduce((sum, e) => sum + e.amount, 0);
  const cardTotal = data.cards.reduce((sum, c) => sum + statementTotal(data, c.id, month), 0);
  const reserved = data.wishes.filter(w => w.status === 'reserved' && w.planned_month === month).reduce((sum, w) => sum + w.amount, 0);
  const payable = expenses.filter(e => !e.paid_date).reduce((sum, e) => sum + e.amount, 0) + data.cards.filter(c => !statementPaid(data, c.id, month)).reduce((sum, c) => sum + statementTotal(data, c.id, month), 0);
  const received = data.incomes.filter(i => i.received_date?.startsWith(month)).reduce((sum, i) => sum + i.amount, 0);
  // Fluxo de caixa usa a data efetiva, mesmo para obrigações de outro mês.
  const paidCash = data.expenses.filter(e => e.paid_date?.startsWith(month)).reduce((sum, e) => sum + e.amount, 0);
  const paidStatements = data.statements.filter(s => s.paid_date?.startsWith(month)).reduce((sum, s) => sum + statementTotal(data, s.card_id, s.statement_month), 0);
  return { income, baseIncome, extraIncome, received, cash, cardTotal, expenses: cash + cardTotal, reserved, beforeWishes: income - cash - cardTotal, available: income - cash - cardTotal - reserved, payable, realized: received - paidCash - paidStatements };
}
export function categoryTotals(data: AppData, month: Month) {
  const totals = new Map<string, number>();
  for (const e of expensesInMonth(data, month)) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  for (const i of data.installments.filter(i => i.statement_month === month)) { const p = data.purchases.find(p => p.id === i.purchase_id); const category = p?.category ?? 'Outros'; totals.set(category, (totals.get(category) ?? 0) + i.amount); }
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
export function buyWish(data: AppData, wishId: string, date: string, cardId: string | null, count: number, statementMonth: Month): AppData {
  const wish = data.wishes.find(w => w.id === wishId);
  if (!wish || wish.status === 'bought') throw new Error('Este desejo já foi comprado ou não existe.');
  const id = uid();
  let next = { ...data, wishes: data.wishes.map(w => w.id === wishId ? { ...w, status: 'bought' as const, planned_month: null, purchase_id: id } : w) };
  if (cardId) next = addPurchase(next, { id, card_id: cardId, description: wish.name, amount: wish.amount, category: wish.category, date, count }, statementMonth);
  else next = putExpense(next, { id, description: wish.name, amount: wish.amount, category: wish.category, due_date: date, paid_date: date, method: 'pix', recurrence_id: null });
  return next;
}
export function upcomingAlerts(data: AppData, now = new Date()) {
  if (!data.preferences.reminders) return [];
  const day = today(now), horizon = new Date(`${day}T12:00:00-03:00`); horizon.setUTCDate(horizon.getUTCDate() + 7);
  const until = today(horizon);
  const events = data.events.filter(e => !e.done && new Date(e.start_at).getTime() >= now.getTime() && new Date(e.start_at).getTime() - e.reminder_minutes * 60000 <= now.getTime()).map(e => ({ id: e.id, text: e.title, detail: `${dateLabel(e.start_at)} · ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(e.start_at))}`, to: '/planner' }));
  const months = [...new Set([day.slice(0, 7), until.slice(0, 7)])];
  const bills = months.flatMap(m => expensesInMonth(data, m)).filter(e => !e.paid_date && e.due_date <= until).map(e => ({ id: e.id, text: e.description, detail: `${e.due_date < day ? 'Vencida' : 'Vence'} em ${dateLabel(e.due_date)} · ${money(e.amount)}`, to: '/financas' }));
  const cards = months.flatMap(m => data.cards.filter(c => statementTotal(data, c.id, m) > 0 && !statementPaid(data, c.id, m) && dateInMonth(m, c.due_day) <= until).map(c => ({ id: c.id + m, text: `Fatura ${c.name}`, detail: `Vencimento ${dateLabel(dateInMonth(m, c.due_day))} · ${money(statementTotal(data, c.id, m))}`, to: `/cartoes/${c.id}` })));
  return [...events, ...bills, ...cards];
}
