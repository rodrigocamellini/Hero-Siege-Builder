import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '../../server/prisma';
import { BootstrapForm } from '../../features/auth/BootstrapForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect('/login');

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-14 w-auto object-contain" />
          <div className="text-center space-y-1">
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Criar Admin</h1>
            <p className="text-xs text-brand-darker/60">Primeiro acesso: cria um usuário DEVELOPER e inicia sessão.</p>
          </div>
        </div>

        <BootstrapForm />

        <div className="text-center text-xs text-brand-darker/60">
          Já tem conta? <Link href="/login" className="text-brand-orange font-bold hover:underline">Entrar</Link>
        </div>
      </div>
    </main>
  );
}
