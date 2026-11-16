import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Flower2, LoaderCircle, Plus, X, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addMonths, monthLabel, type Wish } from './domain';
import { supabase } from './backend';
import { useStore } from './store';
import { ownedImagePath, safeLocalImage, SIGNED_IMAGE_SECONDS } from './security';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`brand concept-brand ${compact ? 'compact' : ''}`} aria-label="Rosalie, início"><span className="brand-wordmark"><span aria-hidden="true">✦</span>ROSALIE<small>seus dias, seus planos, seus sonhos</small></span></Link>;
}
export function MonthPicker() {
  const { month, setMonth } = useStore();
  return <div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={18}/></button><label><span>{monthLabel(month)}</span><input aria-label="Mês de referência" type="month" value={month} min="2000-01" max="2099-12" onChange={e => e.target.value && setMonth(e.target.value)} /></label><button aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={18}/></button></div>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>; }
export function Button({ children, onClick, secondary = false, type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; secondary?: boolean; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) { return <button type={type} className={`btn ${secondary ? 'btn-secondary' : 'btn-primary'} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>; }
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <Button onClick={onClick}><Plus size={18}/>{children}</Button>; }
export function Empty({ title = 'Um novo começo por aqui', detail = 'Adicione seu primeiro registro para começar a organizar.', action }: { title?: string; detail?: string; action?: ReactNode }) { return <div className="empty"><span className="empty-flower"><Flower2 size={32} strokeWidth={1}/></span><h3>{title}</h3><p>{detail}</p>{action}</div>; }
export function SectionTitle({ title, to, children, linkLabel = 'Ver todos' }: { title: string; to?: string; children?: ReactNode; linkLabel?: string }) { return <div className="section-heading"><h2>{title}</h2>{to ? <Link className="text-link" to={to}>{linkLabel} <ArrowRight size={15}/></Link> : children}</div>; }
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function BackLink({ to, children }: { to: string; children: ReactNode }) { return <Link to={to} className="text-link back-link"><ArrowLeft size={16}/>{children}</Link>; }
export function Loading({ text = 'Preparando seu espaço…' }: { text?: string }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={28}/><span>{text}</span></div>; }
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); const focusable = dialog.querySelector<HTMLElement>('input:not(:disabled),select,textarea') ?? dialog.querySelector<HTMLElement>('button'); focusable?.focus(); return () => { dialog.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); } }}><div className="modal-header"><div><p className="eyebrow">CADA DETALHE CONTA</p><h2 id="modal-title">{title}</h2></div><button className="icon-btn" aria-label="Fechar diálogo" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function Confirm({ title, detail, onConfirm, onClose }: { title: string; detail: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <Modal title={title} onClose={() => !busy && onClose()}><p className="muted">{detail}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button secondary onClick={onClose} disabled={busy}>Cancelar</Button><Button disabled={busy} onClick={() => { setBusy(true); onConfirm().then(onClose).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>{busy ? 'Excluindo…' : 'Excluir'}</Button></div></Modal>;
}
export function WishImage({ wish }: { wish: Wish }) {
  const { userId, isDemo } = useStore();
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true; setSrc('');
    if (isDemo && safeLocalImage(wish.image_path)) setSrc(wish.image_path);
    else if (wish.image_path && userId && ownedImagePath(wish.image_path, userId) && supabase) supabase.storage.from('wishlist').createSignedUrl(wish.image_path, SIGNED_IMAGE_SECONDS).then(({ data }) => { if (alive) setSrc(data?.signedUrl ?? ''); });
    return () => { alive = false; };
  }, [wish.image_path, userId, isDemo]);
  return src ? <img referrerPolicy="no-referrer" className="wish-image" src={src} alt={wish.name} onError={() => setSrc('')}/> : <div className="wish-placeholder"><ImageIcon size={36} strokeWidth={1}/><span>{wish.name}</span></div>;
}
export function Saved({ text }: { text: string }) { return <span className="saved" role="status"><Check size={16}/>{text}</span>; }
