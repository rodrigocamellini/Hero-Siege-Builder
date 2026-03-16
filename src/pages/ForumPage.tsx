import { StandardPage } from '../components/StandardPage';

export function ForumPage() {
  return (
    <StandardPage title="Forum | Hero Siege Builder" description="Community forum (coming soon)." canonicalPath="/forum">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Forum</h1>
        <p className="mt-2 text-sm text-brand-darker/60">Em breve teremos conteúdo.</p>

        <div className="mt-8 bg-white border border-brand-dark/10 rounded-2xl p-8 text-center">
          <div className="font-heading font-black uppercase italic tracking-tight text-brand-darker text-2xl">Coming Soon</div>
          <div className="mt-3 text-sm text-brand-darker/60">We&apos;re preparing the forum. Check back soon.</div>
        </div>
      </div>
    </StandardPage>
  );
}
