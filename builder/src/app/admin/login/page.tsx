import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../server/auth';
import { AdminLoginForm } from '../../../features/auth/AdminLoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (user?.role === 'DEVELOPER') redirect('/admin');

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-14 w-auto object-contain" />
          <div className="text-center space-y-1">
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Painel</h1>
            <p className="text-xs text-brand-darker/60">Acesso restrito a DEVELOPER.</p>
          </div>
        </div>

        <AdminLoginForm redirectTo="/admin" storageKey="hsb_admin_login" />
      </div>
    </main>
  );
}
