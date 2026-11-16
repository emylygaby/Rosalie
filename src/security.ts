import { normalizeData, type AppData } from './domain';

export const AUTH_STORAGE_KEY = 'rosalie.auth.v2';
export const POLICY_VERSION = '2026-11-16.2';
export const SIGNED_IMAGE_SECONDS = 60;
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export function assertNoPrivateFrontendEnv(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) {
    if (!value || !name.startsWith('VITE_')) continue;
    if (/SERVICE_ROLE|SECRET|PASSWORD|DATABASE|PRIVATE_KEY/i.test(name) || value.startsWith('sb_secret_')) throw new Error('Configuração secreta proibida em variável pública VITE_.');
    if (value.split('.').length === 3) { try { const claim = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (claim.role === 'service_role') throw new Error('private_frontend_key'); } catch (e) { if ((e as Error).message === 'private_frontend_key') throw new Error('Chave administrativa proibida em variável pública VITE_.'); } }
  }
}
export function validatePublicBackend(url: string, key: string) {
  if (!url && !key) return;
  if (!url || !key) throw new Error('Configuração pública do Supabase incompleta.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Use uma URL HTTPS válida do Supabase.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error('Use uma URL HTTPS válida do Supabase.');
  if (key.startsWith('sb_secret_')) throw new Error('Chave secreta proibida no frontend. Use somente uma chave pública.');
  if (key.startsWith('sb_publishable_')) return;
  try { const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (payload.role !== 'anon') throw new Error(); }
  catch { throw new Error('Use apenas uma chave pública publicável/anon no frontend.'); }
}
export function safeProductUrl(raw: string): string {
  try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function safeLocalImage(raw: string) { return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= 1500000; }
export function ownedImagePath(path: string, owner: string) { return path.startsWith(owner + '/') && !path.includes('..') && !/[\x00-\x1F\\]/.test(path) && path.split('/').every(p => p.length > 0); }

const rowKeys: Record<string, string[]> = {
  income_plans: ['id', 'amount', 'start_month'], tasks: ['id', 'title', 'due_date', 'priority', 'done'], habits: ['id', 'name'], habit_checks: ['id', 'habit_id', 'date'], planner_notes: ['id', 'month', 'focus', 'notes'],
  incomes: ['id', 'description', 'amount', 'date', 'received_date', 'category'], expenses: ['id', 'description', 'amount', 'category', 'due_date', 'paid_date', 'method', 'recurrence_id', 'skipped'], recurrences: ['id', 'description', 'amount', 'category', 'day', 'start_month', 'end_month', 'method', 'active'], cards: ['id', 'name', 'brand', 'closing_day', 'due_day', 'credit_limit', 'color'], purchases: ['id', 'card_id', 'description', 'amount', 'category', 'date', 'count'], installments: ['id', 'purchase_id', 'card_id', 'number', 'amount', 'statement_month'], statements: ['id', 'card_id', 'statement_month', 'paid_date'], wishes: ['id', 'name', 'amount', 'category', 'priority', 'url', 'image_path', 'status', 'planned_month', 'purchase_id'], events: ['id', 'title', 'description', 'start_at', 'end_at', 'reminder_minutes', 'done'],
};
export function sanitizeSnapshot(raw: Partial<AppData>): AppData {
  const data = normalizeData(raw), clean = { ...data } as unknown as Record<string, unknown>;
  for (const [key, fields] of Object.entries(rowKeys)) {
    const rows = (data as unknown as Record<string, unknown[]>)[key];
    if (rows.length > 1000) throw new Error('Limite de 1.000 registros por coleção atingido. Exporte seus dados e revise o histórico.');
    clean[key] = rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Registro inválido. Preserve uma cópia antes de restaurar.');
      return Object.fromEntries(fields.filter(k => Object.hasOwn(row, k)).map(k => [k, (row as Record<string, unknown>)[k]]));
    });
  }
  if (JSON.stringify(clean).length > 6000000) throw new Error('O conjunto de dados excede o limite local. Exporte e reduza as imagens.');
  return clean as unknown as AppData;
}
export function clearOwnerLocalData(owner: string) {
  for (const prefix of ['rosalie.cycle.v1.', 'rosalie.cycle.v2.']) localStorage.removeItem(prefix + owner);
  if (owner === 'demo') { localStorage.removeItem('rosalie.demo.v1'); localStorage.removeItem('rosalie.demo.updated'); sessionStorage.removeItem('rosalie.demo.session'); }
  localStorage.removeItem('rosalie.has_accessed');
}
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadFile(filename, blob);
}
export function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
