'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translations, type Language, type Translation } from './translations';

type LanguageContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  t: Translation;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function safeLang(v: unknown): Language | null {
  if (v === 'en' || v === 'pt' || v === 'ru') return v;
  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      return safeLang(window.localStorage.getItem('hsb_lang')) ?? 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      window.localStorage.setItem('hsb_lang', l);
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      const v = safeLang(window.localStorage.getItem('hsb_lang'));
      if (v && v !== lang) setLangState(v);
    } catch {
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, t: translations[lang] }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}

