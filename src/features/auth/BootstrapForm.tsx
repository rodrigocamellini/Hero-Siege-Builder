'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { firebaseAuth } from '../../firebase';

export function BootstrapForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const emailNorm = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(firebaseAuth, emailNorm, password);
      const name = (displayName || nick).trim() || undefined;
      const photoURL = avatarUrl.trim() || undefined;
      await updateProfile(cred.user, { displayName: name, photoURL });
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nick</label>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="nickname"
          required
        />
        <div className="mt-2 text-[10px] text-brand-darker/40 uppercase tracking-widest font-bold">
          Sem espaços, será exibido no site
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="email"
          required
        />
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

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nome (opcional)</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Senha</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <div className="mt-2 text-[10px] text-brand-darker/40 uppercase tracking-widest font-bold">
          Mínimo 8 caracteres
        </div>
      </div>

      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}

      <button
        type="submit"
        disabled={loading}
        className="orange-button w-full py-3 text-[10px] tracking-[0.2em] disabled:opacity-60"
      >
        {loading ? 'Criando...' : 'Criar Admin'}
      </button>
    </form>
  );
}
