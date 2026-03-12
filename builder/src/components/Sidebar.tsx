'use client';

import { ChevronDown, Star, User } from 'lucide-react';
import type { Translation } from '../i18n/translations';

export function Sidebar({ t }: { t: Translation }) {
  return (
    <aside className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <h3 className="font-heading font-bold text-lg mb-8 uppercase tracking-tight flex items-center justify-between">
          {t.topBuilders}
          <ChevronDown className="w-4 h-4 text-brand-dark/40" />
        </h3>
        <div className="space-y-6">
          {[
            { name: 'Eivrebrioose', rank: 1, stars: 4 },
            { name: 'Pyromancer', rank: 2, stars: 4 },
            { name: 'Marksman', rank: 3, stars: 4 },
            { name: 'Marksman', rank: 4, stars: 4 },
          ].map((builder, i) => (
            <div key={i} className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-brand-dark/30 w-4">{builder.rank}</span>
                <div className="w-9 h-9 md:w-10 md:h-10 bg-brand-bg rounded-full flex items-center justify-center border border-brand-dark/5 group-hover:bg-brand-orange/10 transition-colors">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-brand-dark/30" />
                </div>
                <span className="text-sm font-bold text-brand-darker group-hover:text-brand-orange transition-colors">{builder.name}</span>
              </div>
              <div className="flex gap-0.5">
                {[...Array(4)].map((_, j) => (
                  <Star key={j} className="w-3 h-3 text-brand-orange fill-current" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
        <h3 className="font-heading font-bold text-lg mb-8 uppercase tracking-tight">{t.gameUpdates}</h3>
        <div className="space-y-8">
          {t.updates.map((update, i) => (
            <div key={i} className="relative pl-6 group cursor-pointer">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-dark/5 group-hover:bg-brand-orange transition-colors rounded-full"></div>
              <h4 className="font-bold text-sm mb-1 group-hover:text-brand-orange transition-colors">{update.title}</h4>
              <p className="text-[10px] font-bold text-brand-dark/30 mb-2 uppercase tracking-wider">{update.date}</p>
              <p className="text-xs text-brand-dark/50 leading-relaxed">{update.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
