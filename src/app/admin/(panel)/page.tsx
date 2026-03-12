export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  return (
    <main className="space-y-6">
      <div className="bg-white border border-brand-dark/10 rounded-2xl p-6">
        <h1 className="font-heading font-bold text-2xl uppercase tracking-tight text-brand-darker">Dashboard</h1>
        <div className="mt-2 text-xs text-brand-darker/60">Área protegida por role DEVELOPER.</div>
      </div>
    </main>
  );
}
