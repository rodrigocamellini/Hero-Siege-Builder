'use client';

import { Link } from 'react-router-dom';
import { StandardPage } from '../components/StandardPage';
import { useLanguage } from '../i18n/LanguageProvider';

export function TreeLandingPage() {
  const { t } = useLanguage();

  return (
    <StandardPage title="Tree | Hero Siege Builder" description="Choose Ether or Incarnation tree." canonicalPath="/tree">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Tree</h1>
        <p className="mt-2 text-sm text-brand-darker/60">{t.treeLanding.subtitle}</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/tree/ether"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.treeLanding.ether}</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.treeLanding.etherDesc}</div>
          </Link>
          <Link
            to="/tree/incarnation"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.treeLanding.incarnation}</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.treeLanding.incarnationDesc}</div>
          </Link>
        </div>
      </div>
    </StandardPage>
  );
}
