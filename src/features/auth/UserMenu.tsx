'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LogOut, Shield, User } from 'lucide-react';
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings/registration', { method: 'GET' });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; enabled?: boolean } | null;
        if (!res.ok || !data?.ok) return;
        setRegistrationEnabled(data.enabled !== false);
      } catch {}
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
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  }

  const label = me?.nick ?? me?.displayName ?? me?.email ?? '';
  const callbackUrl = (() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-lg bg-brand-bg border border-brand-dark/10 animate-pulse hidden sm:block" />
    );
  }

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={me ? 'p-1 rounded-xl hover:bg-brand-bg transition-colors' : 'bg-brand-orange p-2 rounded-lg hover:bg-brand-orange-dark transition-all hover:scale-105 active:scale-95 shadow-sm'}
        aria-label={me ? 'Account' : 'Sign in'}
      >
        {me ? (
          <div className="w-10 h-10 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
            {me.avatarUrl ? (
              <img src={me.avatarUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">Account</div>
            )}
          </div>
        ) : (
          <User className="text-white w-5 h-5" />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-brand-dark/10 rounded-2xl shadow-xl overflow-hidden z-50">
          {me ? (
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
          ) : (
            <div className="p-4 border-b border-brand-dark/10">
              <div className="text-sm font-bold text-brand-darker">Account</div>
              <div className="mt-1 text-xs text-brand-darker/60">Sign in to access your menu.</div>
            </div>
          )}
          <div className="p-2">
            {me ? (
              <>
                <Link
                  href="/account/tierlist"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                >
                  Vote Tier List
                </Link>
                {me.role === 'DEVELOPER' ? (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-red-600/10 hover:text-red-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Sign in
                  </span>
                </Link>
                {registrationEnabled ? (
                  <Link
                    href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                  >
                    Create account
                  </Link>
                ) : (
                  <div className="px-3 py-2 text-xs font-bold text-brand-darker/60">Account creation is disabled.</div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <Modal open={confirmOpen} title="Confirm sign out" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-5">
          <div className="text-sm text-brand-darker/70">Do you really want to sign out?</div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="bg-brand-bg border border-brand-dark/10 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-brand-darker hover:border-brand-orange transition-colors"
              onClick={() => setConfirmOpen(false)}
              disabled={logoutLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-60"
              onClick={() => void onLogout()}
              disabled={logoutLoading}
            >
              {logoutLoading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
