import { describe, expect, it, vi } from 'vitest';
import { createVault, openVault, parseEnvelope, VAULT_TTL_MS } from '../src/cycle-vault';
import { newCycle } from '../src/cycle';
import { assertNoPrivateFrontendEnv, safeLocalImage, safeProductUrl, sanitizeSnapshot, validatePublicBackend } from '../src/security';
import { demoData } from '../src/seed';
import { deletionHandler, type DeletionServices } from '../supabase/functions/delete-account/handler';

const phrase = 'flores azuis no jardim privado', owner = '00000000-0000-4000-8000-000000000001';
describe('cofre sensível e limites de entrada', () => {
  it('só armazena ciphertext e abre com a chave não exportável correta', async () => {
    const cycle = { ...newCycle(), consented_at: new Date().toISOString(), records: [{ id: 'r1', start_date: '2026-01-02', end_date: '2026-01-05' }] };
    const { envelope, key } = await createVault(cycle, phrase, owner);
    const stored = JSON.stringify(envelope); expect(stored).not.toContain('2026-01-02'); expect(stored).not.toContain('consented_at'); expect(stored).not.toContain(phrase);
    expect(key.extractable).toBe(false);
    const opened = await openVault(parseEnvelope(stored), phrase, owner);
    expect(opened.data.records).toEqual(cycle.records);
    await expect(openVault(envelope, 'uma outra frase completamente diferente', owner)).rejects.toThrow(/Não foi possível/);
    await expect(openVault(envelope, phrase, 'outra-conta')).rejects.toThrow(/Não foi possível/);
    await expect(openVault({ ...envelope, expires_at: envelope.expires_at + 1 }, phrase, owner)).rejects.toThrow(/Não foi possível/);
    await expect(openVault(envelope, phrase, owner, Date.now() + VAULT_TTL_MS + 1000)).rejects.toThrow(/retenção/);
  });
  it('rejeita cifra adulterada, KDF controlado e frase curta', async () => {
    await expect(createVault({ ...newCycle(), consented_at: '2026-01-01' }, 'curta', owner)).rejects.toThrow(/frase secreta/);
    const { envelope } = await createVault({ ...newCycle(), consented_at: '2026-01-01' }, phrase, owner);
    expect(() => parseEnvelope(JSON.stringify({ ...envelope, iterations: 1 }))).toThrow(/inválido/);
    const altered = { ...envelope, ciphertext: (envelope.ciphertext[0] === 'A' ? 'B' : 'A') + envelope.ciphertext.slice(1) };
    await expect(openVault(altered, phrase, owner)).rejects.toThrow(/Não foi possível/);
  });
  it('descarta campos não previstos na exportação e no snapshot enviado', () => {
    const payload = demoData(); Object.assign(payload.profile, { cpf: 'não coletar' }); Object.assign(payload.income_plans[0], { user_id: owner, health: 'não enviar' });
    const clean = JSON.stringify(sanitizeSnapshot(payload)); expect(clean).not.toContain('cpf'); expect(clean).not.toContain('health'); expect(clean).not.toContain('user_id');
  });
  it('não permite chave administrativa no frontend nem URLs ativas perigosas', () => {
    expect(() => validatePublicBackend('https://projeto.supabase.co', 'sb_secret_segredo')).toThrow(/secreta/);
    const jwt = 'x.' + btoa(JSON.stringify({ role: 'service_role' })) + '.x';
    expect(() => validatePublicBackend('https://projeto.supabase.co', jwt)).toThrow(/pública/);
    expect(() => assertNoPrivateFrontendEnv({ VITE_UNUSED_KEY: jwt })).toThrow(/administrativa/);
    expect(() => validatePublicBackend('http://projeto.supabase.co', 'sb_publishable_teste')).toThrow(/HTTPS/);
    expect(() => validatePublicBackend('configuração-incorreta-com-valor-privado', 'sb_publishable_teste')).toThrow('Use uma URL HTTPS válida do Supabase.');
    expect(() => validatePublicBackend('https://projeto.supabase.co', 'sb_publishable_teste')).not.toThrow();
    for (const url of ['javascript:alert(1)', 'http://loja.example', 'https://senha:secreta@loja.example']) expect(safeProductUrl(url)).toBe('');
    expect(safeProductUrl('https://loja.example/item')).toBe('https://loja.example/item');
    expect(safeLocalImage('data:image/svg+xml;base64,AAAA')).toBe(false);
  });
});

