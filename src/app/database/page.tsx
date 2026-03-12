import Link from 'next/link';
import { StandardPage } from '../../components/StandardPage';

export default function Page() {
  return (
    <StandardPage>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Database</h1>
        <p className="mt-2 text-sm text-brand-darker/60">Explore classes, itens e dados do jogo.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <Link href="/database/classes" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Classes</div>
            <div className="mt-2 text-sm text-brand-darker/60">Lista de classes e informações.</div>
          </Link>
          <Link href="/database/items" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Items</div>
            <div className="mt-2 text-sm text-brand-darker/60">Base de itens do jogo.</div>
          </Link>
        </div>
      </div>
    </StandardPage>
  );
}

