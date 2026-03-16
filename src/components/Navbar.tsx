import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Language, Translation } from '../i18n/translations';
import { UserMenu } from '../features/auth/UserMenu';

export function Navbar({ lang, setLang, t }: { lang: Language; setLang: (l: Language) => void; t: Translation }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileDatabaseOpen, setIsMobileDatabaseOpen] = useState(false);
  const [isMobileTreeOpen, setIsMobileTreeOpen] = useState(false);

  const navItems = [
    { label: t.nav[0], href: '/' },
    {
      label: t.nav[1],
      href: '#',
      children: [
        { label: t.nav[2], href: '/database/classes' },
        { label: t.nav[3], href: '/database/items' },
        { label: 'Runes', href: '/database/runes' },
        { label: 'Relics', href: '/database/relics' },
        { label: 'Chaos Tower', href: '/database/chaos-tower' },
        { label: 'Mercenaries', href: '/database/mercenarios' },
        { label: 'Keys', href: '/database/chaves' },
        { label: 'Augments', href: '/database/augments' },
        { label: 'Quests', href: '/database/quests' },
        { label: 'Mining', href: '/database/mineracao' },
        { label: 'Gems & Jewels', href: '/database/gems' },
        { label: 'Charms', href: '/database/charms' },
      ],
    },
    {
      label: t.nav[4],
      href: '#',
      children: [
        { label: 'Ether', href: '/tree/ether', badge: 'New' },
        { label: 'Incarnation', href: '/tree/incarnation', badge: 'New' },
      ],
    },
    { label: t.nav[5], href: '/blog' },
    { label: t.nav[6], href: '/forum' },
    { label: t.teamLabel, href: '/team' },
    { label: t.nav[7], href: '/contact' },
  ];

  return (
    <nav className="bg-white border-b border-brand-dark/10 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center group cursor-pointer">
          <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-10 md:h-12 w-auto object-contain" />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {navItems.map((item, idx) =>
            item.children ? (
              <div key={item.label} className="relative group">
                <button
                  type="button"
                  className={`font-heading font-bold text-sm uppercase tracking-wider transition-all hover:text-brand-orange text-brand-darker inline-flex items-center gap-2`}
                >
                  {item.label}
                  <ChevronDown className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="absolute left-0 top-full pt-2 hidden group-hover:block">
                  <div className="min-w-48 bg-white border border-brand-dark/10 rounded-2xl shadow-xl overflow-hidden">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        to={child.href}
                        className="block px-4 py-3 font-heading font-bold text-xs uppercase tracking-widest text-brand-darker hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                      >
                        <span className="flex items-center justify-between gap-4">
                          <span>{child.label}</span>
                          {'badge' in child && child.badge ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold tracking-widest uppercase animate-pulse">
                              {child.badge}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                className={`font-heading font-bold text-sm uppercase tracking-wider transition-all hover:text-brand-orange ${idx === 0 ? 'nav-link-active' : 'text-brand-darker'}`}
              >
                {item.label}
              </Link>
            )
          )}
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

          <UserMenu />

          <button
            onClick={() => {
              if (!isMenuOpen) {
                setIsMobileDatabaseOpen(false);
                setIsMobileTreeOpen(false);
              }
              setIsMenuOpen(!isMenuOpen);
            }}
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
              <Link
                to="/"
                className="font-heading font-bold text-lg uppercase tracking-wider text-brand-darker hover:text-brand-orange transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {navItems[0].label}
              </Link>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsMobileDatabaseOpen((v) => !v)}
                  className="w-full font-heading font-bold text-lg uppercase tracking-wider text-brand-darker hover:text-brand-orange transition-colors flex items-center justify-between"
                >
                  <span>{navItems[1].label}</span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isMobileDatabaseOpen ? 'rotate-180' : ''}`} />
                </button>
                {isMobileDatabaseOpen ? (
                  <div className="pl-4 flex flex-col gap-2">
                    {navItems[1].children?.map((child) => (
                      <Link
                        key={child.label}
                        to={child.href}
                        className="font-heading font-bold text-sm uppercase tracking-wider text-brand-darker/80 hover:text-brand-orange transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsMobileTreeOpen((v) => !v)}
                  className="w-full font-heading font-bold text-lg uppercase tracking-wider text-brand-darker hover:text-brand-orange transition-colors flex items-center justify-between"
                >
                  <span>{navItems[2].label}</span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isMobileTreeOpen ? 'rotate-180' : ''}`} />
                </button>
                {isMobileTreeOpen ? (
                  <div className="pl-4 flex flex-col gap-2">
                    {navItems[2].children?.map((child) => (
                      <Link
                        key={child.label}
                        to={child.href}
                        className="font-heading font-bold text-sm uppercase tracking-wider text-brand-darker/80 hover:text-brand-orange transition-colors flex items-center justify-between gap-4"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <span>{child.label}</span>
                        {'badge' in child && child.badge ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold tracking-widest uppercase animate-pulse">
                            {child.badge}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              {navItems.slice(3).map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="font-heading font-bold text-lg uppercase tracking-wider text-brand-darker hover:text-brand-orange transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
