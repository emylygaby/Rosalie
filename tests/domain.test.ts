import { describe, expect, it } from 'vitest';
import { addMonths, addPurchase, buyWish, dateInMonth, expensesInMonth, firstStatementMonth, localTimestamp, monthlySummary, parseMoney, putExpense, splitInstallments, statementTotal, today, uid, upcomingAlerts } from '../src/domain';
import { demoData } from '../src/seed';

describe('regras financeiras do design.md', () => {
  it('reconcilia integralmente o cenário de dezembro/2026', () => {
    expect(monthlySummary(demoData(), '2026-12')).toMatchObject({ income: 280000, cash: 13500, cardTotal: 17000, expenses: 30500, beforeWishes: 249500, reserved: 18000, available: 231500, payable: 30500, realized: 0 });
  });
  it('preserva centavos e gera parcelas consecutivas na virada do ano', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    const data = demoData(), next = addPurchase(data, { id: uid(), card_id: data.cards[0].id, description: 'Teste', amount: 10000, category: 'Outros', date: '2026-12-01', count: 3 }, '2026-12');
    const installments = next.installments.slice(-3);
    expect(installments.map(i => i.statement_month)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(installments.reduce((s, i) => s + i.amount, 0)).toBe(10000);
  });
  it('rejeita contagens inválidas e parcelas menores que um centavo', () => {
    for (const count of [0, -1, 1.5, 121]) expect(() => splitInstallments(100, count)).toThrow();
    expect(() => splitInstallments(2, 3)).toThrow();
  });
  it('não lança o valor integral do parcelamento no primeiro mês', () => {
    const data = demoData();
    expect(statementTotal(data, data.cards[0].id, '2026-12')).toBe(2000);
    expect(statementTotal(data, data.cards[1].id, '2026-12')).toBe(15000);
    expect(statementTotal(data, data.cards[0].id, '2027-05')).toBe(2000);
    expect(statementTotal(data, data.cards[0].id, '2027-06')).toBe(0);
  });
  it('pagar a fatura altera o fluxo de caixa, sem mudar as despesas', () => {
    const data = demoData(), before = monthlySummary(data, '2026-12');
    data.statements.push({ id: uid(), card_id: data.cards[0].id, statement_month: '2026-12', paid_date: '2027-01-02' });
    const after = monthlySummary(data, '2026-12');
    expect(after.expenses).toBe(before.expenses);
    expect(after.available).toBe(before.available);
    expect(after.payable).toBe(before.payable - 2000);
    expect(after.realized).toBe(0);
    expect(monthlySummary(data, '2027-01').realized).toBe(-2000);
  });
  it('reserva afeta só o planejamento e a conversão à vista não duplica gasto', () => {
    const data = demoData(), wish = data.wishes[0];
    const next = buyWish(data, wish.id, '2026-12-10', null, 1, '2026-12');
    expect(monthlySummary(next, '2026-12')).toMatchObject({ expenses: 48500, reserved: 0, available: 231500, realized: -18000 });
    expect(next.wishes[0]).toMatchObject({ status: 'bought', planned_month: null });
    expect(() => buyWish(next, wish.id, '2026-12-10', null, 1, '2026-12')).toThrow();
  });
  it('converte desejo em compra parcelada e remove a reserva atomicamente', () => {
    const data = demoData(), next = buyWish(data, data.wishes[0].id, '2026-12-10', data.cards[0].id, 3, '2027-01');
    expect(monthlySummary(next, '2026-12')).toMatchObject({ expenses: 30500, reserved: 0, available: 249500 });
    expect(statementTotal(next, data.cards[0].id, '2027-01')).toBe(8000);
    expect(next.installments.filter(i => i.purchase_id === next.wishes[0].purchase_id).reduce((s, i) => s + i.amount, 0)).toBe(18000);
  });
  it('recorrência é única e permite alteração e exclusão de uma ocorrência', () => {
    let data = demoData();
    const expense = expensesInMonth(data, '2026-12')[0];
    data = putExpense(data, { ...expense, amount: 4500, paid_date: '2026-12-10' });
    data = putExpense(data, { ...expensesInMonth(data, '2026-12')[0], amount: 5000 });
    expect(expensesInMonth(data, '2026-12')).toHaveLength(2);
    expect(expensesInMonth(data, '2026-12')[0].amount).toBe(5000);
    expect(expensesInMonth(data, '2027-01')[0].amount).toBe(4000);
    data = putExpense(data, { ...expensesInMonth(data, '2026-12')[0], skipped: true, paid_date: null });
    expect(expensesInMonth(data, '2026-12')).toHaveLength(1);
    expect(expensesInMonth(data, '2027-01')).toHaveLength(2);
  });
  it('respeita fim da série, meses curtos e virada do ano', () => {
    const data = demoData(); data.recurrences[0].day = 31; data.recurrences[0].end_month = '2027-02';
    expect(expensesInMonth(data, '2027-02').find(e => e.description === 'Água')?.due_date).toBe('2027-02-28');
    expect(expensesInMonth(data, '2027-03').find(e => e.description === 'Água')).toBeUndefined();
    expect(dateInMonth('2028-02', 31)).toBe('2028-02-29');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
  it('receitas usam a data real no fluxo de caixa', () => {
    const data = demoData(); data.incomes.push({ id: uid(), description: 'Extra', amount: 280000, category: 'Outros', date: '2026-12-31', received_date: '2027-01-02' });
    expect(monthlySummary(data, '2026-12').income).toBe(280000);
    expect(monthlySummary(data, '2026-12').realized).toBe(0);
    expect(monthlySummary(data, '2027-01').realized).toBe(280000);
  });
  it('primeira fatura distingue antes, no dia e depois do fechamento', () => {
    const card = demoData().cards[0];
    expect(firstStatementMonth(card, '2026-11-24')).toBe('2026-12');
    expect(firstStatementMonth(card, '2026-11-25')).toBe('2027-01');
    expect(firstStatementMonth(card, '2026-11-26')).toBe('2027-01');
    expect(firstStatementMonth({ ...card, closing_day: 10, due_day: 20 }, '2026-11-09')).toBe('2026-11');
    expect(firstStatementMonth({ ...card, closing_day: 10, due_day: 20 }, '2026-11-10')).toBe('2026-12');
    expect(firstStatementMonth({ ...card, closing_day: 31, due_day: 5 }, '2027-02-28')).toBe('2027-04');
  });
  it('não adiciona compras silenciosamente a faturas já quitadas', () => {
    const data = demoData(); data.statements.push({ id: uid(), card_id: data.cards[0].id, statement_month: '2026-12', paid_date: '2026-12-05' });
    expect(() => buyWish(data, data.wishes[0].id, '2026-12-01', data.cards[0].id, 1, '2026-12')).toThrow(/quitada/);
    expect(data.wishes[0].status).toBe('reserved');
  });
  it('interpreta dinheiro por dígitos decimais, sem contabilidade com floats', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(123456);
    expect(parseMoney('0,01')).toBe(1);
    expect(parseMoney('180.10')).toBe(18010);
    for (const raw of ['-1', '0', '1,001', 'NaN', '1e3']) expect(() => parseMoney(raw)).toThrow();
  });
  it('avisa eventos na janela configurada e respeita a preferência', () => {
    const data = demoData();
    expect(upcomingAlerts(data, new Date('2026-12-08T14:00:00-03:00')).some(a => a.text === 'Consulta')).toBe(false);
    expect(upcomingAlerts(data, new Date('2026-12-09T14:00:00-03:00')).some(a => a.text === 'Consulta')).toBe(true);
    expect(upcomingAlerts(data, new Date('2026-12-10T15:00:00-03:00')).some(a => a.text === 'Consulta')).toBe(false);
    data.preferences.reminders = false;
    expect(upcomingAlerts(data, new Date('2026-12-09T14:00:00-03:00'))).toEqual([]);
  });
  it('normaliza eventos do PostgreSQL para Brasília, independente do host', () => {
    expect(localTimestamp('2026-12-10T17:00:00Z')).toBe('2026-12-10T14:00:00-03:00');
    expect(today(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11-30');
  });
});
