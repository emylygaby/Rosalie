import { validateCycle, type CycleData } from './cycle';
import { POLICY_VERSION } from './security';

export const VAULT_ITERATIONS = 600000;
export const VAULT_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export interface VaultEnvelope { version: 2; algorithm: 'AES-GCM'; iterations: number; salt: string; iv: string; ciphertext: string; expires_at: number }
const bytesToBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
function base64ToBytes(value: string) { if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Cofre inválido.'); return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export function validatePassphrase(value: string) { if (value.length < 12 || value.length > 256 || value.trim().split(/\s+/).length < 3) throw new Error('Use uma frase secreta com pelo menos 12 caracteres e 3 palavras.'); }
export function parseEnvelope(raw: string): VaultEnvelope {
  if (raw.length > 300000) throw new Error('Cofre inválido.');
  const e = JSON.parse(raw) as VaultEnvelope;
  if (e.version !== 2 || e.algorithm !== 'AES-GCM' || e.iterations !== VAULT_ITERATIONS || !Number.isSafeInteger(e.expires_at) || base64ToBytes(e.salt).length !== 16 || base64ToBytes(e.iv).length !== 12 || base64ToBytes(e.ciphertext).length < 16) throw new Error('Cofre inválido.');
  return e;
}
async function deriveKey(passphrase: string, salt: Uint8Array) {
  const password = new TextEncoder().encode(passphrase);
  try { const material = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveKey']); return await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: VAULT_ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  finally { password.fill(0); }
}
export async function openVault(envelope: VaultEnvelope, passphrase: string, owner: string, now = Date.now()): Promise<{ data: CycleData; key: CryptoKey; salt: string }> {
  if (envelope.expires_at <= now) throw new Error('O prazo de retenção do cofre terminou. Apague os dados locais para recomeçar.');
  const key = await deriveKey(passphrase, base64ToBytes(envelope.salt));
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource, additionalData: new TextEncoder().encode(`rosalie-cycle-v2:${owner}:${envelope.expires_at}`) }, key, base64ToBytes(envelope.ciphertext) as BufferSource);
    const bytes = new Uint8Array(plaintext);
    try { const data = JSON.parse(new TextDecoder().decode(bytes)); validateCycle(data); return { data, key, salt: envelope.salt }; } finally { bytes.fill(0); }
  } catch { throw new Error('Não foi possível abrir o cofre. Confira a frase secreta; os dados também podem estar danificados.'); }
}
export async function sealVault(data: CycleData, key: CryptoKey, salt: string, owner: string, now = Date.now()): Promise<VaultEnvelope> {
  validateCycle(data);
  const retained = { ...data, consent_version: POLICY_VERSION, records: data.records.filter(r => new Date(`${r.start_date}T12:00:00Z`).getTime() >= now - VAULT_TTL_MS) };
  const iv = crypto.getRandomValues(new Uint8Array(12)), bytes = new TextEncoder().encode(JSON.stringify(retained));
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`rosalie-cycle-v2:${owner}:${now + VAULT_TTL_MS}`) }, key, bytes);
    return { version: 2, algorithm: 'AES-GCM', iterations: VAULT_ITERATIONS, salt, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)), expires_at: now + VAULT_TTL_MS };
  } finally { bytes.fill(0); }
}
export async function createVault(data: CycleData, passphrase: string, owner: string) {
  validatePassphrase(passphrase); const saltBytes = crypto.getRandomValues(new Uint8Array(16)), salt = bytesToBase64(saltBytes), key = await deriveKey(passphrase, saltBytes);
  return { envelope: await sealVault(data, key, salt, owner), key, salt };
}
