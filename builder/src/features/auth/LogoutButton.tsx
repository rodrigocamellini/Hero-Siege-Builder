'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogout() {
    setError(null);
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? <div className="text-xs font-bold text-red-600">{error}</div> : null}
      <button
        type="button"
        onClick={onLogout}
        disabled={loading}
        className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
      >
        {loading ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  );
}
