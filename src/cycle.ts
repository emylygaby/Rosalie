import { addDays, today, uid } from './domain';

export interface PeriodRecord { id: string; start_date: string; end_date: string | null }
export interface CycleData { consented_at: string; consent_version?: string; cycle_length: number; period_length: number; estimates: boolean; records: PeriodRecord[] }
export type CyclePhase = 'recorded' | 'period-estimate' | 'ovulation-estimate' | 'pms-estimate';
export const phaseLabels: Record<CyclePhase, string> = { recorded: 'Menstruação registrada', 'period-estimate': 'Menstruação estimada', 'ovulation-estimate': 'Possível ovulação', 'pms-estimate': 'Possível TPM' };
export function validateCycle(data: CycleData, now = new Date()) {
  if (!data.consented_at) throw new Error('Autorize o armazenamento local para ativar este recurso.');
  if (!Number.isInteger(data.cycle_length) || data.cycle_length < 15 || data.cycle_length > 90) throw new Error('Informe a duração do ciclo entre 15 e 90 dias.');
  if (!Number.isInteger(data.period_length) || data.period_length < 1 || data.period_length > 15 || data.period_length >= data.cycle_length) throw new Error('Informe uma duração do sangramento entre 1 e 15 dias, menor que o ciclo.');
  const dates = new Set<string>(), records = [...data.records].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const validDate = (date: string) => { const parsed = new Date(`${date}T12:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date; };
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!validDate(record.start_date) || record.start_date > today(now) || record.start_date < '2000-01-01') throw new Error('O início deve ser uma data válida, já ocorrida.');
    if (dates.has(record.start_date)) throw new Error('Já existe um início registrado nessa data.');
    dates.add(record.start_date);
    if (record.end_date && (!validDate(record.end_date) || record.end_date < record.start_date || record.end_date > today(now))) throw new Error('O fim do sangramento deve estar entre o início e hoje.');
    if (record.end_date && records[i + 1] && record.end_date >= records[i + 1].start_date) throw new Error('O sangramento não pode sobrepor o próximo início registrado.');
  }
}
export function cycleForecast(data: CycleData | null, now = new Date()) {
  if (!data?.records.length) return null;
  const latest = [...data.records].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const next = addDays(latest.start_date, data.cycle_length);
  const enabled = data.estimates && data.cycle_length >= 21 && data.cycle_length <= 35 && today(now) <= addDays(next, 7);
  return { latest, next, enabled, ovulation_start: addDays(next, -16), ovulation_end: addDays(next, -10), pms_start: addDays(next, -14), pms_end: addDays(next, -1) };
}
export function cyclePhases(data: CycleData | null, date: string, now = new Date()): CyclePhase[] {
  if (!data) return [];
  const recorded = data.records.some(r => date === r.start_date || (r.end_date && date >= r.start_date && date <= r.end_date));
  if (recorded) return ['recorded'];
  const forecast = cycleForecast(data, now);
  if (!forecast?.enabled) return [];
  if (date >= forecast.next && date < addDays(forecast.next, data.period_length)) return ['period-estimate'];
  const phases: CyclePhase[] = [];
  if (date >= forecast.ovulation_start && date <= forecast.ovulation_end && date >= forecast.latest.start_date) phases.push('ovulation-estimate');
  if (date >= forecast.pms_start && date <= forecast.pms_end && date >= forecast.latest.start_date) phases.push('pms-estimate');
  return phases;
}
export function newCycle(): CycleData { return { consented_at: '', cycle_length: 28, period_length: 5, estimates: true, records: [] }; }
export function newPeriod(start_date: string, end_date: string | null): PeriodRecord { return { id: uid(), start_date, end_date }; }
