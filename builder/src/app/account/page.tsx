import Link from 'next/link';
import { getCurrentUser } from '../../server/auth';
import { LogoutButton } from '../../features/auth/LogoutButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Minha Conta</h1>
            <p className="text-xs text-brand-darker/60">Sessão e permissões.</p>
          </div>
          {user ? <LogoutButton /> : null}
        </div>

        <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
          {user ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-bg border border-brand-dark/10 overflow-hidden flex items-center justify-center">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.nick ?? user.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/40">Sem foto</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Nick</div>
                  <div className="font-bold text-brand-darker">{user.nick ?? '-'}</div>
                </div>
              </div>

              <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Email</div>
              <div className="font-bold text-brand-darker">{user.email}</div>

              <div className="pt-4 border-t border-brand-dark/10 space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Nome (opcional)</div>
                <div className="font-bold text-brand-darker">{user.displayName ?? '-'}</div>
              </div>

              <div className="pt-4 border-t border-brand-dark/10 space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-brand-darker/60">Role</div>
                <div className="font-bold text-brand-darker">{user.role}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-bold text-brand-darker">Você não está logado.</div>
              <Link href="/login" className="text-brand-orange font-bold hover:underline">
                Ir para login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
