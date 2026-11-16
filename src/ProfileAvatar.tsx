import { useEffect, useState } from 'react';
import { supabase } from './backend';
import { useStore } from './store';
import { ownedImagePath, safeLocalImage, SIGNED_IMAGE_SECONDS } from './security';
export function ProfileAvatar({ className = '', path, name }: { className?: string; path?: string; name?: string }) {
  const { data, userId, isDemo } = useStore(), value = path ?? data.profile.avatar_path, displayName = name ?? data.profile.name;
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true; setSrc('');
    if (isDemo && safeLocalImage(value)) setSrc(value);
    else if (value && userId && ownedImagePath(value, userId) && supabase) void supabase.storage.from('avatars').createSignedUrl(value, SIGNED_IMAGE_SECONDS).then(({ data }) => { if (alive) setSrc(data?.signedUrl ?? ''); });
    return () => { alive = false; };
  }, [value, userId, isDemo]);
  return <span className={`profile-avatar-image ${className}`}>{src ? <img referrerPolicy="no-referrer" src={src} alt={`Foto de ${displayName || 'perfil'}`} onError={() => setSrc('')}/> : <span aria-hidden="true">{displayName.trim().charAt(0).toUpperCase() || '♡'}</span>}</span>;
}
