'use client';

import type { Translation } from '../i18n/translations';

type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

const tierColors: Record<Tier, { border: string; bg: string; solid: string }> = {
  S: { border: 'border-red-500/30', bg: 'bg-red-500/10', solid: 'bg-red-500' },
  A: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', solid: 'bg-orange-500' },
  B: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', solid: 'bg-yellow-500' },
  C: { border: 'border-lime-500/30', bg: 'bg-lime-500/10', solid: 'bg-lime-500' },
  D: { border: 'border-emerald-600/30', bg: 'bg-emerald-600/10', solid: 'bg-emerald-600' },
  E: { border: 'border-brand-dark/15', bg: 'bg-brand-dark/5', solid: 'bg-brand-dark/40' },
};

const classNames: Record<string, string> = {
  amazon: 'Amazon',
  bard: 'Bard',
  butcher: 'Butcher',
  demonspawn: 'Demonspawn',
  demonslayer: 'Demon Slayer',
  exo: 'Exo',
  illusionist: 'Illusionist',
  jotunn: 'Jötunn',
  marauder: 'Marauder',
  marksman: 'Marksman',
  necromancer: 'Necromancer',
  nomad: 'Nomad',
  paladin: 'Paladin',
  pirate: 'Pirate',
  plaguedoctor: 'Plague Doctor',
  prophet: 'Prophet',
  pyromancer: 'Pyromancer',
  redneck: 'Redneck',
  samurai: 'Samurai',
  shaman: 'Shaman',
  shieldlancer: 'Shield Lancer',
  stormweaver: 'Stormweaver',
  viking: 'Viking',
  whitemage: 'White Mage',
};

function getClassDisplayName(cls: string) {
  return classNames[cls] ?? cls;
}

const tiers: Array<{ tier: Tier; classes: string[] }> = [
  { tier: 'S', classes: ['stormweaver', 'demonslayer', 'jotunn', 'viking', 'prophet'] },
  { tier: 'A', classes: ['samurai', 'paladin', 'marksman', 'nomad', 'amazon', 'pyromancer', 'demonspawn'] },
  { tier: 'B', classes: ['redneck', 'pirate', 'shieldlancer', 'marauder', 'plaguedoctor', 'bard'] },
  { tier: 'C', classes: ['shaman', 'whitemage'] },
  { tier: 'D', classes: ['necromancer', 'illusionist'] },
  { tier: 'E', classes: ['exo', 'butcher'] },
];

export function SeasonTierList({ t }: { t: Translation }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-brand-dark/5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading font-bold text-lg uppercase tracking-tight text-brand-darker">{t.seasonTierList.title}</h3>
          <p className="text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">{t.seasonTierList.subtitle}</p>
        </div>
        <div className="text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest text-right">{t.seasonTierList.updated}</div>
      </div>

      <div className="mt-6 space-y-3">
        {tiers.map((row) => {
          const c = tierColors[row.tier];
          return (
            <div key={row.tier} className={`relative rounded-2xl overflow-hidden border ${c.border}`}>
              <div className={`absolute inset-0 ${c.bg}`} />
              <div className="relative flex items-start gap-4 p-3">
                <div className={`w-10 h-10 rounded-xl border ${c.border} ${c.solid} flex items-center justify-center flex-shrink-0`}>
                  <span className="font-heading font-bold text-xl text-white">{row.tier}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {row.classes.map((cls) => (
                    <div
                      key={`${row.tier}-${cls}`}
                      className="group relative w-10 h-10 md:w-11 md:h-11 bg-white/70 rounded-xl border border-brand-dark/10 overflow-hidden flex items-center justify-center backdrop-blur"
                      title={getClassDisplayName(cls)}
                      aria-label={getClassDisplayName(cls)}
                      tabIndex={0}
                    >
                      <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-20">
                        <div className="bg-brand-darker text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                          {getClassDisplayName(cls)}
                        </div>
                      </div>
                      <img
                        src={`/images/classes/${cls}.webp`}
                        alt={getClassDisplayName(cls)}
                        className="w-full h-full object-contain pixelated"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
