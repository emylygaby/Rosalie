import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Diamond, Heart, Info, Plus, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge, Button, Empty, MonthPicker, SectionTitle } from './components';
import { useStore } from './store';
import { addMonths, budgetDisplay, categoryTotals, dateInMonth, dateLabel, greeting, money, monthlySummary, monthLabel, statementPaid, statementTotal, today } from './domain';
import { BudgetForecast } from './IncomePlanning';
import type { PageActions } from './App';
export const chartColors = ['#B86C87', '#DED3EB', '#EADBC6', '#809C8A', '#C8A8B5', '#A9A7CD', '#A26F80', '#D7BC9C', '#7D3654'];
export function CategoryChart({ compact = false }: { compact?: boolean }) {
  const { data, month } = useStore(), values = categoryTotals(data, month);
  if (!values.length) return <Empty title="Seu gráfico vai florescer" detail="Adicione despesas para conhecer suas categorias."/>;
  return <div className={`category-chart ${compact ? 'compact-chart' : ''}`}><div className="donut-wrap" role="img" aria-label={`Despesas por categoria: ${values.map(v => `${v.name} ${money(v.value)}`).join('; ')}`}><ResponsiveContainer width="100%" height={compact ? 190 : 230}><PieChart><Pie isAnimationActive={false} data={values} dataKey="value" nameKey="name" innerRadius={compact ? 60 : 76} outerRadius={compact ? 82 : 102} paddingAngle={4} stroke="none">{values.map((v, i) => <Cell key={v.name} fill={chartColors[i % chartColors.length]}/>)}</Pie><Tooltip formatter={value => money(Number(value))}/></PieChart></ResponsiveContainer><div className="donut-center"><span>DESPESAS</span><strong>{money(values.reduce((sum, v) => sum + v.value, 0))}</strong></div></div><div className="chart-legend">{values.map((v, i) => <div key={v.name}><span className="legend-name"><i style={{ background: chartColors[i % chartColors.length] }}/>{v.name}</span><strong>{money(v.value)}</strong></div>)}</div></div>;
}
export function Dashboard({ edit }: PageActions) {
  const [analysisOpen, setAnalysisOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const { data, month } = useStore(), summary = monthlySummary(data, month);
  const display = budgetDisplay(summary.available);
  const events = data.events.filter(e => e.start_at.startsWith(month) && !e.done).sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 2);
  const wishes = data.wishes.filter(w => w.status === 'reserved' && (w.planned_month === month || w.planned_month === addMonths(month, 1)));
  const percent = summary.income ? Math.min(100, Math.round((summary.expenses + summary.reserved) / summary.income * 100)) : null;
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const currentDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
  const name = data.profile.name.trim();
  return <div className="dashboard-page">
    <div className="dashboard-heading">
      <div><h1>{greeting()}{name ? `, ${name}` : ''} <span aria-hidden="true">♡</span></h1><p>{name ? `Bem-vinda, ${name}. ` : 'Bem-vinda. '}<time dateTime={today()}>{currentDate}</time> · Sua visão do mês</p></div>
      <Button className="dashboard-add" onClick={() => edit({ kind: 'expense' })}><Plus size={16}/>Novo lançamento</Button>
    </div>
    <div className="dashboard-grid">
      <section className="month-overview" aria-label="Resumo do orçamento mensal">
        <div className="overview-top"><span className="eyebrow">{display.label} · {monthName}</span><span className="balance-help" tabIndex={0} aria-label="Renda média informada mais extras recebidos neste mês, menos despesas, faturas e reservas. Não representa saldo bancário." title="Média informada + extras do mês − despesas − faturas − reservas."><Info size={16}/></span></div>
        <strong className={`balance ${display.shortfall ? 'negative-balance' : ''}`}>{money(display.amount)}</strong>
        <p className="overview-caption">{display.shortfall ? 'Esse valor ainda precisa ser coberto; não está disponível.' : 'Após contas, faturas e compras reservadas'}</p>
        <p className="current-income-source">Base informada: {money(summary.baseIncome)} + extras do mês: {money(summary.extraIncome)}</p>
        {percent !== null && <div className="budget-track" role="meter" aria-label="Receita comprometida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></div>}
        <div className="hero-month-row"><MonthPicker/><span>{percent === null ? 'Sem receita de referência para o percentual' : `${percent}% comprometidos`}</span></div>
      </section>
      <div className="dashboard-forecast"><BudgetForecast/></div>
      <div className="metric-stack">
        <div className="metric"><ArrowDownLeft size={16}/><div><span>Entradas previstas</span><strong>{money(summary.income)}</strong></div></div>
        <div className="metric"><ArrowUpRight size={16}/><div><span>Saídas previstas</span><strong>{money(summary.expenses)}</strong></div></div>
        <div className="metric"><Heart size={16}/><div><span>Reservas de desejos</span><strong>{money(summary.reserved)}</strong></div></div>
      </div>
      <section className="panel cards-panel">
        <SectionTitle title="Meus cartões" to="/cartoes"/>
        <div className="mini-cards">{data.cards.slice(0, 2).map((card, index) => <Link to={`/cartoes/${card.id}`} key={card.id} className="mini-card" style={{ '--card-surface': index % 2 ? '#F1EAF6' : '#F8DFE7', '--card-color': '#7D3654' } as React.CSSProperties}>
          <div className="mini-card-top"><Diamond size={15}/><strong>{card.name}</strong><ChevronRight size={15}/></div>
          <strong className="mini-card-amount">{money(statementTotal(data, card.id, month))}</strong>
          <div className="mini-card-bottom"><span>Vence em {dateLabel(dateInMonth(month, card.due_day))}</span><Badge tone={statementPaid(data, card.id, month) ? 'positive' : ''}>{statementPaid(data, card.id, month) ? 'Paga' : 'Em aberto'}</Badge></div>
        </Link>)}</div>
        {!data.cards.length && <Empty title="Cada cartão no seu lugar" detail="Cadastre um cartão para acompanhar suas faturas."/>}
        <div className="panel-footer"><span><Wallet size={15}/>A pagar no mês de vencimento</span><strong>{money(summary.payable)}</strong></div>
      </section>
      <section className="panel events-panel">
        <SectionTitle title="Meu planner" to="/planner" linkLabel="Calendário"/>
        <div className="event-list">{events.map(event => <Link to="/planner" className="event-preview" key={event.id}>
          <div className="event-date"><strong>{event.start_at.slice(8, 10)}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(event.start_at)).replace('.', '')}</span></div>
          <div><strong>{event.title}</strong><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(event.start_at))} · {data.preferences.reminders ? 'Lembrete ativo' : 'Sem aviso interno'}</span></div>
          <ChevronRight size={15}/>
        </Link>)}</div>
        {!events.length && <Empty title="Espaço para novos planos" detail="Nenhum compromisso neste mês."/>}
        <button className="subtle-button" onClick={() => edit({ kind: 'event' })}><Plus size={15}/>Adicionar compromisso</button>
      </section>
      <section className="panel planned-panel">
        <SectionTitle title="♡ Lista de desejos" to="/desejos" linkLabel="Ver lista"/>
        <p className="planned-intro">Um carinho para seus próximos planos</p>
        {wishes.length ? wishes.slice(0, 3).map(wish => <div className="planned-wish" key={wish.id}>
          <button className="planned-wish-row" onClick={() => edit({ kind: 'buy', item: wish })} aria-label={`Realizar desejo ${wish.name}`}><Diamond size={13}/><strong>{wish.name}</strong><span>{money(wish.amount)}</span></button>
          <small>Valor reservado no orçamento de {monthLabel(wish.planned_month!)}</small>
        </div>) : <Empty title="Um sonho de cada vez" detail="Escolha um desejo e reserve um mês para ele."/>}
        <p className="reservation-note">Reservas afetam o planejamento até a compra.</p>
      </section>
      <section className="panel expenses-panel dashboard-analysis">
        <details open={analysisOpen} onToggle={event => setAnalysisOpen(event.currentTarget.open)}><summary>Seu mês por categoria <span>Ver análise</span></summary><p className="section-description">Despesas e faturas com vencimento em {monthLabel(month)}.</p><CategoryChart compact/></details>
      </section>
    </div>
    <div className="dashboard-budget-note"><Info size={13}/><span>Orçamento sem saldo inicial. Não é o saldo da sua conta.</span></div>
  </div>;
}

