'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { BuildItem } from '../../components/BuildItem';
import { NewsCard } from '../../components/NewsCard';
import { SeasonTierList } from '../../components/SeasonTierList';
import { Footer } from '../../components/Footer';
import { Hero } from '../../components/Hero';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { translations, type Language } from '../../i18n/translations';

export function HomePage() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar lang={lang} setLang={setLang} t={t} />

      <main className="flex-grow">
        <Hero t={t} />

        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
          <div className="lg:col-span-3 space-y-12 md:space-y-16">
            <section>
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h2 className="font-heading font-bold text-2xl md:text-3xl uppercase tracking-tight">{t.popularClasses}</h2>
                <button className="flex items-center gap-2 bg-brand-orange text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-bold text-xs md:text-sm hover:bg-brand-orange-dark transition-colors">
                  <Filter className="w-3 h-3 md:w-4 md:h-4" />
                  {t.filter}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {t.homeNews.map((n) => (
                  <NewsCard key={n.title} title={n.title} description={n.desc} image={n.image} btnText={t.createBuild} />
                ))}
              </div>
            </section>

            <section>
              <SeasonTierList t={t} />
            </section>

            <section>
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h2 className="font-heading font-bold text-2xl md:text-3xl uppercase tracking-tight">{t.latestBuilds}</h2>
                <button className="flex items-center gap-2 bg-brand-orange text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-bold text-xs md:text-sm hover:bg-brand-orange-dark transition-colors">
                  <Filter className="w-3 h-3 md:w-4 md:h-4" />
                  {t.filter}
                </button>
              </div>
              <div className="space-y-4">
                <BuildItem
                  title="Sword Build"
                  creator="Rond5aion"
                  rating={5}
                  items={['https://picsum.photos/seed/item1/40/40', 'https://picsum.photos/seed/item2/40/40', 'https://picsum.photos/seed/item3/40/40', 'https://picsum.photos/seed/item4/40/40']}
                  createdByText={t.createdBy}
                />
                <BuildItem
                  title="Pyromancer Build"
                  creator="Pyromancer"
                  rating={4}
                  items={['https://picsum.photos/seed/item5/40/40', 'https://picsum.photos/seed/item6/40/40', 'https://picsum.photos/seed/item7/40/40', 'https://picsum.photos/seed/item8/40/40']}
                  createdByText={t.createdBy}
                />
                <BuildItem
                  title="Viking Build"
                  creator="Rend2mon"
                  rating={4}
                  items={['https://picsum.photos/seed/item9/40/40', 'https://picsum.photos/seed/item10/40/40', 'https://picsum.photos/seed/item11/40/40', 'https://picsum.photos/seed/item12/40/40']}
                  createdByText={t.createdBy}
                />
                <BuildItem
                  title="Viking Build"
                  creator="Raonit"
                  rating={5}
                  items={['https://picsum.photos/seed/item13/40/40', 'https://picsum.photos/seed/item14/40/40', 'https://picsum.photos/seed/item15/40/40', 'https://picsum.photos/seed/item16/40/40']}
                  createdByText={t.createdBy}
                />
              </div>
            </section>
          </div>

          <Sidebar t={t} />
        </div>
      </main>

      <Footer t={t} currentYear={currentYear} />
    </div>
  );
}
