import { useEffect, useState, type FormEvent } from 'react';
import { Button, Saved } from './components';
import { ProfileAvatar } from './ProfileAvatar';
import { removeProfileImage, uploadProfileImage } from './backend';
import { useStore } from './store';

export function ProfileSettings() {
  const { data, mutate, userId, saving } = useStore();
  const [name, setName] = useState(data.profile.name), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(''), [remove, setRemove] = useState(false), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaved(false); setBusy(true); let uploaded = '';
    try {
      if (file && !remove) uploaded = await uploadProfileImage(file, userId);
      await mutate(d => ({ ...d, profile: { ...d.profile, name: name.trim(), avatar_path: remove ? '' : uploaded || d.profile.avatar_path } }));
      setSaved(true); setFile(null); setRemove(false);
    } catch (e) { if (uploaded && userId) { try { await removeProfileImage(uploaded); } catch { /* URL continua privada; registrar nova tentativa ao editar. */ } } setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <section className="panel profile-panel"><div className="profile-photo-preview">{preview && !remove ? <img src={preview} alt="Prévia da foto de perfil"/> : <ProfileAvatar className="profile-avatar" path={remove ? '' : data.profile.avatar_path} name={name}/>}</div><h2>Seu perfil</h2><p className="section-description">Seu nome e sua foto deixam este espaço com a sua cara.</p><form onSubmit={save}><label className="field"><span>Nome</span><input value={name} onChange={e => { setName(e.target.value); setSaved(false); }} maxLength={80} required pattern=".*\S.*" autoComplete="nickname"/></label><label className="field"><span>Foto de perfil (opcional)</span><input type="file" name="profile_image" accept="image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] ?? null); setRemove(false); setSaved(false); }}/><small>Até 3 MB. A imagem será recortada em quadrado e preparada sem os metadados originais.</small></label>{(data.profile.avatar_path || file) && <button type="button" className="text-link danger" onClick={() => { setRemove(true); setFile(null); setSaved(false); }}>Remover foto de perfil</button>}{remove && <p className="small muted">Salve para confirmar a remoção.</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions">{saved && <Saved text="Perfil salvo"/>}<Button type="submit" disabled={saving || busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</Button></div></form></section>;
}
