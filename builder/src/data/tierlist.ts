export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export const tierOrder: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E'];

export const classKeys = [
  'amazon',
  'bard',
  'butcher',
  'demonspawn',
  'demonslayer',
  'exo',
  'illusionist',
  'jotunn',
  'marauder',
  'marksman',
  'necromancer',
  'nomad',
  'paladin',
  'pirate',
  'plaguedoctor',
  'prophet',
  'pyromancer',
  'redneck',
  'samurai',
  'shaman',
  'shieldlancer',
  'stormweaver',
  'viking',
  'whitemage',
] as const;

export type ClassKey = (typeof classKeys)[number];

export const classNames: Record<ClassKey, string> = {
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

export function getClassDisplayName(cls: string) {
  return (classNames as Record<string, string>)[cls] ?? cls;
}

