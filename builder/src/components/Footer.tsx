'use client';

import Link from 'next/link';
import { Instagram, Twitch, Youtube } from 'lucide-react';
import type { Translation } from '../i18n/translations';

export function Footer({ t, currentYear }: { t: Translation; currentYear: number }) {
  function getHrefByIndex(idx: number) {
    if (idx === 0) return '/';
    if (idx === t.footerLinks.length - 1) return '/account';
    return '#';
  }

  return (
    <footer className="bg-brand-dark text-white py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <Link href="/" className="flex items-center opacity-80 group cursor-pointer">
            <img src="/images/logo.webp" alt="Hero Siege Builder" className="h-10 md:h-12 w-auto object-contain" />
          </Link>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40">
            {t.footerLinks.map((item, idx) => (
              <Link key={item} href={getHrefByIndex(idx)} className="hover:text-brand-orange transition-colors">
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Twitch className="w-5 h-5 text-white/40 hover:text-brand-orange cursor-pointer transition-colors" />
            <Instagram className="w-5 h-5 text-white/40 hover:text-brand-orange cursor-pointer transition-colors" />
            <Youtube className="w-5 h-5 text-white/40 hover:text-brand-orange cursor-pointer transition-colors" />
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 text-center text-[10px] text-white/20 uppercase tracking-[0.2em]">
          {t.rights.replace('{{year}}', String(currentYear))}
        </div>
      </div>
    </footer>
  );
}
