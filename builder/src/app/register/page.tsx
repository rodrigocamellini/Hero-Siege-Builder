import { Suspense } from 'react';
import Link from 'next/link';
import { RegisterForm } from '../../features/auth/RegisterForm';

export default function Page() {
  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-14 w-auto object-contain" />
          <div className="text-center space-y-1">
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Create Account</h1>
            <p className="text-xs text-brand-darker/60">Create an account to vote and save preferences.</p>
          </div>
        </div>

        <Suspense fallback={<div className="w-full max-w-md bg-white border border-brand-dark/10 rounded-2xl p-6" />}>
          <RegisterForm />
        </Suspense>

        <div className="text-center text-xs text-brand-darker/60">
          Already have an account? <Link href="/login" className="text-brand-orange font-bold hover:underline">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
