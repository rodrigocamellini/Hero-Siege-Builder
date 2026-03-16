import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { StandardPage } from '../components/StandardPage';
import { useAuth } from '../features/auth/AuthProvider';
import { firestore } from '../firebase';

function authErrorMessage(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'auth/requires-recent-login') return 'Faça login novamente para alterar a senha.';
  if (code === 'auth/wrong-password') return 'Senha atual incorreta.';
  if (code === 'auth/weak-password') return 'Senha fraca. Use pelo menos 8 caracteres.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Tente novamente mais tarde.';
  return code ? `Erro: ${code}` : 'Falha ao atualizar conta.';
}

function firestoreErrorMessage(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
  if (code === 'permission-denied') return 'Permissão negada no Firestore.';
  if (code === 'unauthenticated') return 'Você precisa estar logado.';
  if (code === 'unavailable') return 'Firestore indisponível. Tente novamente.';
  return code ? `Erro: ${code}` : 'Falha no Firestore.';
}

function normalizeNick(nick: string) {
  return nick.trim().toLowerCase();
}

export function AccountSettingsPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const callbackUrl = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedOk, setProfileSavedOk] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [nick, setNick] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const [nickSavedOk, setNickSavedOk] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSavedOk, setPasswordSavedOk] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setProfileSavedOk(false);
    setProfileError(null);
    setNickSavedOk(false);
    setNickError(null);
    setPasswordSavedOk(false);
    setPasswordError(null);

    setPhotoURL(String(profile?.photoURL ?? user?.photoURL ?? ''));
    setDisplayName(String(profile?.displayName ?? user?.displayName ?? ''));
    setNick(String(profile?.nick ?? ''));
  }, [profile?.photoURL, profile?.displayName, profile?.nick, user?.photoURL, user?.displayName]);

  async function saveProfile() {
    setProfileError(null);
    setProfileSavedOk(false);
    if (!user) return;
    setSavingProfile(true);
    try {
      const nextPhoto = photoURL.trim() || null;
      const nextName = displayName.trim() || null;
      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          photoURL: nextPhoto,
          displayName: nextName,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await updateProfile(user, { photoURL: nextPhoto ?? undefined, displayName: nextName ?? undefined });
      setProfileSavedOk(true);
    } catch (err) {
      setProfileError(firestoreErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveNick() {
    setNickError(null);
    setNickSavedOk(false);
    if (!user) return;
    if (profile?.nick) {
      setNickError('Você não pode alterar o nick.');
      return;
    }
    const nickKey = normalizeNick(nick);
    if (nickKey.length < 3) {
      setNickError('Nick muito curto.');
      return;
    }
    if (nickKey.length > 20) {
      setNickError('Nick muito longo.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(nickKey)) {
      setNickError('Use apenas letras, números e _.');
      return;
    }
    setSavingNick(true);
    try {
      await runTransaction(firestore, async (tx) => {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await tx.get(userRef);
        const currentNick = userSnap.exists() ? ((userSnap.data() as any)?.nick ?? null) : null;
        if (typeof currentNick === 'string' && currentNick.trim().length) {
          throw new Error('Você não pode alterar o nick.');
        }

        const nickRef = doc(firestore, 'nicks', nickKey);
        const nickSnap = await tx.get(nickRef);
        if (nickSnap.exists()) {
          throw new Error('Esse nick já está em uso.');
        }

        tx.set(nickRef, { uid: user.uid, nick: nickKey, createdAt: serverTimestamp() }, { merge: false });
        tx.set(userRef, { nick: nickKey, updatedAt: serverTimestamp() }, { merge: true });
      });
      setNickSavedOk(true);
    } catch (err) {
      setNickError(err instanceof Error ? err.message : firestoreErrorMessage(err));
    } finally {
      setSavingNick(false);
    }
  }

  async function changePassword() {
    setPasswordError(null);
    setPasswordSavedOk(false);
    if (!user) return;
    const email = user.email ? user.email.trim() : '';
    if (!email) {
      setPasswordError('Sua conta não tem email.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Senha fraca. Use pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Confirmação de senha não confere.');
      return;
    }
    if (!currentPassword) {
      setPasswordError('Digite sua senha atual.');
      return;
    }

    setPasswordSaving(true);
    try {
      const cred = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSavedOk(true);
    } catch (err) {
      setPasswordError(authErrorMessage(err));
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <StandardPage title="Conta - Configurações | Hero Siege Builder" description="Edite sua foto, nick e senha." canonicalPath="/account/settings" noindex>
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 animate-pulse h-40" />
        </div>
      </StandardPage>
    );
  }

  if (!user) {
    return (
      <StandardPage title="Conta - Configurações | Hero Siege Builder" description="Edite sua foto, nick e senha." canonicalPath="/account/settings" noindex>
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
          <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
            <div className="text-sm font-bold text-brand-darker">Você precisa estar logado para editar sua conta.</div>
            <Link to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="inline-block mt-3 text-brand-orange font-bold hover:underline">
              Ir para login
            </Link>
          </div>
        </div>
      </StandardPage>
    );
  }

  const effectiveEmail = user.email ?? '';
  const effectiveNick = profile?.nick ?? null;
  const avatarPreview = photoURL.trim() || null;

  return (
    <StandardPage title="Conta - Configurações | Hero Siege Builder" description="Edite sua foto, nick e senha." canonicalPath="/account/settings" noindex>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-16 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Conta</h1>
            <p className="mt-2 text-sm text-brand-darker/60">Edite sua foto e sua senha. Email e nick são únicos.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tierlist')}
            className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
          >
            Tier List
          </button>
        </div>

        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Perfil</div>
              <div className="text-sm font-bold text-brand-darker">Foto e nome</div>
            </div>
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={savingProfile}
              className="orange-button px-6 py-3 text-[10px] tracking-[0.2em] disabled:opacity-60"
            >
              {savingProfile ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center shrink-0">
              {avatarPreview ? <img src={avatarPreview} alt="Foto" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Email (não pode mudar)</label>
                <input
                  value={effectiveEmail}
                  disabled
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm text-brand-darker/70"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Link da imagem</label>
                <input
                  value={photoURL}
                  onChange={(e) => {
                    setProfileSavedOk(false);
                    setPhotoURL(e.target.value);
                  }}
                  placeholder="https://..."
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nome</label>
                <input
                  value={displayName}
                  onChange={(e) => {
                    setProfileSavedOk(false);
                    setDisplayName(e.target.value);
                  }}
                  className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
            </div>
          </div>
          {profileError ? <div className="mt-4 text-xs font-bold text-red-600">{profileError}</div> : null}
          {profileSavedOk ? <div className="mt-4 text-xs font-bold text-emerald-600">Perfil atualizado.</div> : null}
        </div>

        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Nick</div>
              <div className="text-sm font-bold text-brand-darker">Nick é único e não pode ser alterado</div>
            </div>
            <button
              type="button"
              onClick={() => void saveNick()}
              disabled={savingNick || !!effectiveNick}
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
            >
              {savingNick ? 'Salvando...' : 'Salvar nick'}
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nick</label>
            <input
              value={effectiveNick ?? nick}
              onChange={(e) => {
                setNickSavedOk(false);
                setNick(normalizeNick(e.target.value));
              }}
              disabled={!!effectiveNick}
              placeholder="ex: rodrigo_camellini"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors disabled:text-brand-darker/60"
            />
            <div className="mt-2 text-xs text-brand-darker/60">Use apenas letras, números e _. De 3 a 20 caracteres.</div>
          </div>

          {nickError ? <div className="mt-4 text-xs font-bold text-red-600">{nickError}</div> : null}
          {nickSavedOk ? <div className="mt-4 text-xs font-bold text-emerald-600">Nick salvo.</div> : null}
        </div>

        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Senha</div>
              <div className="text-sm font-bold text-brand-darker">Alterar senha</div>
            </div>
            <button
              type="button"
              onClick={() => void changePassword()}
              disabled={passwordSaving}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {passwordSaving ? 'Salvando...' : 'Alterar senha'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Senha atual</label>
              <input
                value={currentPassword}
                onChange={(e) => {
                  setPasswordSavedOk(false);
                  setCurrentPassword(e.target.value);
                }}
                type="password"
                autoComplete="current-password"
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nova senha</label>
              <input
                value={newPassword}
                onChange={(e) => {
                  setPasswordSavedOk(false);
                  setNewPassword(e.target.value);
                }}
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Confirmar nova senha</label>
              <input
                value={confirmPassword}
                onChange={(e) => {
                  setPasswordSavedOk(false);
                  setConfirmPassword(e.target.value);
                }}
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              />
            </div>
          </div>

          {passwordError ? <div className="mt-4 text-xs font-bold text-red-600">{passwordError}</div> : null}
          {passwordSavedOk ? <div className="mt-4 text-xs font-bold text-emerald-600">Senha atualizada.</div> : null}
        </div>
      </div>
    </StandardPage>
  );
}
