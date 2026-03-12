import { LoginForm } from '../../features/auth/LoginForm';

export default function Page() {
  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-14 w-auto object-contain" />
          <div className="text-center space-y-1">
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Entrar</h1>
            <p className="text-xs text-brand-darker/60">Faça login para acessar sua conta.</p>
          </div>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
