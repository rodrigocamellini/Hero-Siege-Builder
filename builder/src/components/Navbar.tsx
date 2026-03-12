'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, User, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Language, Translation } from '../i18n/translations';

export function Navbar({ lang, setLang, t }: { lang: Language; setLang: (l: Language) => void; t: Translation }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function getHrefByIndex(idx: number) {
    if (idx === 0) return '/';
    if (idx === t.nav.length - 1) return '/account';
    return '#';
  }

  return (
    <nav className="bg-white border-b border-brand-dark/10 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center group cursor-pointer">
          <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-10 md:h-12 w-auto object-contain" />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {t.nav.map((item, idx) => (
            <Link
              key={item}
              href={getHrefByIndex(idx)}
              className={`font-heading font-bold text-sm uppercase tracking-wider transition-all hover:text-brand-orange ${idx === 0 ? 'nav-link-active' : 'text-brand-darker'}`}
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center gap-2 border-r border-brand-dark/10 pr-4 mr-2">
            <button
              onClick={() => setLang('en')}
              className={`w-6 h-4 overflow-hidden rounded-sm border transition-all ${lang === 'en' ? 'border-brand-orange scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
              title="English"
            >
              <img src="https://flagcdn.com/w40/us.png" alt="USA" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
            <button
              onClick={() => setLang('pt')}
              className={`w-6 h-4 overflow-hidden rounded-sm border transition-all ${lang === 'pt' ? 'border-brand-orange scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
              title="Português"
            >
              <img src="https://flagcdn.com/w40/br.png" alt="Brazil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
            <button
              onClick={() => setLang('ru')}
              className={`w-6 h-4 overflow-hidden rounded-sm border transition-all ${lang === 'ru' ? 'border-brand-orange scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
              title="Русский"
            >
              <img src="https://flagcdn.com/w40/ru.png" alt="Russia" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          </div>

          <button className="p-2 hover:bg-brand-bg rounded-full transition-colors hidden md:block">
            <Search className="w-5 h-5 text-brand-darker" />
          </button>

          <Link
            href="/account"
            className="bg-brand-orange p-2 rounded-lg cursor-pointer hover:bg-brand-orange-dark transition-all hover:scale-105 active:scale-95 shadow-sm hidden sm:block"
          >
            <User className="text-white w-5 h-5" />
          </Link>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 hover:bg-brand-bg rounded-lg transition-colors text-brand-darker"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t border-brand-dark/5 overflow-hidden"
          >
            <div className="flex flex-col p-4 space-y-4">
              {t.nav.map((item, idx) => (
                <Link
                  key={item}
                  href={getHrefByIndex(idx)}
                  className="font-heading font-bold text-lg uppercase tracking-wider text-brand-darker hover:text-brand-orange transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item}
                </Link>
              ))}

              <div className="pt-4 border-t border-brand-dark/5 flex flex-col space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dark/30" />
                  <input
                    type="text"
                    placeholder={lang === 'en' ? 'Search builds...' : lang === 'pt' ? 'Buscar builds...' : 'Поиск билдов...'}
                    className="w-full bg-brand-bg border border-brand-dark/5 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-orange transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-brand-dark/40">Language:</span>
                  <div className="flex gap-3">
                    <button onClick={() => setLang('en')} className={`w-8 h-5 rounded border ${lang === 'en' ? 'border-brand-orange' : 'border-transparent'}`}>
                      <img src="https://flagcdn.com/w40/us.png" alt="USA" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                    <button onClick={() => setLang('pt')} className={`w-8 h-5 rounded border ${lang === 'pt' ? 'border-brand-orange' : 'border-transparent'}`}>
                      <img src="https://flagcdn.com/w40/br.png" alt="Brazil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                    <button onClick={() => setLang('ru')} className={`w-8 h-5 rounded border ${lang === 'ru' ? 'border-brand-orange' : 'border-transparent'}`}>
                      <img src="https://flagcdn.com/w40/ru.png" alt="Russia" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  </div>
                </div>

                <Link
                  href="/account"
                  className="orange-button w-full py-3 flex items-center justify-center gap-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="w-5 h-5" />
                  {t.nav[t.nav.length - 1]}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
