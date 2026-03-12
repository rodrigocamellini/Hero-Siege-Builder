'use client';

import { useEffect, useMemo, useState } from 'react';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';
type MeUser = {
  id: string;
  email: string;
  nick: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  role: Role;
};

function roleBadgeClass(role: Role) {
  if (role === 'DEVELOPER') return 'bg-purple-600/10 text-purple-700 border-purple-600/20';
  if (role === 'MODERATOR') return 'bg-blue-600/10 text-blue-700 border-blue-600/20';
  if (role === 'CONTRIBUTOR') return 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20';
  if (role === 'PARTNER') return 'bg-amber-600/10 text-amber-700 border-amber-600/20';
  return 'bg-brand-dark/5 text-brand-darker/70 border-brand-dark/10';
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);

  const [nick, setNick] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const canSaveProfile = useMemo(() => nick.trim().length >= 3 && nick.trim().length <= 24, [nick]);
  const canSaveEmail = useMemo(() => email.includes('@') && currentPassword.length > 0, [email, currentPassword]);
  const canSavePassword = useMemo(
    () => currentPassword.length > 0 && newPassword.length >= 8 && newPassword === newPassword2,
    [currentPassword, newPassword, newPassword2],
  );

  async function loadMe() {
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { method: 'GET' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: MeUser; error?: string } | null;
      if (!res.ok || !data?.ok || !data.user) {
        setError(data?.error ?? 'Falha ao carregar sua conta');
        return;
      }
      setUser(data.user);
      setNick(data.user.nick ?? '');
      setAvatarUrl(data.user.avatarUrl ?? '');
      setEmail(data.user.email);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  async function updateAccount(payload: Record<string, unknown>) {
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: MeUser; error?: string } | null;
      if (!res.ok || !data?.ok || !data.user) {
        setError(data?.error ?? 'Falha ao salvar');
        return;
      }
      setUser(data.user);
      setOk('Salvo com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
          <div className="text-sm text-brand-darker/60">Carregando...</div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
          <div className="text-sm font-bold text-red-600">{error ?? 'Falha ao carregar'}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Conta</h1>
            <div className="text-xs text-brand-darker/60">Editar Nick, foto, email e senha.</div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${roleBadgeClass(user.role)}`}>
            {user.role.toLowerCase()}
          </span>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={nick || user.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">Sem foto</div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Logado como</div>
            <div className="font-bold text-brand-darker truncate">{user.nick ?? user.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nick</label>
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              autoComplete="nickname"
            />
            <div className="mt-2 text-[10px] text-brand-darker/40 uppercase tracking-widest font-bold">Sem espaços (3–24)</div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Foto (URL)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              type="url"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-brand-dark/10">
          <div className="text-xs text-brand-darker/60">Atualiza Nick e foto do perfil.</div>
          <button
            type="button"
            disabled={saving || !canSaveProfile}
            onClick={() => void updateAccount({ nick, avatarUrl })}
            className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-5">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Email</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Novo email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Senha atual</label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              autoComplete="current-password"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-brand-dark/10">
          <div className="text-xs text-brand-darker/60">Para trocar email, informe sua senha atual.</div>
          <button
            type="button"
            disabled={saving || !canSaveEmail}
            onClick={() => void updateAccount({ email, currentPassword })}
            className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar email'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-5">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Senha</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Senha atual</label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nova senha</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              autoComplete="new-password"
            />
            <div className="mt-2 text-[10px] text-brand-darker/40 uppercase tracking-widest font-bold">Mínimo 8 caracteres</div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Confirmar</label>
            <input
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              type="password"
              className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-brand-dark/10">
          <div className="text-xs text-brand-darker/60">Troca sua senha usando a senha atual.</div>
          <button
            type="button"
            disabled={saving || !canSavePassword}
            onClick={() => void updateAccount({ currentPassword, newPassword })}
            className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar senha'}
          </button>
        </div>
      </div>

      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}
      {ok ? <div className="text-xs font-bold text-brand-orange">{ok}</div> : null}
    </main>
  );
}

