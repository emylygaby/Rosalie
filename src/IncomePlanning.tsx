import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Saved } from './components';
import { useStore } from './store';
import { addMonths, budgetDisplay, monthlyBase, money, moneyInput, monthlySummary, monthLabel, parseMoney, uid } from './domain';

export function IncomePlanForm() {
  const { data, month, mutate, saving } = useStore();
  const [startMonth, setStartMonth] = useState(month), [amount, setAmount] = useState(moneyInput(monthlyBase(data, month))), [saved, setSaved] = useState(false), [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault(); setError(''); setSaved(false);
    try {
      const value = amount.trim() === '' || /^(0|0[,.]0{1,2})$/.test(amount.trim()) ? 0 : parseMoney(amount);
      await mutate(d => ({ ...d, income_plans: [...d.income_plans.filter(p => p.start_month !== startMonth), { id: d.income_plans.find(p => p.start_month === startMonth)?.id ?? uid(), amount: value, start_month: startMonth }] }));
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
  }
  return <section className="panel income-plan-panel" id="renda"><h2>Sua renda mensal média</h2><p className="section-description">Você informa a base do orçamento. Ela se repete a partir do mês escolhido, sem copiar receitas de outros meses.</p><form onSubmit={save}><div className="form-grid"><label className="field"><span>Renda mensal média (R$)</span><input aria-label="Renda mensal média (R$)" aria-describedby="income-amount-help" value={amount} inputMode="decimal" onChange={e => { setAmount(e.target.value); setSaved(false); }} placeholder="0,00"/><small id="income-amount-help">Use zero se ainda não tiver uma referência.</small></label><label className="field"><span>Aplicar a partir de</span><input type="month" required value={startMonth} onChange={e => { setStartMonth(e.target.value); setSaved(false); }} min="2000-01" max="2099-12"/></label></div><p className="form-note">Essa é uma estimativa para planejar, não um recebimento confirmado. Receitas cadastradas são valores adicionais, somados apenas ao mês em que foram recebidos. Se um lançamento antigo representar esta mesma renda, revise-o para não contar duas vezes.</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions">{saved && <Saved text="Renda média salva"/>}<Button type="submit" disabled={saving}>Salvar renda média</Button></div></form></section>;
}
export function BudgetForecast({ referenceMonth }: { referenceMonth?: string }) {
  const { data, month } = useStore(), target = referenceMonth ?? addMonths(month, 1), summary = monthlySummary(data, target), display = budgetDisplay(summary.available);
  return <section className="panel budget-forecast" aria-label={`Orçamento de ${monthLabel(target)}`}><p className="eyebrow">ORÇAMENTO DO PRÓXIMO MÊS</p><h2>{monthLabel(target)}</h2><span className="forecast-result-label">{display.label}</span><strong className={`forecast-result ${display.shortfall ? 'shortfall' : ''}`}>{money(display.amount)}</strong><p className="forecast-status">{display.shortfall ? 'Esse valor ainda precisa ser coberto. Não é dinheiro disponível.' : 'Valor estimado após despesas e desejos reservados.'}</p><div className="forecast-formula"><div><span>Renda média informada</span><strong>{money(summary.baseIncome)}</strong></div><div><span>Receitas extras recebidas nesse mês</span><strong>{money(summary.extraIncome)}</strong></div><div><span>Despesas à vista</span><strong>{money(summary.cash)}</strong></div><div><span>Faturas com vencimento no mês</span><strong>{money(summary.cardTotal)}</strong></div><div><span>Desejos reservados</span><strong>{money(summary.reserved)}</strong></div></div><p className="budget-source">Cálculo: renda média + extras deste mês − despesas − faturas − reservas. Extras de outros meses não são repetidos.{!summary.baseIncome && (data.income_plans.some(p => p.start_month <= target) ? ' A renda média informada para este mês é zero.' : ' A renda média ainda não foi informada para este mês.')}</p><Link className="text-link" to="/configuracoes#renda">Informar ou ajustar minha renda média →</Link></section>;
}


