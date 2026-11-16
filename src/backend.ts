import { createClient } from '@supabase/supabase-js';
import { localTimestamp, uid, type AppData, type PlannerEvent } from './domain';
import { AUTH_STORAGE_KEY, ownedImagePath, sanitizeSnapshot, validatePublicBackend } from './security';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
validatePublicBackend(url || '', key || '');
// Tokens da versão anterior não são migrados para uma sessão persistente.
if (url) localStorage.removeItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`);
export const supabase = url && key ? createClient(url, key, { auth: { storage: sessionStorage, storageKey: AUTH_STORAGE_KEY } }) : null;
export async function revokeSession(accessToken: string) {
  // Captura o token em memória antes de apagar a sessão local. Nunca persistir/logar.
  const response = await fetch(`${new URL(url!).origin}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: key!, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok && response.status !== 401 && response.status !== 403) throw new Error('signout_unconfirmed');
}
export const tableMap = { incomes: 'incomes', expenses: 'expenses', recurrences: 'recurrence_rules', cards: 'cards', purchases: 'card_purchases', installments: 'card_installments', statements: 'card_statements', wishes: 'wishlist_items', events: 'planner_events' } as const;
export async function loadCloud(userId: string, displayName = ''): Promise<{ data: AppData; revision: number }> {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.');
  const { error: initError } = await supabase.rpc('rosalie_initialize', { display_name: displayName });
  if (initError) throw new Error('Não foi possível iniciar o banco. Confira a migração do Supabase.');
  // A função retorna um snapshot consistente, evitando misturar revisões entre tabelas.
  const { data, error } = await supabase.rpc('rosalie_load');
  if (error || !data) throw new Error('Não foi possível carregar seus dados. Tente novamente.');
  if (data.user_id !== userId) throw new Error('Sessão inválida. Entre novamente.');
  const payload = sanitizeSnapshot(data.payload);
  payload.events = payload.events.map((e: PlannerEvent) => ({ ...e, start_at: localTimestamp(e.start_at), end_at: localTimestamp(e.end_at) }));
  return { data: payload, revision: data.revision };
}
export async function saveCloud(data: AppData, revision: number) {
  const { data: result, error } = await supabase!.rpc('rosalie_save', { payload: sanitizeSnapshot(data), expected_revision: revision });
  if (error) throw new Error(error.message.includes('revision_conflict') ? 'Seus dados mudaram em outra aba. Atualize a página antes de continuar.' : 'Não foi possível salvar. Confira sua conexão e tente novamente.');
  return result as number;
}
export async function uploadWishImage(file: File, userId: string | null): Promise<string> {
  const blob = await prepareImage(file, false);
  if (!userId) {
    if (file.size > 1024 * 1024) throw new Error('Na demonstração, use imagens de até 1 MB.');
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(blob); });
  }
  const path = `${userId}/${uid()}.webp`;
  const { error } = await supabase!.storage.from('wishlist').upload(path, blob, { upsert: false, contentType: 'image/webp', cacheControl: '60' });
  if (error) throw new Error('Não foi possível enviar a imagem. Confira o bucket e as políticas de acesso.');
  return path;
}
async function prepareImage(file: File, avatar: boolean): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) throw new Error('Escolha uma foto JPG, PNG ou WebP de até 3 MB.');
  const bitmap = await createImageBitmap(file);
  if (bitmap.width > 12000 || bitmap.height > 12000 || bitmap.width * bitmap.height > 32000000) { bitmap.close(); throw new Error('A imagem tem dimensões excessivas. Reduza-a antes de enviar.'); }
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  canvas.width = avatar ? 256 : Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = avatar ? 256 : Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('Não foi possível preparar a foto.'); }
  const size = Math.min(bitmap.width, bitmap.height);
  if (avatar) context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
  else context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Não foi possível preparar a foto.')), 'image/webp', .85));
  if (blob.type !== 'image/webp' || blob.size > 3 * 1024 * 1024) throw new Error('Não foi possível preparar uma imagem segura. Tente outra imagem.');
  return blob;
}
export async function uploadProfileImage(file: File, userId: string | null): Promise<string> {
  const blob = await prepareImage(file, true);
  if (!userId) return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a foto.')); reader.readAsDataURL(blob); });
  const path = `${userId}/${uid()}.webp`;
  const { error } = await supabase!.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', cacheControl: '60' });
  if (error) throw new Error('Não foi possível salvar a foto. Confira sua conexão e a migração do banco.');
  return path;
}
export async function cleanupRemovedImages(previous: AppData, next: AppData, owner: string) {
  const paths = (data: AppData) => new Set([data.profile.avatar_path, ...data.wishes.map(w => w.image_path)]);
  const current = paths(next);
  const oldAvatar = previous.profile.avatar_path;
  for (const path of paths(previous)) if (path && !current.has(path) && ownedImagePath(path, owner)) {
    const bucket = path === oldAvatar ? 'avatars' : 'wishlist';
    const { error } = await supabase!.storage.from(bucket).remove([path]);
    if (error) throw new Error('Os registros foram salvos, mas uma imagem antiga ainda não pôde ser removida. Tente a limpeza de arquivos em Privacidade.');
  }
}
export async function removeProfileImage(path: string) {
  if (!path || path.startsWith('data:') || !supabase) return;
  const { error } = await supabase.storage.from('avatars').remove([path]);
  if (error) throw new Error('O perfil foi salvo, mas a foto anterior ainda não pôde ser removida do armazenamento.');
}
