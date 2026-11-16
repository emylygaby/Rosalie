import { describe, expect, it } from 'vitest';
import { budgetDisplay, emptyData, greeting, monthlySummary, normalizeData, uid } from '../src/domain';
import { demoData } from '../src/seed';
import { cycleForecast, cyclePhases, newCycle, newPeriod, validateCycle } from '../src/cycle';

describe('renda média e identificação', () => {
  it('base informada repete e extras pertencem somente ao mês recebido', () => {
    const data = demoData(); data.incomes.push({ id: uid(), description: 'Freela', amount: 30000, category: 'Extra', date: '2026-11-30', received_date: '2026-12-02' });
    expect(monthlySummary(data, '2026-12')).toMatchObject({ baseIncome: 280000, extraIncome: 30000, income: 310000, realized: 30000 });
    expect(monthlySummary(data, '2027-01')).toMatchObject({ baseIncome: 280000, extraIncome: 0, income: 280000, realized: 0 });
    expect(monthlySummary(data, '2026-11').income).toBe(0);
  });
  it('mudança de média tem vigência e não muda meses anteriores', () => {
    const data = demoData(); data.income_plans.push({ id: uid(), amount: 320000, start_month: '2027-02' });
    expect(monthlySummary(data, '2027-01').baseIncome).toBe(280000);
    expect(monthlySummary(data, '2027-02').baseIncome).toBe(320000);
  });
  it('ausência de média nunca copia receitas para outro mês', () => {
    const data = emptyData(); data.incomes.push({ id: uid(), description: 'Extra', amount: 50000, category: 'Extra', date: '2026-12-01', received_date: '2026-12-01' });
    expect(monthlySummary(data, '2027-01').income).toBe(0);
    expect(budgetDisplay(-12345)).toEqual({ amount: 12345, label: 'Falta cobrir', shortfall: true });
    expect(budgetDisplay(12345).label).toBe('Disponível planejado');
  });
  it('migra dados antigos sem inventar média, recebimento, foto ou ciclo', () => {
    const raw = demoData() as unknown as Record<string, unknown>; delete raw.income_plans; delete raw.tasks; delete raw.habits; delete raw.habit_checks; delete raw.planner_notes;
    raw.profile = { name: 'Ana', cpf: 'não preservar', gender: 'não preservar' }; raw.cycle = { sensitive: true };
    const data = normalizeData(raw);
    expect(data.income_plans).toEqual([]); expect(data.tasks).toEqual([]);
    expect(data.profile).toEqual({ name: 'Ana', avatar_path: '' }); expect(data).not.toHaveProperty('cycle');
  });
  it('saudação usa o horário de São Paulo, não o fuso do host', () => {
    expect(greeting(new Date('2026-12-01T09:00:00Z'))).toBe('Bom dia');
    expect(greeting(new Date('2026-12-01T17:00:00Z'))).toBe('Boa tarde');
    expect(greeting(new Date('2026-12-01T23:00:00Z'))).toBe('Boa noite');
  });
});
describe('ciclo: registros e estimativas explícitas', () => {
  const now = new Date('2026-12-20T12:00:00-03:00');
  const fixture = () => ({ ...newCycle(), consented_at: now.toISOString(), records: [newPeriod('2026-12-01', '2026-12-04')] });
  it('calcula próxima data, janela incerta de ovulação e possível TPM', () => {
    const data = fixture(); validateCycle(data, now);
    expect(cycleForecast(data, now)).toMatchObject({ next: '2026-12-29', ovulation_start: '2026-12-13', ovulation_end: '2026-12-19', pms_start: '2026-12-15', enabled: true });
    expect(cyclePhases(data, '2026-12-03', now)).toEqual(['recorded']);
    expect(cyclePhases(data, '2026-12-13', now)).toEqual(['ovulation-estimate']);
    expect(cyclePhases(data, '2026-12-16', now)).toEqual(['ovulation-estimate', 'pms-estimate']);
    expect(cyclePhases(data, '2027-01-02', now)).toEqual(['period-estimate']);
    expect(cyclePhases(data, '2027-01-03', now)).toEqual([]);
  });
  it('fim do sangramento não altera a duração do ciclo', () => {
    const data = fixture(); data.records[0].end_date = '2026-12-07';
    expect(cycleForecast(data, now)?.next).toBe('2026-12-29');
  });
  it('não estima ciclo irregular, desativado ou desatualizado', () => {
    const data = fixture(); data.estimates = false;
    expect(cyclePhases(data, '2026-12-13', now)).toEqual([]);
    expect(cyclePhases(data, '2026-12-03', now)).toEqual(['recorded']);
    data.estimates = true; data.cycle_length = 40;
    expect(cycleForecast(data, now)?.enabled).toBe(false);
    data.cycle_length = 28;
    expect(cycleForecast(data, new Date('2027-02-01T12:00:00-03:00'))?.enabled).toBe(false);
  });
  it('recusa falta de autorização, datas futuras e registros sobrepostos', () => {
    const data = fixture(); data.consented_at = '';
    expect(() => validateCycle(data, now)).toThrow(/Autorize/);
    data.consented_at = now.toISOString(); data.records[0].end_date = '2026-12-31';
    expect(() => validateCycle(data, now)).toThrow(/hoje/);
    data.records[0].end_date = '2026-12-07'; data.records.push(newPeriod('2026-12-05', null));
    expect(() => validateCycle(data, now)).toThrow(/sobrepor/);
  });
});
