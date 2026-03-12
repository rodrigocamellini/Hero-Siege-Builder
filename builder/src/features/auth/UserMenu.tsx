'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, Shield, User } from 'lucide-react';
import { Modal } from '../../components/Modal';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';
type Me = {
  id: string;
  email: string;
  nick: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  role: Role;
};

export function UserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (e.target instanceof Node && rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/me', { method: 'GET' });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: Me } | null;
        if (!res.ok || !data?.ok || !data.user) {
          setMe(null);
          return;
        }
        setMe(data.user);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function onLogout() {
    setLogoutLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setMe(null);
      setOpen(false);
      setConfirmOpen(false);
      router.replace('/login');
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  }

  const label = me?.nick ?? me?.displayName ?? me?.email ?? '';

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-lg bg-brand-bg border border-brand-dark/10 animate-pulse hidden sm:block" />
    );
  }

  if (!me) {
    return (
      <Link
        href="/login"
        className="bg-brand-orange p-2 rounded-lg cursor-pointer hover:bg-brand-orange-dark transition-all hover:scale-105 active:scale-95 shadow-sm hidden sm:block"
        aria-label="Entrar"
      >
        <User className="text-white w-5 h-5" />
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-xl hover:bg-brand-bg transition-colors"
        aria-label="Conta"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">Conta</div>
          )}
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-brand-dark/10 rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="p-4 border-b border-brand-dark/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                {me.avatarUrl ? (
                  <img src={me.avatarUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">-</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-brand-darker truncate">{label}</div>
                <div className="text-xs text-brand-darker/60 truncate">{me.email}</div>
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border bg-brand-orange/10 text-brand-orange border-brand-orange/20">
                {me.role.toLowerCase()}
              </span>
            </div>
          </div>
          <div className="p-2">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
            >
              <Settings className="w-4 h-4" />
              Minha conta
            </Link>
            {me.role === 'DEVELOPER' ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
              >
                <Shield className="w-4 h-4" />
                Painel
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-red-600/10 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      ) : null}

      <Modal open={confirmOpen} title="Confirmar saída" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-5">
          <div className="text-sm text-brand-darker/70">Deseja realmente sair?</div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
              onClick={() => setConfirmOpen(false)}
              disabled={logoutLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
              onClick={() => void onLogout()}
              disabled={logoutLoading}
            >
              {logoutLoading ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