const origin = 'https://rosalie.example', now = Date.parse('2026-11-16T15:00:00Z');
function setup() {
  const services: DeletionServices = {
    authenticate: vi.fn(async () => ({ id: owner, passwordAt: now / 1000 })), freeze: vi.fn(async () => {}),
    files: vi.fn().mockResolvedValueOnce([{ bucket_id: 'avatars', name: `${owner}/foto.webp` }]).mockResolvedValue([]),
    remove: vi.fn(async () => {}), deleteUser: vi.fn(async () => {}),
  };
  const handler = deletionHandler(services, [origin], () => now);
  const request = (body: unknown = { confirmation: 'EXCLUIR' }, headers = {}) => new Request(origin + '/functions/v1/delete-account', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer synthetic-test-token', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { services, handler, request };
}
describe('endpoint de exclusão, com serviços simulados (sem apagar contas reais)', () => {
  it('exclui só a identidade verificada, depois dos arquivos, e não permite cache', async () => {
    const { services, handler, request } = setup(); const response = await handler(request());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ deleted: true });
    expect(services.freeze).toHaveBeenCalledWith(owner); expect(services.remove).toHaveBeenCalledWith('avatars', [`${owner}/foto.webp`]); expect(services.deleteUser).toHaveBeenCalledWith(owner);
    expect(vi.mocked(services.remove).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(services.deleteUser).mock.invocationCallOrder[0]);
  });
  it('rejeita origem, identidade, confirmação e reautenticação inválidas', async () => {
    const { services, handler, request } = setup();
    expect((await handler(request(undefined, { Origin: 'https://invasor.example' }))).status).toBe(403);
    expect((await handler(request({ confirmation: 'EXCLUIR', userId: 'alvo-alheio' }))).status).toBe(400);
    expect((await handler(request({ confirmation: 'EXCLUIR', excesso: 'x'.repeat(2000) }))).status).toBe(413);
    vi.mocked(services.authenticate).mockResolvedValue({ id: owner, passwordAt: now / 1000 - 301 });
    expect((await handler(request())).status).toBe(401);
    vi.mocked(services.authenticate).mockResolvedValue(null); expect((await handler(request())).status).toBe(401);
    expect(services.freeze).not.toHaveBeenCalled(); expect(services.deleteUser).not.toHaveBeenCalled();
  });
  it('uma falha de storage ou arquivo alheio impede apagar a identidade e retornar sucesso', async () => {
    const { services, handler, request } = setup(); vi.mocked(services.remove).mockRejectedValue(new Error('falha simulada'));
    expect((await handler(request())).status).toBe(503); expect(services.deleteUser).not.toHaveBeenCalled();
    vi.mocked(services.freeze).mockRejectedValue(new Error('falha antes do bloqueio'));
    const beforeFreeze = await handler(request()); expect(await beforeFreeze.text()).not.toContain('foi bloqueada');
    vi.mocked(services.freeze).mockResolvedValue();
    vi.mocked(services.files).mockResolvedValue([{ bucket_id: 'avatars', name: 'outra-conta/foto.webp' }]);
    expect((await handler(request())).status).toBe(503); expect(services.deleteUser).not.toHaveBeenCalled();
  });
  it('não informa exclusão quando o provedor falha ou ainda há lotes para limpar', async () => {
    const { services, handler, request } = setup(); vi.mocked(services.deleteUser).mockRejectedValue(new Error('falha simulada'));
    expect((await handler(request())).status).toBe(503);
    vi.mocked(services.files).mockResolvedValue([{ bucket_id: 'wishlist', name: `${owner}/foto.webp` }]);
    const response = await handler(request()); expect(response.status).toBe(503); expect(await response.text()).toContain('não terminou');
  });
});
