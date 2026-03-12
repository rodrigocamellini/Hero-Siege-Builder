'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { translations, type Language } from '../i18n/translations';

export function StandardPage({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('en');
  const t = useMemo(() => translations[lang], [lang]);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar lang={lang} setLang={setLang} t={t} />
      <main className="flex-grow">{children}</main>
      <Footer t={t} currentYear={currentYear} />
    </div>
  );
}

