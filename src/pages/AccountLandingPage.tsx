'use client';

import { Link } from 'react-router-dom';
import { StandardPage } from '../components/StandardPage';
import { useLanguage } from '../i18n/LanguageProvider';

export function AccountLandingPage() {
  const { t } = useLanguage();

  return (
    <StandardPage title="Account | Hero Siege Builder" description="Account options." canonicalPath="/account" noindex>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">{t.account.heading}</h1>
        <p className="mt-2 text-sm text-brand-darker/60">{t.account.subtitle}</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/account/settings"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.account.settings}</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.account.settingsDesc}</div>
          </Link>
          <Link
            to="/account/tierlist"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.account.tierList}</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.account.tierListDesc}</div>
          </Link>
        </div>
      </div>
    </StandardPage>
  );
}

