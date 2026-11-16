export interface DeletionServices {
  authenticate: (token: string) => Promise<{ id: string; passwordAt: number } | null>;
  freeze: (id: string) => Promise<void>;
  files: (token: string) => Promise<{ bucket_id: string; name: string }[]>;
  remove: (bucket: string, paths: string[]) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}
export function deletionHandler(services: DeletionServices, origins: string[], now = () => Date.now()) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') ?? '';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
    const result = (status: number, message: string) => new Response(JSON.stringify({ message, ...(status === 200 ? { deleted: true } : {}) }), { status, headers });
    if (!origins.length) return result(503, 'Canal de exclusão ainda não configurado. Contate a responsável.');
    if (!origins.includes(origin)) return result(403, 'Origem não autorizada.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return result(405, 'Método não permitido.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return result(415, 'Envie JSON.');
    const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return result(401, 'Entre novamente.');
    let user: { id: string; passwordAt: number } | null;
    try { user = await services.authenticate(token); } catch { return result(401, 'Entre novamente.'); }
    if (!user) return result(401, 'Entre novamente.');
    if (!user.passwordAt || user.passwordAt * 1000 > now() + 30000 || now() - user.passwordAt * 1000 > 5 * 60 * 1000) return result(401, 'Confirme sua senha novamente antes de excluir.');
    let frozen = false;
    try {
      // Lê no máximo 1 KiB, inclusive em requisições sem Content-Length.
      const reader = request.body?.getReader(); let size = 0, raw = '';
      if (!reader) return result(400, 'Confirmação ausente.');
      const decoder = new TextDecoder();
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024) { await reader.cancel(); return result(413, 'Requisição muito grande.'); } raw += decoder.decode(part.value, { stream: true }); }
      raw += decoder.decode(); const body = JSON.parse(raw);
      if (body.confirmation !== 'EXCLUIR' || Object.keys(body).some(k => k !== 'confirmation')) return result(400, 'Digite EXCLUIR para confirmar.');
    } catch { return result(400, 'Confirmação inválida.'); }
    try {
      // O alvo vem exclusivamente da identidade verificada, nunca do corpo.
      await services.freeze(user.id);
      frozen = true;
      for (let batch = 0; batch < 20; batch++) {
        const files = await services.files(token);
        if (!files.length) { await services.deleteUser(user.id); return result(200, 'Conta e arquivos ativos excluídos.'); }
        if (files.some(f => !['avatars', 'wishlist'].includes(f.bucket_id) || f.name.split('/')[0] !== user!.id)) throw new Error('invalid_scope');
        for (const bucket of ['avatars', 'wishlist']) { const paths = files.filter(f => f.bucket_id === bucket).map(f => f.name); if (paths.length) await services.remove(bucket, paths); }
      }
      return result(503, 'A limpeza ainda não terminou. Repita a exclusão ou contate a responsável.');
    } catch { return result(503, frozen ? 'Não foi possível concluir a exclusão. A conta foi bloqueada para novas gravações; repita a operação ou contate a responsável.' : 'Não foi possível iniciar a exclusão. Repita a operação ou contate a responsável.'); }
  };
}
