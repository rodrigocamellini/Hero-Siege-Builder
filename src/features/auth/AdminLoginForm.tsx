'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { firebaseAuth } from '../../firebase';

type Props = { redirectTo: string; storageKey: string };

export function AdminLoginForm({ redirectTo, storageKey }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveEmail, setSaveEmail] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const storageAvailable = useMemo(() => {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    if (typeof window === 'undefined') return;

    const clearLegacy = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {}

      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
    };

    void clearLegacy();
  }, []);

  useEffect(() => {
    if (!storageAvailable) return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { email?: string; remember?: boolean };
    if (typeof parsed.email === 'string') setEmail(parsed.email);
    if (typeof parsed.remember === 'boolean') setRemember(parsed.remember);
    setSaveEmail(true);
  }, [storageAvailable, storageKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (storageAvailable) {
        if (saveEmail) window.localStorage.setItem(storageKey, JSON.stringify({ email, remember }));
        else window.localStorage.removeItem(storageKey);
      }

      const emailNorm = email.trim().toLowerCase();
      await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(firebaseAuth, emailNorm, password);
      const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
      const userEmail = (cred.user.email ?? '').trim().toLowerCase();
      if (!adminEmail) {
        await signOut(firebaseAuth);
        setError('Admin não configurado. Defina VITE_ADMIN_EMAIL no deploy e faça rebuild.');
        return;
      }
      if (!userEmail || userEmail !== adminEmail) {
        await signOut(firebaseAuth);
        setError('Access denied');
        return;
      }

      if (storageAvailable) {
        window.localStorage.setItem(storageKey, JSON.stringify({ email, remember }));
      }

      navigate(redirectTo, { replace: true });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-4">
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

      <label className="flex items-center gap-2 text-xs text-brand-darker/70 select-none">
        <input
          type="checkbox"
          checked={saveEmail}
          onChange={(e) => setSaveEmail(e.target.checked)}
          className="accent-brand-orange"
        />
        Remember email on this device
      </label>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Password</label>
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-brand-orange transition-colors"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/60 transition-colors text-brand-dark/50 hover:text-brand-darker"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-brand-darker/70 select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="accent-brand-orange"
        />
        Remember me on this device
      </label>

      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}

      <button
        type="submit"
        disabled={loading}
        className="orange-button w-full py-3 text-[10px] tracking-[0.2em] disabled:opacity-60"
      >
        {loading ? 'Signing in...' : 'Sign in to Panel'}
      </button>
    </form>
  );
}
