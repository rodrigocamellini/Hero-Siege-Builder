import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Users } from 'lucide-react';
import { requireUser } from '../../../server/auth';
import { LogoutButton } from '../../../features/auth/LogoutButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) redirect(auth.status === 401 ? '/admin/login' : '/account');

  const roleBadgeClass =
    auth.user.role === 'DEVELOPER'
      ? 'bg-purple-600/10 text-purple-700 border-purple-600/20'
      : auth.user.role === 'MODERATOR'
        ? 'bg-blue-600/10 text-blue-700 border-blue-600/20'
        : auth.user.role === 'CONTRIBUTOR'
          ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20'
          : auth.user.role === 'PARTNER'
            ? 'bg-amber-600/10 text-amber-700 border-amber-600/20'
            : 'bg-brand-dark/5 text-brand-darker/70 border-brand-dark/10';

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="border-b border-brand-dark/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-9 w-auto object-contain" />
            <span className="font-heading font-bold uppercase tracking-wider text-brand-darker">Painel</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs font-bold text-brand-darker/50">{auth.user.email}</div>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="bg-white border border-brand-dark/10 rounded-2xl p-4 h-fit">
          <div className="pb-4 border-b border-brand-dark/10">
            <Link
              href="/admin/account"
              className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-brand-bg transition-colors"
            >
              <div className="w-11 h-11 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                {auth.user.avatarUrl ? (
                  <img
                    src={auth.user.avatarUrl}
                    alt={auth.user.nick ?? auth.user.email}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40">Sem foto</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-brand-darker truncate">{auth.user.nick ?? auth.user.email}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border ${roleBadgeClass}`}>
                    {auth.user.role.toLowerCase()}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/40 group-hover:text-brand-orange transition-colors">
                    Ver conta
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <nav className="pt-4 space-y-2">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-brand-darker hover:bg-brand-bg transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-brand-dark/40" />
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-brand-darker hover:bg-brand-bg transition-colors"
            >
              <Users className="w-4 h-4 text-brand-dark/40" />
              Usuários
            </Link>
          </nav>
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
