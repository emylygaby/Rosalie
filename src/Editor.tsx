import { safeProductUrl } from './security';
import { useState, type FormEvent } from 'react';
import { Info, LoaderCircle } from 'lucide-react';
import { Button, Modal } from './components';
import { useStore } from './store';
import { uploadWishImage, supabase } from './backend';
import { addMonths, addPurchase, buyWish, categories, firstStatementMonth, moneyInput, parseMoney, putExpense, today, uid, type AppData, type Card, type Expense, type Income, type PlannerEvent, type Recurrence, type Wish, type Category } from './domain';

export type EditRequest = { kind: 'income'; item?: Income } | { kind: 'expense'; item?: Expense } | { kind: 'card'; item?: Card } | { kind: 'purchase'; cardId: string } | { kind: 'wish'; item?: Wish } | { kind: 'reserve'; item: Wish } | { kind: 'buy'; item: Wish } | { kind: 'event'; item?: PlannerEvent; date?: string } | { kind: 'recurrence'; item: Recurrence };
const titles = { income: 'Nova receita', expense: 'Nova despesa', card: 'Novo cartão', purchase: 'Nova compra no cartão', wish: 'Um novo desejo', reserve: 'Planejar uma compra', buy: 'Realizar um desejo', event: 'Novo compromisso', recurrence: 'Editar despesa fixa' };
function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) { return <label className="field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>; }
function CategoryField({ value = 'Outros' }: { value?: string }) { return <Field label="Categoria"><select name="category" defaultValue={value}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field>; }
export function Editor({ request, onClose }: { request: EditRequest; onClose: () => void }) {
  const { data, month, mutate, userId, isDemo } = useStore();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [cardId, setCardId] = useState(request.kind === 'purchase' ? request.cardId : '');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const card = data.cards.find(c => c.id === cardId);
  const [firstMonth, setFirstMonth] = useState(card ? firstStatementMonth(card, purchaseDate) : month);
  const [recurring, setRecurring] = useState(false);
  const item = 'item' in request ? request.item : undefined;
  const itemCategory = item && 'category' in item ? item.category : 'Outros';
  const isMoney = ['income', 'expense', 'purchase', 'wish', 'buy', 'recurrence'].includes(request.kind);
  const label = (item && !['reserve', 'buy', 'recurrence'].includes(request.kind) ? 'Editar ' + ({ income: 'receita', expense: 'despesa', card: 'cartão', wish: 'desejo', event: 'compromisso' }[request.kind as 'income'] ?? '') : titles[request.kind]);
  function updateCard(id: string) { setCardId(id); const nextCard = data.cards.find(c => c.id === id); if (nextCard) setFirstMonth(firstStatementMonth(nextCard, purchaseDate)); }
  function updateDate(date: string) { setPurchaseDate(date); if (card && date) setFirstMonth(firstStatementMonth(card, date)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget), value = (key: string) => String(form.get(key) ?? '').trim();
    let uploadedPath = '';
    try {
      const amount = isMoney ? parseMoney(value('amount')) : 0;
      const category = value('category') as Category;
      const description = value('description');
      if (!['reserve', 'buy'].includes(request.kind) && !description) throw new Error('Preencha uma descrição para continuar.');
      const file = form.get('image');
      if (file instanceof File && file.size && !form.has('remove_image')) uploadedPath = await uploadWishImage(file, userId);
      const snapshotImage = uploadedPath;
      await mutate(current => {
        let next: AppData = current;
        switch (request.kind) {
          case 'income': {
            const received = value('received_date');
            if (!received || received > today()) throw new Error('Informe a data em que a receita foi recebida, até hoje.');
            const income: Income = { id: request.item?.id ?? uid(), description, amount, date: received, received_date: received, category: value('income_category') };
            next = { ...current, incomes: [...current.incomes.filter(i => i.id !== income.id), income] }; break;
          }
          case 'expense': {
            const date = value('date');
            if (request.item?.recurrence_id && date.slice(0, 7) !== request.item.due_date.slice(0, 7)) throw new Error('Para uma despesa fixa, mantenha o vencimento no mês da ocorrência. Você pode alterar o dia.');
            let recurrence_id = request.item?.recurrence_id ?? null;
            if (recurring && !recurrence_id) {
              recurrence_id = uid();
              const recurrence: Recurrence = { id: recurrence_id, description, amount, category, day: Number(date.slice(8)), start_month: date.slice(0, 7), end_month: null, method: value('method'), active: true };
              next = { ...current, recurrences: [...current.recurrences, recurrence] };
            }
            next = putExpense(next, { id: request.item?.id ?? uid(), description, amount, category, due_date: date, paid_date: form.has('paid') ? value('paid_date') || today() : null, method: value('method'), recurrence_id }); break;
          }
          case 'card': {
            const newCard: Card = { id: request.item?.id ?? uid(), name: description, brand: value('brand'), closing_day: Number(value('closing_day')), due_day: Number(value('due_day')), credit_limit: value('credit_limit') ? parseMoney(value('credit_limit')) : null, color: value('color') };
            next = { ...current, cards: [...current.cards.filter(c => c.id !== newCard.id), newCard] }; break;
          }
          case 'purchase': {
            next = addPurchase(current, { id: uid(), description, category, card_id: cardId, amount, count: Number(value('count')), date: purchaseDate }, firstMonth); break;
          }
          case 'wish': {
            if (value('url') && !safeProductUrl(value('url'))) throw new Error('Use um link HTTPS sem usuário ou senha na URL.');
            const wish: Wish = { id: request.item?.id ?? uid(), name: description, amount, category, priority: value('priority'), url: value('url'), image_path: form.has('remove_image') ? '' : snapshotImage || request.item?.image_path || '', status: request.item?.status ?? 'desired', planned_month: request.item?.planned_month ?? null, purchase_id: request.item?.purchase_id ?? null };
            next = { ...current, wishes: [...current.wishes.filter(w => w.id !== wish.id), wish] }; break;
          }
          case 'reserve': next = { ...current, wishes: current.wishes.map(w => w.id === request.item.id ? { ...w, status: 'reserved', planned_month: value('planned_month') } : w) }; break;
          case 'buy': next = buyWish({ ...current, wishes: current.wishes.map(w => w.id === request.item.id ? { ...w, amount } : w) }, request.item.id, purchaseDate, cardId || null, Number(value('count') || '1'), firstMonth); break;
          case 'event': {
            const start_at = `${value('start_at')}:00-03:00`, end_at = `${value('end_at')}:00-03:00`;
            if (new Date(end_at) <= new Date(start_at)) throw new Error('O horário de término deve ser posterior ao início.');
            const event: PlannerEvent = { id: request.item?.id ?? uid(), title: description, description: value('notes'), start_at, end_at, reminder_minutes: Number(value('reminder')), done: request.item?.done ?? false };
            next = { ...current, events: [...current.events.filter(e => e.id !== event.id), event] }; break;
          }
          case 'recurrence': {
            const end_month = null;
            next = { ...current, recurrences: current.recurrences.map(r => r.id === request.item.id ? { ...r, description, amount, category, day: Number(value('day')), end_month, active: form.has('active') } : r) }; break;
          }
        }
        return next;
      });
      onClose();
    } catch (e) {
      if (uploadedPath && userId) await supabase!.storage.from('wishlist').remove([uploadedPath]);
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally { setBusy(false); }
  }
  const descriptionValue = item && ('description' in item && request.kind !== 'event' ? item.description : 'name' in item ? item.name : 'title' in item ? item.title : '');
  const amountValue = item && 'amount' in item ? item.amount : undefined;
  return <Modal title={label} onClose={() => !busy && onClose()}><form onSubmit={submit}>
    {request.kind === 'reserve' || request.kind === 'buy' ? <div className="form-note"><Info size={19}/><p>{request.item.name}{request.kind === 'reserve' ? ' será descontado apenas do orçamento planejado. A despesa só será criada quando você confirmar a compra.' : ': a reserva será removida e a compra será registrada em uma única operação.'}</p></div> : <Field label={request.kind === 'event' ? 'Título do compromisso' : request.kind === 'card' ? 'Nome do cartão' : request.kind === 'wish' ? 'O que você deseja?' : 'Descrição'}><input name="description" defaultValue={descriptionValue || ''} required maxLength={120} placeholder={request.kind === 'wish' ? 'Ex.: aquele perfume especial' : 'Dê um nome ao seu registro'} /></Field>}
    {isMoney && <div className="form-grid"><Field label={request.kind === 'buy' ? 'Valor da compra (R$)' : 'Valor (R$)'}><input name="amount" inputMode="decimal" required defaultValue={moneyInput(amountValue)} placeholder="0,00" maxLength={18}/></Field>{request.kind === 'income' ? <Field label="Categoria"><input name="income_category" defaultValue={request.item?.category ?? 'Extra'} required maxLength={60}/></Field> : request.kind !== 'buy' && <CategoryField value={itemCategory}/>}</div>}
    {request.kind === 'income' && <><Field label="Data do recebimento"><input name="received_date" type="date" required defaultValue={request.item?.received_date ?? request.item?.date ?? today()} min="2000-01-01" max={today()}/></Field><p className="form-note">Receita adicional à sua renda média. O valor será somado somente ao orçamento do mês deste recebimento.</p></>}
    {request.kind === 'expense' && <>
      <div className="form-grid"><Field label="Vencimento"><input name="date" type="date" required defaultValue={request.item?.due_date ?? `${month}-05`} min="2000-01-01" max="2099-12-31"/></Field><Field label="Meio de pagamento"><select name="method" defaultValue={request.item?.method ?? 'pix'}><option value="pix">Pix</option><option value="debito">Débito</option><option value="dinheiro">Dinheiro</option></select></Field></div>
      <div className="form-grid"><label className="check-field"><input type="checkbox" name="paid" defaultChecked={!!request.item?.paid_date}/>Despesa já paga</label><Field label="Data do pagamento" help="Usada quando o status acima estiver marcado."><input name="paid_date" type="date" defaultValue={request.item?.paid_date ?? today()} min="2000-01-01" max="2099-12-31"/></Field></div>
      {!request.item?.recurrence_id && <><label className="check-field"><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}/>Repetir mensalmente como despesa fixa</label>{recurring && <p className="form-note">Sem data de término. A repetição continua enquanto a série estiver ativa; você pode pausá-la em Despesas fixas.</p>}</>}
      {request.item?.recurrence_id && <p className="form-note">Esta alteração vale apenas para a ocorrência deste mês. Edite a série em “Despesas fixas” para alterar os próximos meses.</p>}
    </>}
    {request.kind === 'card' && <><Field label="Bandeira (opcional)"><input name="brand" defaultValue={request.item?.brand ?? ''} placeholder="Visa, Mastercard…" maxLength={40}/></Field><div className="form-grid"><Field label="Dia de fechamento"><input name="closing_day" type="number" min="1" max="31" required defaultValue={request.item?.closing_day ?? 25}/></Field><Field label="Dia de vencimento"><input name="due_day" type="number" min="1" max="31" required defaultValue={request.item?.due_day ?? 5}/></Field></div><div className="form-grid"><Field label="Limite (R$, opcional)"><input name="credit_limit" inputMode="decimal" defaultValue={moneyInput(request.item?.credit_limit)} placeholder="0,00"/></Field><Field label="Cor do cartão"><select name="color" defaultValue={request.item?.color ?? '#79618D'}><option value="#79618D">Lilás</option><option value="#A45A6E">Rosa</option><option value="#557767">Verde</option><option value="#655E63">Grafite</option></select></Field></div><p className="form-note">Compras no dia do fechamento entram na próxima fatura. Você pode ajustar a primeira fatura ao lançar a compra.</p></>}
    {(request.kind === 'purchase' || request.kind === 'buy') && <><div className="form-grid"><Field label="Pagamento"><select value={cardId} onChange={e => updateCard(e.target.value)} required={request.kind === 'purchase'}>{request.kind === 'buy' && <option value="">Pix / à vista (pago)</option>}{data.cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Data da compra"><input type="date" required value={purchaseDate} onChange={e => updateDate(e.target.value)} min="2000-01-01" max="2099-12-31"/></Field></div>{cardId && <><div className="form-grid"><Field label="Número de parcelas"><input type="number" name="count" defaultValue="1" required min="1" max="120"/></Field><Field label="Primeira fatura (vencimento)"><input type="month" value={firstMonth} onChange={e => setFirstMonth(e.target.value)} required min="2000-01" max="2099-12"/></Field></div><p className="form-note">A primeira fatura é sugerida pelo fechamento. Confirme o mês de vencimento informado pelo banco; os centavos serão distribuídos sem alterar o total.</p></>}</>}
    {request.kind === 'wish' && <><div className="form-grid"><Field label="Prioridade"><select name="priority" defaultValue={request.item?.priority ?? 'Média'}><option>Alta</option><option>Média</option><option>Baixa</option></select></Field><Field label="Link do produto (opcional)"><input name="url" type="url" pattern="https://.*" defaultValue={request.item?.url ?? ''} placeholder="https://…" maxLength={2048}/></Field></div><Field label="Foto do desejo (opcional)" help={isDemo ? 'JPG, PNG ou WebP, até 1 MB. Salva neste navegador.' : 'JPG, PNG ou WebP, até 3 MB. Armazenamento privado.'}><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></Field>{request.item?.image_path && <label className="check-field"><input type="checkbox" name="remove_image"/>Remover foto atual</label>}</>}
    {request.kind === 'reserve' && <Field label="Mês planejado para comprar"><input type="month" name="planned_month" required defaultValue={request.item.planned_month ?? addMonths(month, 1)} min="2000-01" max="2099-12"/></Field>}
    {request.kind === 'event' && <><div className="form-grid"><Field label="Início"><input type="datetime-local" name="start_at" required defaultValue={request.item?.start_at.slice(0, 16) ?? `${request.date ?? `${month}-10`}T14:00`} min="2000-01-01T00:00" max="2099-12-31T23:59"/></Field><Field label="Término"><input type="datetime-local" name="end_at" required defaultValue={request.item?.end_at.slice(0, 16) ?? `${request.date ?? `${month}-10`}T15:00`} min="2000-01-01T00:00" max="2099-12-31T23:59"/></Field></div><Field label="Descrição (opcional)"><textarea name="notes" rows={3} maxLength={2000} defaultValue={request.item?.description ?? ''}/></Field><Field label="Aviso interno"><select name="reminder" defaultValue={request.item?.reminder_minutes ?? 1440}><option value="0">No horário</option><option value="30">30 minutos antes</option><option value="60">1 hora antes</option><option value="1440">1 dia antes</option><option value="10080">1 semana antes</option></select></Field><p className="form-note">Horários de Brasília. Os avisos aparecem enquanto o aplicativo está aberto e os lembretes estão ativados.</p></>}
    {request.kind === 'recurrence' && <><Field label="Dia do mês"><input type="number" name="day" required min="1" max="31" defaultValue={request.item.day}/></Field><label className="check-field"><input type="checkbox" name="active" defaultChecked={request.item.active}/>Série ativa</label><p className="form-note">A despesa se repete sem prazo final enquanto a série estiver ativa. Ocorrências já pagas ou editadas serão preservadas. Desmarque “Série ativa” para parar as próximas repetições.</p></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><Button secondary disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="spin"/>Salvando…</> : request.kind === 'buy' ? 'Confirmar compra' : request.kind === 'reserve' ? 'Reservar no orçamento' : 'Salvar'}</Button></div>
  </form></Modal>;
}

