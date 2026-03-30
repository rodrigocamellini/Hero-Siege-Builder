'use client';

import { Link } from 'react-router-dom';
import { StandardPage } from '../components/StandardPage';
import { useLanguage } from '../i18n/LanguageProvider';

export function DatabaseLandingPage() {
  const { t } = useLanguage();

  return (
    <StandardPage title="Database | Hero Siege Builder" description="Explore classes, items, and game data." canonicalPath="/database">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase tracking-tight text-brand-darker">Database</h1>
        <p className="mt-2 text-sm text-brand-darker/60">{t.databaseLanding.subtitle}</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Link
            to="/database/classes"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.databaseLanding.classes}</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.databaseLanding.classesDesc}</div>
          </Link>
          <Link
            to="/database/items"
            className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.databaseLanding.items}</div>
            <div className="mt-2 text-sm text-brand-darker/60">{t.databaseLanding.itemsDesc}</div>
          </Link>
          <Link to="/database/runes" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Runes</div>
            <div className="mt-2 text-sm text-brand-darker/60">Coming soon.</div>
          </Link>
          <Link to="/database/relics" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Relics</div>
            <div className="mt-2 text-sm text-brand-darker/60">Passive relic scaling and list.</div>
          </Link>
          <Link to="/database/chaos-tower" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Chaos Tower</div>
            <div className="mt-2 text-sm text-brand-darker/60">Event dungeon details and rewards.</div>
          </Link>
          <Link to="/database/mercenarios" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Mercenaries</div>
            <div className="mt-2 text-sm text-brand-darker/60">Mercenary types and skill tables.</div>
          </Link>
          <Link to="/database/chaves" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Keys</div>
            <div className="mt-2 text-sm text-brand-darker/60">Dungeon, unique zone, and chest keys.</div>
          </Link>
          <Link to="/database/augments" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Augments</div>
            <div className="mt-2 text-sm text-brand-darker/60">Angelic augments and upgrade rules.</div>
          </Link>
          <Link to="/database/quests" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Quests</div>
            <div className="mt-2 text-sm text-brand-darker/60">Quest log (under update).</div>
          </Link>
          <Link to="/database/mineracao" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Mining</div>
            <div className="mt-2 text-sm text-brand-darker/60">Nodes, levels, and prospecting results.</div>
          </Link>
          <Link to="/database/gems" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Gems &amp; Jewels</div>
            <div className="mt-2 text-sm text-brand-darker/60">Socketables and their effects.</div>
          </Link>
          <Link to="/database/charms" className="bg-white rounded-2xl border border-brand-dark/10 p-6 hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors">
            <div className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">Charms</div>
            <div className="mt-2 text-sm text-brand-darker/60">Charm list, tiers and rolls.</div>
          </Link>
        </div>
      </div>
    </StandardPage>
  );
}
