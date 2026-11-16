import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { emptyData, type AppData } from './domain';
import { demoData } from './seed';
import { cleanupRemovedImages, loadCloud, revokeSession, saveCloud, supabase } from './backend';
import { AUTH_STORAGE_KEY, clearOwnerLocalData, IDLE_TIMEOUT_MS, sanitizeSnapshot } from './security';

const DEMO_KEY = 'rosalie.demo.v1', DEMO_SESSION = 'rosalie.demo.session', ACCESS_KEY = 'rosalie.has_accessed';
interface Store {
  data: AppData; loading: boolean; saving: boolean; error: string; notice: string; isDemo: boolean; authenticated: boolean; userId: string | null; hasVisited: boolean;
  month: string; setMonth: (month: string) => void;
  mutate: (change: (data: AppData) => AppData) => Promise<void>;
  authenticate: (operation: () => Promise<Session | null>) => Promise<void>;
  enterDemo: () => void; logout: () => Promise<void>; forgetDevice: () => Promise<void>; retry: () => void; clearError: () => void; clearNotice: () => void;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [hasVisited, setHasVisited] = useState(() => { try { return localStorage.getItem(ACCESS_KEY) === '1'; } catch { return false; } });
  const [session, setSession] = useState<Session | null>(null), [isDemo, setDemo] = useState(() => sessionStorage.getItem(DEMO_SESSION) === '1');
  const [authReady, setAuthReady] = useState(!supabase), [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0), [month, setMonth] = useState('2026-12');
  const dataRef = useRef(data), revisionRef = useRef(0), savingRef = useRef(false), epoch = useRef(0), identity = useRef(''), signedOut = useRef(false);
  const committedSession = useRef<Session | null>(null), initializedAuth = useRef(false);
  function restoreCommittedSession() { try { if (committedSession.current) sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(committedSession.current)); else sessionStorage.removeItem(AUTH_STORAGE_KEY); } catch { setNotice('Não foi possível atualizar a sessão da aba. Feche a aba antes de compartilhar o dispositivo.'); } }
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    function accept(next: Session | null) {
      const id = next?.user.id ?? '';
      if (identity.current !== id) { epoch.current++; identity.current = id; window.dispatchEvent(new Event('rosalie:lock-sensitive')); }
      committedSession.current = next; initializedAuth.current = true; setSession(next); setAuthReady(true);
    }
    supabase.auth.getSession().then(({ data, error }) => { if (!alive || signedOut.current) return; accept(error ? null : data.session); if (error) setNotice('Não foi possível verificar sua sessão. Entre novamente.'); }).catch(() => { if (alive) { accept(null); setNotice('Entre novamente para continuar.'); } });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      // Login/cadastro são confirmados por authenticate, com a geração da tentativa.
      // Reautenticação atrasada não pode reabrir uma conta depois de sair.
      if (event === 'SIGNED_IN') { if (initializedAuth.current) restoreCommittedSession(); return; }
      if (signedOut.current && next) { restoreCommittedSession(); return; }
      if (next && ['TOKEN_REFRESHED', 'USER_UPDATED'].includes(event) && next.user.id !== identity.current) { restoreCommittedSession(); return; }
      accept(next);
    });
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    let alive = true; const started = ++epoch.current;
    setLoading(true); setError(''); setData(emptyData()); dataRef.current = emptyData(); savingRef.current = false; setSaving(false); revisionRef.current = 0;
    async function load() {
      try {
        let next: AppData;
        if (isDemo) {
          const stored = localStorage.getItem(DEMO_KEY);
          next = sanitizeSnapshot(stored ? JSON.parse(stored) : demoData());
          localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        } else if (session) {
          const result = await loadCloud(session.user.id, String(session.user.user_metadata?.display_name ?? ''));
          if (!alive || started !== epoch.current) return;
          next = result.data; revisionRef.current = result.revision;
        } else next = emptyData();
        if (alive && started === epoch.current) { dataRef.current = next; setData(next); if (isDemo || session) { try { localStorage.setItem(ACCESS_KEY, '1'); } catch { /* Reconhecimento de retorno é dispensável. */ } } }
      } catch (e) { if (alive && started === epoch.current) setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.'); }
      finally { if (alive && started === epoch.current) setLoading(false); }
    }
    void load(); return () => { alive = false; };
  }, [authReady, session?.user.id, isDemo, attempt]);
  async function mutate(change: (current: AppData) => AppData) {
    if (savingRef.current) throw new Error('Aguarde a operação em andamento.');
    if (!isDemo && !session) throw new Error('Entre para salvar seus dados.');
    const started = epoch.current, previous = dataRef.current, owner = session?.user.id;
    savingRef.current = true; setSaving(true);
    try {
      const next = sanitizeSnapshot(change(previous));
      if (isDemo) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(next)); } catch { throw new Error('O armazenamento local está cheio ou indisponível. Remova uma imagem e tente novamente.'); } }
      else {
        const revision = await saveCloud(next, revisionRef.current);
        if (started !== epoch.current) throw new Error('A sessão foi encerrada. Entre novamente para conferir o resultado.');
        revisionRef.current = revision;
      }
      if (started !== epoch.current) return;
      dataRef.current = next; setData(next);
      if (!isDemo && owner) { try { await cleanupRemovedImages(previous, next, owner); } catch (e) { if (started === epoch.current) setNotice((e as Error).message); } }
    } finally { if (started === epoch.current) { savingRef.current = false; setSaving(false); } }
  }
  async function authenticate(operation: () => Promise<Session | null>) {
    const started = epoch.current, next = await operation();
    if (started !== epoch.current) { if (next) void revokeSession(next.access_token).catch(() => {}); throw new Error('A tentativa de acesso foi encerrada. Entre novamente.'); }
    if (next) { signedOut.current = false; identity.current = next.user.id; epoch.current++; committedSession.current = next; initializedAuth.current = true; restoreCommittedSession(); setSession(next); setAuthReady(true); }
  }
  function enterDemo() { epoch.current++; sessionStorage.setItem(DEMO_SESSION, '1'); setDemo(true); }
  async function logout() {
    const token = !isDemo ? session?.access_token : null;
    epoch.current++; signedOut.current = true; identity.current = ''; savingRef.current = false;
    committedSession.current = null;
    window.dispatchEvent(new Event('rosalie:lock-sensitive'));
    setHasVisited(true); setDemo(false); setSession(null); setData(emptyData()); dataRef.current = emptyData(); setSaving(false); setError('');
    try { sessionStorage.removeItem(DEMO_SESSION); sessionStorage.removeItem(AUTH_STORAGE_KEY); } catch { setNotice('A sessão foi fechada na tela. Não foi possível limpar o armazenamento da aba; feche esta aba e limpe os dados do site no navegador.'); }
    if (token && supabase) {
      // Enfileira a limpeza do SDK antes de um novo login; uma renovação já em curso
      // não pode repor a sessão antiga depois de a interface ter sido encerrada.
      const cleanup = supabase.auth.signOut({ scope: 'local' });
      const results = await Promise.allSettled([cleanup, revokeSession(token)]);
      if (results[1].status === 'rejected') setNotice('Você saiu deste dispositivo. Sem conexão, não foi possível confirmar a revogação no servidor; sessões em outros dispositivos continuam ativas.');
    }
  }
  async function forgetDevice() { const owner = isDemo ? 'demo' : session?.user.id; let cleared = true; try { if (owner) clearOwnerLocalData(owner); } catch { cleared = false; } await logout(); setHasVisited(false); if (!cleared) setNotice('Você saiu, mas não foi possível confirmar a limpeza local. Limpe os dados do site nas configurações do navegador.'); }
  useEffect(() => {
    if (!session || isDemo) return;
    let last = Date.now(); const touch = () => { last = Date.now(); };
    const check = () => { if (Date.now() - last >= IDLE_TIMEOUT_MS) { void logout(); setNotice('Sua sessão foi encerrada após 15 minutos sem atividade.'); } };
    const events = ['pointerdown', 'keydown', 'input']; events.forEach(event => window.addEventListener(event, touch, { passive: true }));
    const timer = window.setInterval(check, 10000); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); events.forEach(event => window.removeEventListener(event, touch)); document.removeEventListener('visibilitychange', check); };
  }, [session?.user.id, isDemo]);
  return <Context.Provider value={{ data, loading: loading || !authReady, saving, error, notice, isDemo, hasVisited, authenticated: isDemo || !!session, userId: isDemo ? null : session?.user.id ?? null, month, setMonth, mutate, authenticate, enterDemo, logout, forgetDevice, retry: () => setAttempt(a => a + 1), clearError: () => setError(''), clearNotice: () => setNotice('') }}>{children}</Context.Provider>;
}
export function useStore() { const value = useContext(Context); if (!value) throw new Error('Store ausente'); return value; }
