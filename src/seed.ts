import { addPurchase, emptyData, uid, type AppData } from './domain';
export function demoData(): AppData {
  const data = emptyData();
  data.profile.name = 'Rosalie';
  data.income_plans = [{ id: uid(), amount: 280000, start_month: '2026-12' }];
  const nubank = uid(), santander = uid();
  data.cards = [ { id: nubank, name: 'Nubank', brand: 'Mastercard', closing_day: 25, due_day: 5, credit_limit: 300000, color: '#79618D' }, { id: santander, name: 'Santander', brand: 'Visa', closing_day: 20, due_day: 1, credit_limit: 200000, color: '#A45A6E' } ];
  data.recurrences = [ { id: uid(), description: 'Água', amount: 4000, category: 'Moradia', day: 10, start_month: '2026-12', end_month: null, method: 'pix', active: true }, { id: uid(), description: 'Internet', amount: 9500, category: 'Moradia', day: 15, start_month: '2026-12', end_month: null, method: 'pix', active: true } ];
  data.wishes = [{ id: uid(), name: 'Perfume', amount: 18000, category: 'Beleza/cuidados', priority: 'Alta', url: '', image_path: '', status: 'reserved', planned_month: '2026-12', purchase_id: null }];
  data.events = [{ id: uid(), title: 'Consulta', description: 'Um momento para cuidar de você.', start_at: '2026-12-10T14:00:00-03:00', end_at: '2026-12-10T15:00:00-03:00', reminder_minutes: 1440, done: false }];
  let next = addPurchase(data, { id: uid(), card_id: nubank, description: 'Body splash', amount: 12000, category: 'Beleza/cuidados', date: '2026-11-26', count: 6 }, '2026-12');
  next = addPurchase(next, { id: uid(), card_id: santander, description: 'Mercado', amount: 15000, category: 'Alimentação', date: '2026-11-22', count: 1 }, '2026-12');
  return next;
}
