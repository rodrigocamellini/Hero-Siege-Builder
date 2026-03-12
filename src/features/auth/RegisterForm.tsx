'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [nick, setNick] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationLoading, setRegistrationLoading] = useState(true);

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl');
    return raw && raw.startsWith('/') ? raw : '/';
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setRegistrationLoading(true);
      try {
        const res = await fetch('/api/settings/registration', { method: 'GET' });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; enabled?: boolean } | null;
        if (!res.ok || !data?.ok) return;
        setRegistrationEnabled(data.enabled !== false);
      } finally {
        setRegistrationLoading(false);
      }
    };
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!registrationEnabled) {
      setError('Registration is currently disabled.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, nick, remember }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Failed to create account');
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-brand-dark/10 rounded-2xl p-6 space-y-4">
      {!registrationLoading && !registrationEnabled ? (
        <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-3 text-xs font-bold text-red-700">
          Account creation is currently disabled.
        </div>
      ) : null}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="email"
          required
          disabled={!registrationEnabled || registrationLoading}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Nickname (optional)</label>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          type="text"
          className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-brand-orange transition-colors"
          autoComplete="nickname"
          disabled={!registrationEnabled || registrationLoading}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-brand-darker/60 mb-2">Password</label>
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            className="w-full bg-brand-bg border border-brand-dark/10 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-brand-orange transition-colors"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={!registrationEnabled || registrationLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/60 transition-colors text-brand-dark/50 hover:text-brand-darker"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            disabled={!registrationEnabled || registrationLoading}
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
          disabled={!registrationEnabled || registrationLoading}
        />
        Remember me on this device
      </label>

      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}

      <button
        type="submit"
        disabled={loading || !registrationEnabled || registrationLoading}
        className="orange-button w-full py-3 text-[10px] tracking-[0.2em] disabled:opacity-60"
      >
        {loading ? 'Creating...' : 'Create account'}
      </button>
    </form>
  );
}
