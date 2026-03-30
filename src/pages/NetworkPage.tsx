import { Link } from 'react-router-dom';
import { StandardPage } from '../components/StandardPage';
import { useLanguage } from '../i18n/LanguageProvider';

export function NetworkPage() {
  const { t } = useLanguage();
  return (
    <StandardPage title="Network | Hero Siege Builder" description="Partners and Team." canonicalPath="/network">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Network</h1>
        <p className="mt-2 text-sm text-brand-darker/60">{t.networkLanding.subtitle}</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/partners"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Partners</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.networkLanding.partnersDesc}</div>
          </Link>
          <Link
            to="/team"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Team</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.networkLanding.teamDesc}</div>
          </Link>
        </div>
      </div>
    </StandardPage>
  );
}
