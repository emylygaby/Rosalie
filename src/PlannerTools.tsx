import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Empty, Saved } from './components';
import { addDays, dateLabel, today, uid, type PlannerTask } from './domain';
import { useStore } from './store';
import type { PageActions } from './App';

export function PlannerTools({ actions, selected }: { actions: PageActions; selected: string }) {
  const { data, month, mutate, saving } = useStore();
  const [title, setTitle] = useState(''), [due, setDue] = useState(selected || `${month}-01`), [priority, setPriority] = useState<PlannerTask['priority']>('Normal'), [editing, setEditing] = useState(''), [habit, setHabit] = useState(''), [error, setError] = useState('');
  const note = data.planner_notes.find(n => n.month === month);
  const [focus, setFocus] = useState(note?.focus ?? ''), [notes, setNotes] = useState(note?.notes ?? ''), [saved, setSaved] = useState(false);
  const anchor = selected || (today().startsWith(month) ? today() : `${month}-01`);
  const weekDay = new Date(`${anchor}T12:00:00Z`).getUTCDay(), monday = addDays(anchor, -((weekDay + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const tasks = data.tasks.filter(t => t.due_date.startsWith(month)).sort((a, b) => a.done === b.done ? a.due_date.localeCompare(b.due_date) : Number(a.done) - Number(b.done));
  async function saveTask(e: FormEvent) {
    e.preventDefault(); setError('');
    try { if (!title.trim()) throw new Error('Dê um nome à tarefa.'); const task: PlannerTask = { id: editing || uid(), title: title.trim(), due_date: due, priority, done: data.tasks.find(t => t.id === editing)?.done ?? false }; await mutate(d => ({ ...d, tasks: [...d.tasks.filter(t => t.id !== task.id), task] })); setTitle(''); setEditing(''); }
    catch (e) { setError((e as Error).message); }
  }
  async function addHabit(e: FormEvent) {
    e.preventDefault(); setError('');
    try { if (!habit.trim()) throw new Error('Dê um nome ao hábito.'); await mutate(d => ({ ...d, habits: [...d.habits, { id: uid(), name: habit.trim() }] })); setHabit(''); } catch (e) { setError((e as Error).message); }
  }
  async function saveNotes(e: FormEvent) {
    e.preventDefault(); setSaved(false); setError('');
    try { await mutate(d => ({ ...d, planner_notes: [...d.planner_notes.filter(n => n.month !== month), { id: note?.id ?? uid(), month, focus: focus.trim(), notes: notes.trim() }] })); setSaved(true); } catch (e) { setError((e as Error).message); }
  }
  return <div className="planner-tools">
    <section className="panel task-panel"><div className="section-heading"><h2>Tarefas e prioridades</h2><Badge>{tasks.filter(t => t.done).length}/{tasks.length}</Badge></div><p className="section-description">Transforme os planos do mês em pequenos passos.</p>
      <form onSubmit={saveTask} className="planner-task-form"><label className="field"><span>Tarefa</span><input value={title} onChange={e => setTitle(e.target.value)} required maxLength={120} placeholder="Ex.: organizar material da faculdade"/></label><div className="form-grid"><label className="field"><span>Dia da tarefa</span><input type="date" value={due} onChange={e => setDue(e.target.value)} required min="2000-01-01" max="2099-12-31"/></label><label className="field"><span>Prioridade</span><select value={priority} onChange={e => setPriority(e.target.value as PlannerTask['priority'])}><option>Alta</option><option>Normal</option><option>Baixa</option></select></label></div><Button type="submit" disabled={saving}><Plus size={16}/>{editing ? 'Salvar tarefa' : 'Adicionar tarefa'}</Button>{editing && <button type="button" className="text-link" onClick={() => { setEditing(''); setTitle(''); }}>Cancelar edição</button>}</form>
      <div className="planner-task-list">{tasks.length ? tasks.map(task => <div className={`planner-task ${task.done ? 'completed' : ''}`} key={task.id}><input type="checkbox" aria-label={`Concluir tarefa ${task.title}`} checked={task.done} disabled={saving} onChange={() => actions.act(() => mutate(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t) })))}/><div><strong>{task.title}</strong><small>{dateLabel(task.due_date)} · prioridade {task.priority.toLocaleLowerCase('pt-BR')}</small></div><button className="icon-btn" aria-label={`Editar tarefa ${task.title}`} onClick={() => { setEditing(task.id); setTitle(task.title); setDue(task.due_date); setPriority(task.priority); }}><Pencil size={15}/></button><button className="icon-btn danger" aria-label={`Excluir tarefa ${task.title}`} onClick={() => actions.confirm({ title: 'Excluir tarefa?', detail: 'A tarefa será removida do seu planejamento.', onConfirm: () => mutate(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== task.id) })) })}><Trash2 size={15}/></button></div>) : <Empty title="Um passo de cada vez" detail="Crie sua primeira tarefa para este mês."/>}</div>
    </section>
    <section className="panel habit-panel"><h2>Hábitos da semana</h2><p className="section-description">{dateLabel(week[0])} a {dateLabel(week[6])}. Selecione um dia no calendário para mudar a semana.</p><form onSubmit={addHabit}><label className="field"><span>Novo hábito</span><input value={habit} onChange={e => setHabit(e.target.value)} required maxLength={80} placeholder="Ex.: ler por 15 minutos"/></label><Button type="submit" secondary disabled={saving}>Adicionar hábito</Button></form><div className="habit-list">{data.habits.map(h => <div className="habit-row" key={h.id}><div className="habit-title"><strong>{h.name}</strong><button className="icon-btn danger" aria-label={`Excluir hábito ${h.name}`} onClick={() => actions.confirm({ title: 'Excluir hábito?', detail: 'O hábito e seu histórico de marcações serão removidos.', onConfirm: () => mutate(d => ({ ...d, habits: d.habits.filter(v => v.id !== h.id), habit_checks: d.habit_checks.filter(c => c.habit_id !== h.id) })) })}><Trash2 size={15}/></button></div><div className="habit-days">{week.map(date => { const checked = data.habit_checks.some(c => c.habit_id === h.id && c.date === date); return <button key={date} className={checked ? 'checked' : ''} aria-label={`${h.name}, ${dateLabel(date)}`} aria-pressed={checked} disabled={saving} onClick={() => actions.act(() => mutate(d => ({ ...d, habit_checks: checked ? d.habit_checks.filter(c => !(c.habit_id === h.id && c.date === date)) : [...d.habit_checks, { id: uid(), habit_id: h.id, date }] })))}><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</span>{checked ? <Check size={16}/> : <small>{date.slice(8)}</small>}</button>; })}</div><small className="muted">{data.habit_checks.filter(c => c.habit_id === h.id && week.includes(c.date)).length} de 7 dias nesta semana</small></div>)}</div>
    </section>
    <section className="panel planner-note-panel"><h2>Intenções e anotações</h2><p className="section-description">Guarde o foco e as reflexões deste mês.</p><form onSubmit={saveNotes}><label className="field"><span>Meu foco do mês</span><input value={focus} onChange={e => { setFocus(e.target.value); setSaved(false); }} maxLength={180} placeholder="O que merece minha atenção?"/></label><label className="field"><span>Anotações do planner</span><textarea rows={5} value={notes} onChange={e => { setNotes(e.target.value); setSaved(false); }} maxLength={4000} placeholder="Ideias, aprendizados e próximos passos…"/></label><div className="form-actions">{saved && <Saved text="Anotações salvas"/>}<Button type="submit" disabled={saving}>Salvar anotações</Button></div></form></section>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
