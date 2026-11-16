import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { greeting } from './domain';
import { Brand, Button, Loading } from './components';
import { supabase } from './backend';
import { useStore } from './store';

export function Login() {
  const { authenticated, loading, enterDemo, hasVisited, authenticate } = useStore();
  const [visible, setVisible] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'recover'>('login');
  function changeMode(next: typeof mode) { setMode(next); setError(''); setMessage(''); }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setMessage('');
    if (!supabase) { setError('O acesso por conta ainda não está disponível. Use a demonstração abaixo para conhecer o Rosalie.'); return; }
    setBusy(true);
    const form = new FormData(e.currentTarget), email = String(form.get('email')), password = String(form.get('password'));
    try {
      if (mode === 'login') await authenticate(async () => { const { data, error } = await supabase!.auth.signInWithPassword({ email, password }); if (error) throw new Error('E-mail ou senha incorretos. Confira seus dados e tente novamente.'); return data.session; });
      if (mode === 'signup') await authenticate(async () => { const { data, error } = await supabase!.auth.signUp({ email, password, options: { data: { display_name: String(form.get('display_name')).trim() } } }); if (error) throw new Error('Não foi possível criar a conta. Verifique os dados ou tente entrar.'); if (!data.session) setMessage('Confira seu e-mail para confirmar o cadastro e depois entre.'); return data.session; });
      if (mode === 'recover') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` }); if (error) throw new Error('Não foi possível enviar o link. Tente novamente.'); setMessage('Se houver uma conta para este e-mail, você receberá um link de recuperação.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  if (loading) return <Loading/>;
  if (authenticated) return <Navigate to="/" replace/>;
  return <main className="login-page figma-login">
    <div className="auth-layout">
      <header className="auth-brand" aria-label="Rosalie">
        <div className="auth-emblem"><img src="/figma/rose.svg" width="58" height="58" alt=""/></div>
        <span className="auth-wordmark">ROSALIE</span>
        <p>seus dias, seus planos, seus sonhos</p>
      </header>
      <div className="auth-welcome">
        <h1>{mode === 'login' ? hasVisited ? 'Bem-vinda de volta ♡' : 'Bem-vinda ♡' : mode === 'signup' ? 'Um novo começo ♡' : 'Vamos recomeçar? ♡'}</h1>
        <p>{greeting()}! Seu planner financeiro pessoal,</p><p>delicado e inteligente.</p>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-heading"><h2 id="auth-title">{mode === 'login' ? 'Acesse sua conta' : mode === 'signup' ? 'Crie sua conta' : 'Recupere seu acesso'}</h2><p>{mode === 'recover' ? 'Enviaremos um link para redefinir sua senha.' : 'Organize o que importa, com carinho.'}</p></div>
        <form onSubmit={submit}>
          {mode === 'signup' && <label className="field"><span>Como você quer ser chamada?</span><input name="display_name" required maxLength={80} pattern=".*\S.*" autoComplete="nickname" placeholder="Seu nome ou apelido"/></label>}
          <label className="field"><span>E-mail</span><div className="auth-input"><img src="/figma/mail.svg" width="19" height="19" alt=""/><input name="email" type="email" autoComplete="email" placeholder="Digite seu e-mail" required disabled={busy}/></div></label>
          {mode !== 'recover' && <label className="field"><span>Senha</span><div className="auth-input"><img src="/figma/lock.svg" width="19" height="19" alt=""/><input name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="Digite sua senha" minLength={mode === 'signup' ? 15 : 8} maxLength={128} required disabled={busy}/><button type="button" className="password-visibility" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>}
          {mode === 'login' && <button type="button" className="auth-forgot" onClick={() => changeMode('recover')}>Esqueceu sua senha?</button>}
          {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-note" role="status">{message}</p>}
          <Button type="submit" disabled={busy} className="auth-submit full-width">{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar minha conta' : 'Enviar link'}</Button>
        </form>
        <div className="auth-divider">ou</div>
        <Button secondary className="auth-alternate full-width" disabled={busy} onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Criar conta' : 'Voltar para entrar'}</Button>
      </section>
      {mode === 'signup' && <p className="signup-privacy">No cadastro, pedimos apenas e-mail, nome ou apelido e a senha de acesso. Não solicitamos CPF, idade ou gênero. A foto e o acompanhamento do ciclo são opcionais. Ao criar a conta, solicitamos os dados necessários ao serviço descrito no aviso. Use uma senha única de pelo menos 15 caracteres.</p>}
      <p className="auth-privacy-link"><Link to="/privacidade">Aviso de privacidade e seus direitos</Link></p><p className="auth-privacy"><img src="/figma/security.svg" width="17" height="17" alt=""/>Seus dados e seus planos merecem cuidado.</p>
      <p className="auth-signature">✦ &nbsp;feito para organizar o que importa&nbsp; ✦</p>
      <section className="demo-access" aria-label="Explorar sem conta"><Button secondary className="full-width" onClick={enterDemo}><Sparkles size={16}/>Conhecer a demonstração</Button><p>Dados fictícios, salvos apenas neste navegador.<br/>A demonstração dispensa conta e não protege dados pessoais.</p></section>
    </div>
  </main>;
}

export function ResetPassword() {
  const [error, setError] = useState(''), [success, setSuccess] = useState(false), [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const form = new FormData(e.currentTarget), password = String(form.get('password'));
    if (password !== form.get('confirm')) { setError('As senhas precisam ser iguais.'); setBusy(false); return; }
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) setError('O link pode ter expirado. Solicite uma nova recuperação.'); else setSuccess(true);
    setBusy(false);
  }
  return <main className="reset-page"><Brand/><section className="panel"><h1>Uma nova senha</h1>{success ? <><p className="success-note">Senha atualizada.</p><a className="btn btn-primary" href="/">Ir para meu espaço</a></> : !supabase ? <p>Configure sua conta antes de redefinir uma senha.</p> : <form onSubmit={submit}><label className="field"><span>Nova senha</span><input name="password" type="password" autoComplete="new-password" minLength={15} maxLength={128} required/></label><label className="field"><span>Confirmar senha</span><input name="confirm" type="password" autoComplete="new-password" minLength={15} maxLength={128} required/></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>Salvar senha</Button></form>}</section></main>;
}

