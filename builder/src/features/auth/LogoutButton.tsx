'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal } from '../../components/Modal';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
      >
        {loading ? 'Saindo...' : 'Sair'}
      </button>
      <Modal open={confirmOpen} title="Confirmar saída" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-5">
          <div className="text-sm text-brand-darker/70">Deseja realmente sair?</div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
              onClick={() => void onLogout().then(() => setConfirmOpen(false))}
              disabled={loading}
            >
              {loading ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
