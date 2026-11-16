import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { deletionHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const client = (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
const origins = (Deno.env.get('APP_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
Deno.serve(deletionHandler({
  async authenticate(token) {
    const { data, error } = await client(token).auth.getUser(token);
    if (error || !data.user) return null;
    // Somente após o servidor Auth verificar a assinatura e o usuário.
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
    if (claims.sub !== data.user.id) return null;
    const passwordAt = Math.max(0, ...(Array.isArray(claims.amr) ? claims.amr : []).filter((a: { method: string }) => a.method === 'password').map((a: { timestamp: number }) => Number(a.timestamp) || 0));
    return { id: data.user.id, passwordAt };
  },
  async freeze(id) { const { data, error } = await admin.from('profiles').update({ deletion_requested_at: new Date().toISOString() }).eq('user_id', id).select('user_id'); if (error || data?.length !== 1) throw new Error('freeze_failed'); },
  async files(token) { const { data, error } = await client(token).rpc('rosalie_owned_files', { batch_limit: 100 }); if (error) throw new Error('list_failed'); return data ?? []; },
  async remove(bucket, paths) { const { error } = await admin.storage.from(bucket).remove(paths); if (error) throw new Error('storage_failed'); },
  async deleteUser(id) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw new Error('delete_failed'); },
}, origins));
