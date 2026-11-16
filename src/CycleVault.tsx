import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './components';
import { newCycle, validateCycle, type CycleData } from './cycle';
import { createVault, openVault, parseEnvelope, sealVault, VAULT_TTL_MS } from './cycle-vault';
import { POLICY_VERSION, downloadJson } from './security';

export function useCycleStorage(owner: string) {
  const keyName = `rosalie.cycle.v2.${owner}`, legacyName = `rosalie.cycle.v1.${owner}`;
  const [data, setData] = useState<CycleData | null>(null), [mode, setMode] = useState<'empty' | 'legacy' | 'locked' | 'unlocked'>('empty'), [error, setError] = useState('');
  const context = useRef<{ key: CryptoKey; salt: string } | null>(null), generation = useRef(0), writing = useRef(false);
  function lock() { generation.current++; context.current = null; setData(null); try { setMode(localStorage.getItem(keyName) ? 'locked' : localStorage.getItem(legacyName) ? 'legacy' : 'empty'); } catch { setMode('locked'); setError('Armazenamento indisponível.'); } }
  useEffect(() => {
    context.current = null; generation.current++; setData(null); setError('');
    try {
      const raw = localStorage.getItem(keyName);
      if (raw) { const envelope = parseEnvelope(raw); if (envelope.expires_at <= Date.now()) { localStorage.removeItem(keyName); setMode('empty'); setError('O cofre expirou após 12 meses sem atualização e foi apagado deste navegador.'); } else setMode('locked'); }
      else setMode(localStorage.getItem(legacyName) ? 'legacy' : 'empty');
    } catch { setMode('locked'); setError('Não foi possível ler o cofre. Você pode apagá-lo para recomeçar.'); }
    return () => { generation.current++; context.current = null; };
  }, [keyName, legacyName]);
  useEffect(() => {
    if (mode !== 'unlocked') return;
    let last = Date.now(); const touch = () => { last = Date.now(); }, visibility = () => { if (document.hidden) lock(); };
    const timer = window.setInterval(() => { if (Date.now() - last >= 5 * 60 * 1000) lock(); }, 10000);
    const events = ['pointerdown', 'keydown', 'input']; events.forEach(event => window.addEventListener(event, touch, { passive: true }));
    window.addEventListener('rosalie:lock-sensitive', lock); document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); events.forEach(event => window.removeEventListener(event, touch)); window.removeEventListener('rosalie:lock-sensitive', lock); document.removeEventListener('visibilitychange', visibility); };
  }, [mode, keyName]);
  async function unlock(passphrase: string, consent = false) {
    setError(''); const epoch = generation.current;
    let result: { data: CycleData; key: CryptoKey; salt: string };
    if (mode === 'locked') result = await openVault(parseEnvelope(localStorage.getItem(keyName) ?? ''), passphrase, owner);
    else {
      if (!consent) throw new Error('Autorize o acompanhamento opcional para criar ou migrar o cofre.');
      const raw = mode === 'legacy' ? localStorage.getItem(legacyName) : null;
      const previous = raw ? JSON.parse(raw) as CycleData : newCycle();
      const next = { ...previous, consented_at: new Date().toISOString(), consent_version: POLICY_VERSION };
      validateCycle(next); const created = await createVault(next, passphrase, owner);
      if (epoch !== generation.current) return;
      localStorage.setItem(keyName, JSON.stringify(created.envelope));
      localStorage.removeItem(legacyName);
      result = { data: next, key: created.key, salt: created.salt };
    }
    if (epoch !== generation.current) return;
    context.current = { key: result.key, salt: result.salt }; setData(result.data); setMode('unlocked');
  }
  async function save(next: CycleData) {
    if (!context.current || mode !== 'unlocked') throw new Error('Desbloqueie o cofre para salvar.');
    if (writing.current) throw new Error('Aguarde a gravação do cofre.');
    if (next.records.length > 120) throw new Error('Limite local de 120 registros atingido. Exporte e revise seu histórico.');
    writing.current = true;
    try {
    const epoch = generation.current, retained = { ...next, records: next.records.filter(r => new Date(`${r.start_date}T12:00:00Z`).getTime() >= Date.now() - VAULT_TTL_MS) };
    const envelope = await sealVault(retained, context.current.key, context.current.salt, owner);
    if (epoch !== generation.current) throw new Error('O cofre foi bloqueado. Desbloqueie antes de salvar novamente.');
    localStorage.setItem(keyName, JSON.stringify(envelope)); setData(retained); setError('');
    } finally { writing.current = false; }
  }
  function clear() { generation.current++; localStorage.removeItem(keyName); localStorage.removeItem(legacyName); context.current = null; setData(null); setMode('empty'); setError(''); }
  function exportEncrypted() { const raw = localStorage.getItem(keyName); if (raw) downloadJson('rosalie-cofre-ciclo.json', parseEnvelope(raw)); }
  return { data, mode, error, save, clear, lock, unlock, exportEncrypted };
}
export type CycleController = ReturnType<typeof useCycleStorage>;
export function CycleVaultGate({ controller }: { controller: CycleController }) {
  const [passphrase, setPassphrase] = useState(''), [confirmation, setConfirmation] = useState(''), [consent, setConsent] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const creating = controller.mode !== 'locked';
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { if (creating && passphrase !== confirmation) throw new Error('As frases secretas precisam ser iguais.'); await controller.unlock(passphrase, consent); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o cofre.'); }
    finally { setPassphrase(''); setConfirmation(''); setBusy(false); }
  }
  return <section className="panel cycle-panel vault-gate"><h2>Meu ciclo — cofre privado</h2><p className="section-description">Opcional e separado da conta. Os registros são criptografados neste navegador; a frase secreta não é enviada nem guardada. Ao sair desta tela, ocultar o aplicativo ou ficar 5 minutos sem atividade, será preciso desbloquear novamente.</p>{controller.mode === 'legacy' && <p className="form-error" role="alert">Há registros da versão anterior ainda sem criptografia. Proteja-os com uma frase secreta ou apague-os abaixo. A migração só remove o texto antigo depois de confirmar a gravação criptografada.</p>}
    <form onSubmit={submit}><label className="field"><span>Frase secreta do cofre</span><input aria-label="Frase secreta do cofre" type="password" autoComplete="off" required minLength={12} maxLength={256} value={passphrase} onChange={e => setPassphrase(e.target.value)}/></label>{creating && <><label className="field"><span>Confirme a frase secreta</span><input type="password" autoComplete="off" required minLength={12} maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label><p className="small muted">Use pelo menos 3 palavras e 12 caracteres. Não use sua senha da conta. Se esquecer a frase, não conseguimos recuperar os registros.</p><label className="check-field cycle-consent"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)}/>Autorizo o acompanhamento opcional e o armazenamento criptografado local dos dados de ciclo, conforme o aviso de privacidade.</label></>}{(error || controller.error) && <p className="form-error" role="alert">{error || controller.error}</p>}<Button type="submit" disabled={busy}>{busy ? 'Protegendo…' : creating ? controller.mode === 'legacy' ? 'Proteger registros antigos' : 'Criar cofre do ciclo' : 'Desbloquear cofre'}</Button></form>
    <p className="cycle-limit">Sem sincronização ou backup automático. Registros com mais de 12 meses são removidos ao salvar; o cofre expira após 12 meses sem atualização. A criptografia não protege um dispositivo comprometido nem uma tela já desbloqueada. <Link to="/privacidade">Aviso de privacidade</Link>.</p>{controller.mode !== 'empty' && <div className="vault-actions"><Button secondary onClick={controller.exportEncrypted}>Exportar cofre criptografado</Button><Button secondary onClick={() => { if (window.confirm('Apagar o cofre e quaisquer registros antigos deste navegador? Essa ação não pode ser desfeita.')) controller.clear(); }}>Apagar cofre local</Button></div>}
  </section>;
}
