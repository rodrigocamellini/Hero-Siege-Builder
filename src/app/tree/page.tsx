import Link from 'next/link';
import { StandardPage } from '../../components/StandardPage';

export default function Page() {
  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Tree</h1>
        <p className="mt-2 text-sm text-brand-darker/60">Escolha uma seção.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <Link href="/tree/ether" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Ether</div>
            <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
          </Link>
          <Link href="/tree/incarnation" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Incarnation</div>
            <div className="mt-2 text-sm text-brand-darker/60">Em breve.</div>
          </Link>
        </div>
      </div>
    </StandardPage>
  );
}

