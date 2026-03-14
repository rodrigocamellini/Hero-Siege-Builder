import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ListOrdered, LogOut, Settings, Shield, User } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { firebaseAuth, firestore } from '../../firebase';
import { useAuth } from './AuthProvider';

export function UserMenu() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      try {
        const snap = await getDoc(doc(firestore, 'appSettings', 'public'));
        const data = snap.exists() ? (snap.data() as { registrationEnabled?: unknown }) : null;
        setRegistrationEnabled(data?.registrationEnabled !== false);
      } catch {}
    };
    void load();
  }, []);

  async function onLogout() {
    setLogoutLoading(true);
    try {
      await signOut(firebaseAuth);
      setOpen(false);
      setConfirmOpen(false);
      navigate('/login', { replace: true });
    } finally {
      setLogoutLoading(false);
    }
  }

  const displayLabel = profile?.nick ?? profile?.displayName ?? user?.displayName ?? user?.email ?? '';
  const avatarUrl = profile?.photoURL ?? user?.photoURL ?? null;
  const callbackUrl = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const isAdmin = !!adminEmail && !!user?.email && user.email.trim().toLowerCase() === adminEmail;
  const effectiveRole = isAdmin ? 'DEVELOPER' : (profile?.role ?? 'USER');
  const roleLabel =
    effectiveRole === 'DEVELOPER'
      ? 'Developer'
      : effectiveRole === 'PARTNER'
        ? 'Partner'
        : effectiveRole === 'MODERATOR'
          ? 'Moderator'
          : effectiveRole === 'CONTRIBUTOR'
            ? 'Contributor'
            : 'User';
  const roleStyle =
    effectiveRole === 'DEVELOPER'
      ? 'bg-brand-orange/10 text-brand-orange border-brand-orange/20'
      : effectiveRole === 'PARTNER'
        ? 'bg-purple-600/10 text-purple-700 border-purple-600/20'
        : effectiveRole === 'MODERATOR'
          ? 'bg-blue-600/10 text-blue-700 border-blue-600/20'
          : effectiveRole === 'CONTRIBUTOR'
            ? 'bg-green-600/10 text-green-700 border-green-600/20'
            : 'bg-white/90 text-brand-darker/60 border-brand-dark/10';

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
        className={user ? 'p-1 rounded-xl hover:bg-brand-bg transition-colors' : 'bg-brand-orange p-2 rounded-lg hover:bg-brand-orange-dark transition-all hover:scale-105 active:scale-95 shadow-sm'}
        aria-label={user ? 'Account' : 'Sign in'}
      >
        {user ? (
          <div className="relative w-10 h-10 rounded-xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayLabel} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
          {user ? (
            <div className="p-4 border-b border-brand-dark/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayLabel} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">-</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-sm font-bold text-brand-darker truncate">{displayLabel}</div>
                    <div
                      className={[
                        'shrink-0 px-2 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest',
                        effectiveRole === 'USER' ? 'bg-brand-bg text-brand-darker/60 border-brand-dark/10' : roleStyle,
                      ].join(' ')}
                    >
                      {roleLabel}
                    </div>
                  </div>
                  <div className="text-xs text-brand-darker/60 truncate">{user.email}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-brand-dark/10">
              <div className="text-sm font-bold text-brand-darker">Account</div>
              <div className="mt-1 text-xs text-brand-darker/60">Sign in to access your menu.</div>
            </div>
          )}
          <div className="p-2">
            {user ? (
              <>
                <Link
                  to="/account/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Account
                </Link>
                <Link
                  to="/tierlist"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                >
                  <ListOrdered className="w-4 h-4" />
                  Vote Tier List
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin"
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
                  to={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
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
                    to={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
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
