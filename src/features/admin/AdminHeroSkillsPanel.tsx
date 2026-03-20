import { useState, useEffect } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { firestore } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { classKeys, classNames, type ClassKey } from '../../data/tierlist';
import { Save, RefreshCw, CheckCircle2, Circle, Plus, Download, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const legacyFirebaseConfig = {
  apiKey: 'AIzaSyDCgl4dbGTJUH-0bsGsisO9KbWYoIN3KU4',
  authDomain: 'herosiege-ef56f.firebaseapp.com',
  projectId: 'herosiege-ef56f',
  storageBucket: 'herosiege-ef56f.firebasestorage.app',
  messagingSenderId: '147989943940',
  appId: '1:147989943940:web:3b107b85598b7033fd94d1',
};

function getLegacyDb() {
  const name = 'herosiegebrasil_import';
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp(legacyFirebaseConfig, name);
  return getFirestore(app);
}

function classDocIdFromKey(key: ClassKey) {
  switch (key) {
    case 'demonslayer': return 'demon-slayer';
    case 'whitemage': return 'white-mage';
    case 'plaguedoctor': return 'plague-doctor';
    case 'shieldlancer': return 'shield-lancer';
    default: return key;
  }
}

interface SkillSlot {
  id: string;
  name: string;
  description: string;
  icon: string;
  hasSubTree: boolean;
  position: number;
}

interface ClassSkills {
  t1: string;
  t2: string;
  tree1: SkillSlot[];
  tree2: SkillSlot[];
}

// Initial empty grid helper
const createEmptyTree = (prefix: string): SkillSlot[] => {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `empty-${prefix}-${i}`,
    name: '',
    description: '',
    icon: '',
    hasSubTree: false,
    position: i
  }));
};

// Data extracted from hero-siege-brasil/src/HeroSkills.js
const LEGACY_BUILDER_DB: Record<string, any> = {
  viking: {
    t1: 'Berserker', t2: 'Shield Bearer',
    s1: [
      { n: 'Seismic Slam', r: 1, c: 1 }, { n: 'Brute Force', r: 1, c: 3 },
      { n: 'Throw', r: 2, c: 1 }, { n: 'Zeal', r: 2, c: 2 },
      { n: "Ymirs Champion", r: 3, c: 2 }, { n: 'Whirlwind', r: 3, c: 3 },
      { n: 'Shockwave', r: 4, c: 1 }, { n: 'Berserk', r: 4, c: 2 },
      { n: 'Demolishing Winds', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Weapon Master', r: 1, c: 2 }, { n: 'Charge', r: 1, c: 3 },
      { n: 'Stoneskin', r: 2, c: 1 }, { n: 'Devastating Charge', r: 2, c: 3 },
      { n: 'Norse Resistance', r: 3, c: 1 }, { n: 'Defensive Shout', r: 3, c: 2 },
      { n: "Odins Fury", r: 4, c: 2 }, { n: 'Battle Agility', r: 4, c: 3 },
      { n: 'Combat Orders', r: 5, c: 2 }
    ]
  },
  pyromancer: {
    t1: 'Fire Mage', t2: 'Burning Soul',
    s1: [
      { n: 'Fireball', r: 1, c: 1 }, { n: 'Phoenix Flight', r: 1, c: 3 },
      { n: 'Fire Nova', r: 2, c: 1 }, { n: 'Scorching Aura', r: 2, c: 2 },
      { n: 'Volcano', r: 3, c: 2 }, { n: 'Blazing Trail', r: 3, c: 3 },
      { n: 'Hydra', r: 4, c: 1 }, { n: 'Comet', r: 4, c: 2 },
      { n: 'Meteor', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Inferno Slash', r: 1, c: 2 }, { n: 'Ignite', r: 1, c: 3 },
      { n: 'Fire Shield', r: 2, c: 1 }, { n: 'Armageddon', r: 3, c: 2 },
      { n: 'Fire Enchant', r: 4, c: 1 }, { n: 'Searing Chains', r: 4, c: 3 },
      { n: 'Fiery Presence', r: 5, c: 1 }, { n: 'Breath of Fire', r: 5, c: 2 },
      { n: 'Avatar of Fire', r: 5, c: 3 }
    ]
  },
  marksman: {
    t1: 'Hunter', t2: 'Marksman',
    s1: [
      { n: 'Arrow Rain', r: 1, c: 1 }, { n: 'Agility', r: 1, c: 3 },
      { n: 'Multishot', r: 2, c: 1 }, { n: 'Homing Missile', r: 2, c: 2 },
      { n: 'Volatile Shot', r: 3, c: 2 }, { n: 'Critical Accuracy', r: 3, c: 3 },
      { n: 'Arrow Turret', r: 4, c: 1 }, { n: 'Trickshot', r: 4, c: 2 },
      { n: 'Master Mechanic', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Turret Mastery', r: 1, c: 2 }, { n: 'Arrow Rampage', r: 1, c: 3 },
      { n: 'Gunner Drone', r: 2, c: 1 }, { n: 'Frag Grenade', r: 2, c: 3 },
      { n: 'Vault', r: 3, c: 1 }, { n: 'Rocket Turret', r: 3, c: 2 },
      { n: 'Landmine', r: 4, c: 2 }, { n: 'Cannon Turret', r: 4, c: 3 },
      { n: 'Beacon', r: 5, c: 2 }
    ]
  },
  pirate: {
    t1: 'Shipmaster', t2: 'Cannoneer',
    s1: [
      { n: 'Anchor Swing', r: 1, c: 1 }, { n: 'Land Ahoy', r: 1, c: 3 },
      { n: 'Parrot', r: 2, c: 1 }, { n: 'Set Sail', r: 2, c: 2 },
      { n: 'Powder Trail', r: 3, c: 2 }, { n: 'Kneecap', r: 3, c: 3 },
      { n: 'Torrent', r: 4, c: 1 }, { n: 'Grenade Jump', r: 4, c: 2 },
      { n: 'Treasure Hunter', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Cannonball', r: 1, c: 2 }, { n: 'Bomb Barrage', r: 1, c: 3 },
      { n: 'Freezing Chain Shot', r: 2, c: 1 }, { n: 'Explosive Bullets', r: 2, c: 3 },
      { n: 'Frozen Lead', r: 3, c: 1 }, { n: 'Remiges', r: 3, c: 2 },
      { n: 'Buckshot', r: 4, c: 2 }, { n: 'Rapid Fire', r: 4, c: 3 },
      { n: 'Explosive Barrel', r: 5, c: 2 }
    ]
  },
  nomad: {
    t1: 'Sand Walker', t2: 'Desert Blade',
    s1: [
      { n: 'Sand Vortex', r: 1, c: 1 }, { n: 'Sand Gush', r: 1, c: 3 },
      { n: 'Healing Sunrays', r: 2, c: 1 }, { n: 'Mystic Sand', r: 2, c: 2 },
      { n: 'Sand Carver', r: 3, c: 2 }, { n: 'Chainslice', r: 3, c: 3 },
      { n: 'Dissipating Tornado', r: 4, c: 1 }, { n: 'Blade Strike', r: 4, c: 2 },
      { n: 'Sand Entombment', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Eye of Ra', r: 1, c: 2 }, { n: 'Cloud of Sand', r: 1, c: 3 },
      { n: 'Oasis Aura', r: 2, c: 1 }, { n: 'Phantom Blade', r: 2, c: 3 },
      { n: 'Rupture', r: 3, c: 1 }, { n: 'Flying Scimitar', r: 3, c: 2 },
      { n: 'Scimitar Charge', r: 4, c: 2 }, { n: 'Sand Tremors', r: 4, c: 3 },
      { n: 'Hemorrhage', r: 5, c: 2 }
    ]
  },
  redneck: {
    t1: 'Hillbilly', t2: 'Moonshiner',
    s1: [
      { n: 'Chainsaw Slash', r: 1, c: 1 }, { n: 'Durable Wear', r: 1, c: 3 },
      { n: 'Oil Spill', r: 2, c: 1 }, { n: 'Moonshine Molotov', r: 2, c: 2 },
      { n: 'Moonshine Madness', r: 3, c: 2 }, { n: 'Chainsaw Mastery', r: 3, c: 3 },
      { n: 'Pipe Bombs', r: 4, c: 1 }, { n: 'Hillbilly Rage', r: 4, c: 2 },
      { n: 'Pickup Raid', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Tire Fire', r: 1, c: 2 }, { n: 'Rogue Chainsaw', r: 1, c: 3 },
      { n: 'Experienced Logger', r: 2, c: 1 }, { n: 'Combustible Oil', r: 2, c: 3 },
      { n: 'Spontaneous Combustion', r: 3, c: 1 }, { n: 'Loggers Endurance', r: 3, c: 2 },
      { n: 'Tree Trunk Triumph', r: 4, c: 2 }, { n: 'Revved Up', r: 4, c: 3 },
      { n: 'Chainsaw Massacre', r: 5, c: 2 }
    ]
  },
  necromancer: {
    t1: 'Summoner', t2: 'Lich',
    s1: [
      { n: 'Raise Skeleton', r: 1, c: 1 }, { n: 'Life Tap', r: 1, c: 3 },
      { n: 'Raise Skeleton Mage', r: 2, c: 1 }, { n: 'Poison Breath', r: 2, c: 2 },
      { n: 'Corpse Explosion', r: 3, c: 2 }, { n: 'Summon Mastery', r: 3, c: 3 },
      { n: 'Meat Shield', r: 4, c: 1 }, { n: 'Cursed Ground', r: 4, c: 2 },
      { n: 'Summon Damned Legion', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Poison Nova', r: 1, c: 2 }, { n: 'Bone Spear', r: 1, c: 3 },
      { n: 'Summon Frenzy', r: 2, c: 1 }, { n: 'Summon Resistances', r: 2, c: 3 },
      { n: 'Amplify Damage', r: 3, c: 1 }, { n: 'Summon Vengeful Spirit', r: 3, c: 2 },
      { n: 'Meat Bomb', r: 4, c: 2 }, { n: 'Bone Spirit', r: 4, c: 3 },
      { n: 'Bone Shred', r: 5, c: 2 }
    ]
  },
  samurai: {
    t1: 'Bushido', t2: 'Ronin',
    s1: [
      { n: 'Quickslash', r: 1, c: 1 }, { n: 'Evasion', r: 1, c: 3 },
      { n: 'Shuriken Throw', r: 2, c: 1 }, { n: 'Warriors Spirit', r: 2, c: 2 },
      { n: 'Battle Glance', r: 3, c: 2 }, { n: 'Bushido', r: 3, c: 3 },
      { n: 'Empires Slash', r: 4, c: 1 }, { n: 'Live by the Sword', r: 4, c: 2 },
      { n: 'For Honor', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Way of the Warrior', r: 1, c: 2 }, { n: 'Shadow Step', r: 1, c: 3 },
      { n: 'Blade Barrier', r: 2, c: 1 }, { n: 'Fan of Knives', r: 2, c: 3 },
      { n: 'Burst of Speed', r: 3, c: 1 }, { n: 'Exploding Bolas', r: 3, c: 2 },
      { n: 'Omnislash', r: 4, c: 2 }, { n: 'Explosive Kunai', r: 4, c: 3 },
      { n: 'Smoke Bomb', r: 5, c: 2 }
    ]
  },
  paladin: {
    t1: 'Holy Knight', t2: 'Crusader',
    s1: [
      { n: 'Holy Hammer', r: 1, c: 1 }, { n: 'Holy Aura', r: 1, c: 3 },
      { n: 'Holy Bolt', r: 2, c: 1 }, { n: 'Thunder Shield', r: 2, c: 2 },
      { n: 'Divine Wisdom', r: 3, c: 2 }, { n: 'Fanaticism Aura', r: 3, c: 3 },
      { n: 'Holy Retribution', r: 4, c: 1 }, { n: 'Holy Nova', r: 4, c: 2 },
      { n: 'Thors Fury', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Lights Embrace', r: 1, c: 2 }, { n: 'Fist of the Heavens', r: 1, c: 3 },
      { n: 'The Venerated One', r: 2, c: 1 }, { n: 'Divine Storm', r: 2, c: 3 },
      { n: 'Vengeance', r: 3, c: 1 }, { n: 'Holy Shock Aura', r: 3, c: 2 },
      { n: 'Eye of the Storm', r: 4, c: 2 }, { n: 'Ball Lightning', r: 4, c: 3 },
      { n: 'Lightning Fury', r: 5, c: 2 }
    ]
  },
  amazon: {
    t1: 'Spear Maiden', t2: 'Huntress',
    s1: [
      { n: 'Spearnage', r: 1, c: 1 }, { n: 'Leaping Ambush', r: 1, c: 3 },
      { n: 'Thunder Fury', r: 2, c: 1 }, { n: 'Thrill of the Hunt', r: 2, c: 2 },
      { n: 'Astropes Gift', r: 3, c: 2 }, { n: 'Master Poisoner', r: 3, c: 3 },
      { n: 'Thunder Goddesses Chosen', r: 4, c: 1 }, { n: 'Astropes Battle Maiden', r: 4, c: 2 },
      { n: 'Death from Above', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Noxious Strike', r: 1, c: 2 }, { n: 'Storm Dash', r: 1, c: 3 },
      { n: 'Jungle Camouflage', r: 2, c: 1 }, { n: 'Caustic Spearhead', r: 2, c: 3 },
      { n: 'Chooser of the Slain', r: 3, c: 1 }, { n: 'Toxic Remains', r: 3, c: 2 },
      { n: 'Envenom', r: 4, c: 2 }, { n: 'Feint', r: 4, c: 3 },
      { n: 'Rebound', r: 5, c: 2 }
    ]
  },
  demonslayer: {
    t1: 'Executioner', t2: 'Inquisitor',
    s1: [
      { n: 'Bullet Hell', r: 1, c: 1 }, { n: 'Concentration Aura', r: 1, c: 3 },
      { n: 'Possessed Bullet', r: 2, c: 1 }, { n: 'Trigger Finger', r: 2, c: 2 },
      { n: 'Demons Presence', r: 3, c: 2 }, { n: 'Sword Handler', r: 3, c: 3 },
      { n: 'Shredder Trap', r: 4, c: 1 }, { n: 'Soul Leech', r: 4, c: 2 },
      { n: 'Absolute Mayhem', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Fast Slices', r: 1, c: 2 }, { n: 'Slice of Shadows', r: 1, c: 3 },
      { n: 'Demons Shield', r: 2, c: 1 }, { n: 'Execute', r: 2, c: 3 },
      { n: 'Eagle Eye', r: 3, c: 1 }, { n: 'Shadow Anomalies', r: 3, c: 2 },
      { n: 'Demons Calling', r: 4, c: 2 }, { n: 'Heart Attack', r: 4, c: 3 },
      { n: 'Demon Form', r: 5, c: 2 }
    ]
  },
  demonspawn: {
    t1: 'Blood', t2: 'Bone',
    s1: [
      { n: 'Blood Bolts', r: 1, c: 1 }, { n: 'Gut Spread', r: 1, c: 3 },
      { n: 'Blood Surge', r: 2, c: 1 }, { n: 'Blood Tendrils', r: 2, c: 2 },
      { n: 'Impale', r: 3, c: 2 }, { n: 'Spinal Tap', r: 3, c: 3 },
      { n: 'Blood Demons', r: 4, c: 1 }, { n: 'Cartilage Build Up', r: 4, c: 2 },
      { n: "Single Out", r: 5, c: 3 }
    ],
    s2: [
      { n: 'Bone Fragments', r: 1, c: 2 }, { n: 'Bone Barrage', r: 1, c: 3 },
      { n: 'Mana Devour', r: 2, c: 1 }, { n: 'Mana Shield', r: 2, c: 3 },
      { n: 'Manapool Aura', r: 3, c: 1 }, { n: 'Bone Storm', r: 3, c: 2 },
      { n: 'Ominous Aura', r: 4, c: 2 }, { n: 'Demonic Presence', r: 4, c: 3 },
      { n: 'Ossification', r: 5, c: 2 }
    ]
  },
  shaman: {
    t1: 'Elements', t2: 'Totems',
    s1: [
      { n: 'Fire Totem', r: 1, c: 1 }, { n: 'Storm Totem', r: 1, c: 3 },
      { n: 'Earth Totem', r: 2, c: 1 }, { n: 'Chaos Totem', r: 2, c: 2 },
      { n: 'Tectonic Boulder', r: 3, c: 2 }, { n: 'Spiritual Guide', r: 3, c: 3 },
      { n: 'Meteor Storm', r: 4, c: 1 }, { n: 'Twisters', r: 4, c: 2 },
      { n: 'Tornado', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Spirit Wolves', r: 1, c: 2 }, { n: 'Earth Bind', r: 1, c: 3 },
      { n: 'Scent of the Wolf', r: 2, c: 1 }, { n: 'Astral Intellect', r: 2, c: 3 },
      { n: 'Earths Grace', r: 3, c: 1 }, { n: 'Fractal Mind', r: 3, c: 2 },
      { n: 'Natures Prophet', r: 4, c: 2 }, { n: 'Rock Fragments', r: 4, c: 3 },
      { n: 'Fissures', r: 5, c: 2 }
    ]
  },
  whitemage: {
    t1: 'Holy', t2: 'Dark',
    s1: [
      { n: 'Flash Heal', r: 1, c: 1 }, { n: 'Mana Orb', r: 1, c: 3 },
      { n: 'Holy Shield', r: 2, c: 1 }, { n: 'Divine Healing', r: 2, c: 2 },
      { n: 'Burst of Light', r: 3, c: 2 }, { n: 'Heavenly Fire', r: 3, c: 3 },
      { n: 'Healing Zone', r: 4, c: 1 }, { n: 'Chain of Holy Lightning', r: 4, c: 2 },
      { n: 'Benediction', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Shadow Bolt', r: 1, c: 2 }, { n: 'Restless Spirits', r: 1, c: 3 },
      { n: 'Dark Oath', r: 2, c: 1 }, { n: 'Soul Spurn', r: 2, c: 3 },
      { n: 'Malediction', r: 3, c: 1 }, { n: 'Satans Mark', r: 3, c: 2 },
      { n: 'Digest Souls', r: 4, c: 2 }, { n: 'Black Mass', r: 4, c: 3 },
      { n: 'Martyr', r: 5, c: 2 }
    ]
  },
  marauder: {
    t1: 'Wrecker', t2: 'Trapper',
    s1: [
      { n: 'Wrecking Ball', r: 1, c: 1 }, { n: 'Heavy Ball', r: 1, c: 3 },
      { n: 'Unstable Bomb', r: 2, c: 1 }, { n: 'The Big Bo-Om', r: 2, c: 2 },
      { n: 'Bouncing Grenade', r: 3, c: 2 }, { n: 'Bombardment', r: 3, c: 3 },
      { n: 'Madness Control', r: 4, c: 1 }, { n: 'Force Overwhelming', r: 4, c: 2 },
      { n: 'Annihilation', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Chain Trap', r: 1, c: 2 }, { n: 'Serrated Chains', r: 1, c: 3 },
      { n: 'Titanium Chains', r: 2, c: 1 }, { n: 'Crazy Grapple', r: 2, c: 3 },
      { n: 'Retiarius Net', r: 3, c: 1 }, { n: 'Master Trap Maker', r: 3, c: 2 },
      { n: 'Rend Flesh', r: 4, c: 2 }, { n: 'Resilient Gladiator', r: 4, c: 3 },
      { n: 'Flail Mastery', r: 5, c: 2 }
    ]
  },
  plaguedoctor: {
    t1: 'Plague', t2: 'Doctor',
    s1: [
      { n: 'Plague of Rats', r: 1, c: 1 }, { n: 'Randy the Rancid Rat', r: 1, c: 3 },
      { n: 'Exploding Mice', r: 2, c: 1 }, { n: 'Miasma', r: 2, c: 2 },
      { n: 'Toxic Flask', r: 3, c: 2 }, { n: 'Plague Master', r: 3, c: 3 },
      { n: 'Crematus', r: 4, c: 1 }, { n: 'Crow Masks Presence', r: 4, c: 2 },
      { n: 'Oops', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Booster Shot', r: 1, c: 2 }, { n: 'Jar of Leeches', r: 1, c: 3 },
      { n: 'Blood Sustenance', r: 2, c: 1 }, { n: 'Surgical Blood Letting', r: 2, c: 3 },
      { n: 'Chant of Weakness', r: 3, c: 1 }, { n: 'Lifeblood Aura', r: 3, c: 2 },
      { n: 'Malpractice', r: 4, c: 2 }, { n: 'Defunct Surgeon', r: 4, c: 3 },
      { n: 'Devout Doctor', r: 5, c: 2 }
    ]
  },
  illusionist: {
    t1: 'Phantasm', t2: 'Mirror',
    s1: [
      { n: 'Sands of Time', r: 1, c: 1 }, { n: 'Sand Guardians', r: 1, c: 3 },
      { n: 'Link of Sand', r: 2, c: 1 }, { n: 'Piercing Sand', r: 2, c: 2 },
      { n: 'Dissipation', r: 3, c: 2 }, { n: 'Expansive Mind', r: 3, c: 3 },
      { n: 'Gravitation Slam', r: 4, c: 1 }, { n: 'Circle of Guardians', r: 4, c: 2 },
      { n: 'Split Reality', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Time Deceleration', r: 1, c: 2 }, { n: 'Temporal Heroes', r: 1, c: 3 },
      { n: 'Age Proliferation', r: 2, c: 1 }, { n: 'Call For War', r: 2, c: 3 },
      { n: 'Combat Order', r: 3, c: 1 }, { n: 'Precognition', r: 3, c: 2 },
      { n: 'Dimensional Displacement', r: 4, c: 2 }, { n: 'Spirit Link', r: 4, c: 3 },
      { n: 'Cheapshot', r: 5, c: 2 }
    ]
  },
  exo: {
    t1: 'Solar', t2: 'Lunar',
    s1: [
      { n: 'Solar Form', r: 1, c: 1 }, { n: 'Solar Flare', r: 1, c: 3 },
      { n: 'Solar Burst', r: 2, c: 1 }, { n: 'Solar Dash', r: 2, c: 2 },
      { n: 'Scorching Whip', r: 3, c: 2 }, { n: 'Shine Bright', r: 3, c: 3 },
      { n: 'Whiplash', r: 4, c: 1 }, { n: 'Supernova', r: 4, c: 2 },
      { n: 'Collision', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Lunar Form', r: 1, c: 2 }, { n: 'Lunar Orbit', r: 1, c: 3 },
      { n: 'Moonlight', r: 2, c: 1 }, { n: 'Dark Side of the Moon', r: 2, c: 3 },
      { n: 'Blood Moon', r: 3, c: 1 }, { n: 'Black Hole', r: 3, c: 2 },
      { n: 'Asteroid', r: 4, c: 2 }, { n: 'Tsunami', r: 4, c: 3 },
      { n: 'Blinding Light', r: 5, c: 2 }
    ]
  },
  butcher: {
    t1: 'Meat', t2: 'Blood',
    s1: [
      { n: "Butchers Hook", r: 1, c: 1 }, { n: 'Chain Swing', r: 1, c: 3 },
      { n: 'Slicing Throw', r: 2, c: 1 }, { n: 'Brutalizing Slash', r: 2, c: 2 },
      { n: 'Chain Rip', r: 3, c: 2 }, { n: 'Hunger For Blood', r: 3, c: 3 },
      { n: 'Insatiable Hunger', r: 4, c: 1 }, { n: 'Furious Strike', r: 4, c: 2 },
      { n: 'Ending Fate', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Awakening Fury', r: 1, c: 2 }, { n: 'Blender', r: 1, c: 3 },
      { n: 'Enraged Mania', r: 2, c: 1 }, { n: 'Fuel To Fire', r: 2, c: 3 },
      { n: 'Holy Form', r: 3, c: 1 }, { n: 'Sacrilegious Scorn', r: 3, c: 2 },
      { n: 'Spiritual Duality', r: 4, c: 2 }, { n: 'Submerged Knives', r: 4, c: 3 },
      { n: 'Unholy Form', r: 5, c: 2 }
    ]
  },
  stormweaver: {
    t1: 'Thunder', t2: 'Storm',
    s1: [
      { n: 'Storm Bolt', r: 1, c: 1 }, { n: 'Charged Bolts', r: 1, c: 3 },
      { n: 'Static Shock', r: 2, c: 1 }, { n: 'Lightning Surge', r: 2, c: 2 },
      { n: 'High Voltage Aura', r: 3, c: 2 }, { n: 'Electric Cells', r: 3, c: 3 },
      { n: 'Chain Lightning', r: 4, c: 1 }, { n: 'Apocalyptic Thunder', r: 4, c: 2 },
      { n: 'Symphony of Thunder', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Storm Cloud', r: 1, c: 2 }, { n: 'Pulsing Charge', r: 1, c: 3 },
      { n: 'Loaded Pulse', r: 2, c: 1 }, { n: 'Wave Length', r: 2, c: 3 },
      { n: 'Manafiend', r: 3, c: 1 }, { n: 'Gateway', r: 3, c: 2 },
      { n: 'The Battery Within', r: 4, c: 2 }, { n: 'Hyper Charged', r: 4, c: 3 },
      { n: 'Aftershock', r: 5, c: 2 }
    ]
  },
  bard: {
    t1: 'Music', t2: 'Metal',
    s1: [
      { n: 'Sounds of Silence', r: 1, c: 1 }, { n: 'High Db', r: 1, c: 3 },
      { n: 'Insane Riff', r: 2, c: 1 }, { n: "Satan's Melody", r: 2, c: 2 },
      { n: 'Craving for Attention', r: 3, c: 2 }, { n: 'Craving for Another Killing', r: 3, c: 3 },
      { n: 'Crowd Pummeler', r: 4, c: 1 }, { n: 'Headbanger', r: 4, c: 2 },
      { n: 'Moshpit Massacre', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Slaying Riffs', r: 1, c: 2 }, { n: 'Sacrilegious Symphony', r: 1, c: 3 },
      { n: 'Pyro Technician', r: 2, c: 1 }, { n: 'Progenies of the Great Cataclysm', r: 2, c: 3 },
      { n: 'Crowd Dive', r: 3, c: 1 }, { n: 'Bard Skill 15', r: 3, c: 2 },
      { n: 'Bard Skill 16', r: 4, c: 2 }, { n: 'Bard Skill 17', r: 4, c: 3 },
      { n: 'Bard Skill 18', r: 5, c: 2 }
    ]
  },
  shieldlancer: {
    t1: 'Lancer', t2: 'Shield',
    s1: [
      { n: 'Lance Thrust', r: 1, c: 1 }, { n: 'Crushing Lance', r: 1, c: 3 },
      { n: 'Lance Throw', r: 2, c: 1 }, { n: 'Glorious Strike', r: 2, c: 2 },
      { n: 'Battle Charge', r: 3, c: 2 }, { n: 'Armor Crush', r: 3, c: 3 },
      { n: 'Counter', r: 4, c: 1 }, { n: 'Glory', r: 4, c: 2 },
      { n: 'Commending Banner', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Shield Slam', r: 1, c: 2 }, { n: 'Shield Wall', r: 1, c: 3 },
      { n: 'Spiked Shields', r: 2, c: 1 }, { n: 'Parry', r: 2, c: 3 },
      { n: 'Taunt', r: 3, c: 1 }, { n: 'Last Stand', r: 3, c: 2 },
      { n: 'Honed Defenses', r: 4, c: 2 }, { n: 'Knights Resilience', r: 4, c: 3 },
      { n: 'Damage Reflect', r: 5, c: 2 }
    ]
  },
  jotunn: {
    t1: 'Frost', t2: 'Glacial',
    s1: [
      { n: 'Icicles', r: 1, c: 1 }, { n: 'Frozen Boulder', r: 1, c: 3 },
      { n: 'Flash Freeze', r: 2, c: 1 }, { n: 'Freezing Leap', r: 2, c: 2 },
      { n: 'Breath of Ice', r: 3, c: 2 }, { n: 'Permafrost', r: 3, c: 3 },
      { n: 'Orb of Frost', r: 4, c: 1 }, { n: 'Absolute Zero', r: 4, c: 2 },
      { n: 'The Embodiment of Aurgelmir', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Glacial Armor', r: 1, c: 2 }, { n: 'Frozen Hide', r: 1, c: 3 },
      { n: 'Glacial Tremors', r: 2, c: 1 }, { n: 'Avalanche', r: 2, c: 3 },
      { n: 'Sweep Freeze', r: 3, c: 1 }, { n: 'Blizzard', r: 3, c: 2 },
      { n: 'Portal of Ice', r: 4, c: 2 }, { n: 'Avatar of Frost', r: 4, c: 3 },
      { n: 'Power of the Ancients', r: 5, c: 2 }
    ]
  },
  prophet: {
    t1: 'Forest Mystic', t2: 'SkinWalker',
    s1: [
      { n: 'Prophet Skill 1', r: 1, c: 1 }, { n: 'Prophet Skill 2', r: 1, c: 3 },
      { n: 'Prophet Skill 3', r: 2, c: 1 }, { n: 'Prophet Skill 4', r: 2, c: 2 },
      { n: 'Prophet Skill 5', r: 3, c: 2 }, { n: 'Prophet Skill 6', r: 3, c: 3 },
      { n: 'Prophet Skill 7', r: 4, c: 1 }, { n: 'Prophet Skill 8', r: 4, c: 2 },
      { n: 'Prophet Skill 9', r: 5, c: 3 }
    ],
    s2: [
      { n: 'Prophet Skill 10', r: 1, c: 2 }, { n: 'Prophet Skill 11', r: 1, c: 3 },
      { n: 'Prophet Skill 12', r: 2, c: 1 }, { n: 'Prophet Skill 13', r: 2, c: 3 },
      { n: 'Prophet Skill 14', r: 3, c: 1 }, { n: 'Prophet Skill 15', r: 3, c: 2 },
      { n: 'Prophet Skill 16', r: 4, c: 2 }, { n: 'Prophet Skill 17', r: 4, c: 3 },
      { n: 'Prophet Skill 18', r: 5, c: 2 }
    ]
  }
};

function SkillCard({ skill, isDragging, isOverlay }: { skill: SkillSlot; isDragging?: boolean; isOverlay?: boolean }) {
  return (
    <div
      className={`relative aspect-square rounded-xl border-2 flex items-center justify-center bg-white transition-all group ${
        isOverlay 
          ? 'border-brand-orange shadow-2xl scale-110 z-[100] cursor-grabbing' 
          : isDragging 
            ? 'border-brand-orange/10 opacity-20 cursor-grabbing' 
            : 'border-brand-orange/20 shadow-sm hover:border-brand-orange/50 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3 text-brand-dark/20" />
      </div>
      {skill.icon ? (
        <img src={skill.icon} className="w-10 h-10 object-contain pixelated pointer-events-none" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
      ) : (
        <span className="text-[9px] font-bold text-brand-dark/20 uppercase pointer-events-none">Empty</span>
      )}
      {skill.name && (
        <div className="absolute -bottom-1 -right-1 pointer-events-none">
          {skill.hasSubTree ? (
            <div className="bg-brand-orange text-white rounded-full p-0.5 shadow-sm" title="Possui Árvore Extra">
              <Plus className="w-3 h-3" />
            </div>
          ) : (
            <Circle className="w-4 h-4 text-brand-dark/20 fill-white" />
          )}
        </div>
      )}
    </div>
  );
}

function SortableSkill({ skill }: { skill: SkillSlot }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: skill.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SkillCard skill={skill} isDragging={isDragging} />
    </div>
  );
}

export function AdminHeroSkillsPanel() {
  const [selectedClass, setSelectedClass] = useState<ClassKey>('viking');
  const [data, setData] = useState<ClassSkills | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const docRef = doc(firestore, 'class_skills', selectedClass);
        const snap = await getDoc(docRef);
        if (!alive) return;
        
        if (snap.exists()) {
          const rawData = snap.data() as ClassSkills;
          const ensure15 = (list: SkillSlot[], prefix: string) => {
            const arr = Array.from({ length: 15 }, (_, i) => ({
              id: `empty-${prefix}-${i}`,
              name: '',
              description: '',
              icon: '',
              hasSubTree: false,
              position: i
            }));
            (list || []).forEach(s => {
              if (s.position >= 0 && s.position < 15) {
                // Handle legacy migration where 'active' was used
                const raw = s as any;
                const hasSub = typeof raw.hasSubTree === 'boolean' ? raw.hasSubTree : !!raw.active;
                arr[s.position] = { ...s, hasSubTree: hasSub };
              }
            });
            return arr;
          };
          setData({
            ...rawData,
            tree1: ensure15(rawData.tree1, 't1'),
            tree2: ensure15(rawData.tree2, 't2')
          });
        } else {
          setData({
            t1: 'Tree 1',
            t2: 'Tree 2',
            tree1: createEmptyTree('t1'),
            tree2: createEmptyTree('t2')
          });
        }
      } catch (err) {
        console.error(err);
        if (alive) setFlash({ type: 'error', text: 'Falha ao carregar dados.' });
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [selectedClass]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;

    // Find source
    let sourceKey: 'tree1' | 'tree2' | null = null;
    let oldIndex = data.tree1.findIndex((s) => s.id === active.id);
    if (oldIndex !== -1) {
      sourceKey = 'tree1';
    } else {
      oldIndex = data.tree2.findIndex((s) => s.id === active.id);
      if (oldIndex !== -1) sourceKey = 'tree2';
    }

    // Find target
    let targetKey: 'tree1' | 'tree2' | null = null;
    let newIndex = data.tree1.findIndex((s) => s.id === over.id);
    if (newIndex !== -1) {
      targetKey = 'tree1';
    } else {
      newIndex = data.tree2.findIndex((s) => s.id === over.id);
      if (newIndex !== -1) targetKey = 'tree2';
    }

    if (!sourceKey || !targetKey || oldIndex === -1 || newIndex === -1) return;

    if (sourceKey === targetKey) {
      // Single tree swap: swap items at oldIndex and newIndex
      const nextTree = [...data[sourceKey]];
      const activeItem = { ...nextTree[oldIndex], position: newIndex };
      const overItem = { ...nextTree[newIndex], position: oldIndex };
      
      nextTree[oldIndex] = overItem;
      nextTree[newIndex] = activeItem;
      
      setData({ ...data, [sourceKey]: nextTree });
    } else {
      // Cross-tree swap: maintain 15 slots in each
      const activeItem = { ...data[sourceKey][oldIndex], position: newIndex };
      const overItem = { ...data[targetKey][newIndex], position: oldIndex };

      const nextSource = [...data[sourceKey]];
      nextSource[oldIndex] = overItem;

      const nextTarget = [...data[targetKey]];
      nextTarget[newIndex] = activeItem;

      setData({
        ...data,
        [sourceKey]: nextSource,
        [targetKey]: nextTarget
      });
    }
  };

  const updateSkill = (treeKey: 'tree1' | 'tree2', index: number, field: keyof SkillSlot, value: any) => {
    if (!data) return;
    const nextTree = [...data[treeKey]];
    nextTree[index] = { ...nextTree[index], [field]: value };
    setData({ ...data, [treeKey]: nextTree });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'class_skills', selectedClass), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setFlash({ type: 'ok', text: 'Habilidades salvas com sucesso!' });
    } catch (err) {
      console.error(err);
      setFlash({ type: 'error', text: 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const importLegacyData = async () => {
    if (!window.confirm(`Isso irá puxar os dados da classe ${classNames[selectedClass]} de herosiegebrasil. Continuar?`)) return;
    
    setLoading(true);
    try {
      const legacy = LEGACY_BUILDER_DB[selectedClass];
      if (!legacy) return alert('Dados legados não encontrados para esta classe.');

      // Fetch descriptions from legacy Firestore
      const legacyId = classDocIdFromKey(selectedClass);
      const legacySnap = await getDoc(doc(getLegacyDb(), 'classes', legacyId));
      const descriptionsMap: Record<string, string> = {};

      if (legacySnap.exists()) {
        const d = legacySnap.data();
        console.log('Legacy Class Data:', d);

        // The descriptions might be in different fields depending on the class
        const sections = [
          ...(d.especializacoes || []), 
          ...(d.extra_info || []),
          ...(d.skills || []),
          ...(d.habilidades || [])
        ];
        
        sections.forEach((s: any) => {
          let html = s.html || s.description || s.desc || '';
          if (!html && typeof s === 'string') html = s;
          if (!html) return;

          // Strategy 1: Regex-based extraction (more robust than DOM for messy HTML)
          // Look for any text followed by a colon or newline-ish thing
          const allSkillsInTree = [...(legacy.s1 || []), ...(legacy.s2 || [])];
          allSkillsInTree.forEach((ls: any) => {
            const sName = ls.n;
            const escapedName = sName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Pattern 1: Name followed by colon and then text until next tag or double newline
            const regex1 = new RegExp(`${escapedName}\\s*[:\\-]\\s*([^<\\n]+(?:\\n(?!\\n)[^<\\n]*)*)`, 'i');
            const match1 = html.match(regex1);
            if (match1 && match1[1]) {
              const cleanName = sName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
              if (!descriptionsMap[cleanName]) descriptionsMap[cleanName] = match1[1].trim();
            }
          });

          // Strategy 2: DOM-based extraction (enhanced for tables and siblings)
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Check for tables first - very common for skill lists
          const rows = doc.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const nameText = cells[0].textContent?.trim() || '';
              const descText = cells[1].textContent?.trim() || '';
              
              if (nameText && descText) {
                allSkillsInTree.forEach(ls => {
                  if (nameText.toLowerCase().includes(ls.n.toLowerCase()) || ls.n.toLowerCase().includes(nameText.toLowerCase())) {
                    const cleanName = ls.n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                    if (!descriptionsMap[cleanName] || descriptionsMap[cleanName].length < descText.length) {
                      descriptionsMap[cleanName] = descText.replace(/\s+/g, ' ').trim();
                    }
                  }
                });
              }
            }
          });
          
          // Strategy 3: TreeWalker for all text nodes (fallback)
          const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent?.trim() || '';
            if (text.length < 3) continue;

            allSkillsInTree.forEach((ls: any) => {
              const sName = ls.n;
              const cleanSName = sName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
              
              // If the text node contains the skill name
              if (text.toLowerCase().includes(sName.toLowerCase())) {
                let desc = '';
                
                // If the text node is exactly "Name" or starts with "Name: ", extract the rest
                if (text.toLowerCase().startsWith(sName.toLowerCase())) {
                  desc = text.substring(sName.length).replace(/^[:\-\s]+/, '').trim();
                }

                // If description is empty or very short, look at the next few siblings or parent's siblings
                if (desc.length < 10) {
                  let current: Node | null | undefined = node;
                  let count = 0;
                  while (current && desc.length < 300 && count < 5) {
                    // Try next sibling
                    let next = current.nextSibling;
                    if (!next) {
                      // If no next sibling, go up and try parent's next sibling
                      next = current.parentElement?.nextSibling || null;
                    }
                    
                    if (next) {
                      const content = next.textContent?.trim();
                      if (content && !allSkillsInTree.some(other => other.n !== sName && content.toLowerCase().includes(other.n.toLowerCase()))) {
                        desc += (desc ? ' ' : '') + content;
                      } else if (content) {
                        // If we hit another skill name, stop
                        break;
                      }
                    }
                    current = next;
                    count++;
                  }
                }

                if (desc.length > 5 && (!descriptionsMap[cleanSName] || descriptionsMap[cleanSName].length < desc.length)) {
                  descriptionsMap[cleanSName] = desc.replace(/\s+/g, ' ').trim();
                }
              }
            });
          }
        });
        console.log('Final Descriptions Map:', descriptionsMap);
      }

      const getIconPath = (cls: string, name: string) => {
        const raw = name.trim();
        if (!raw) return '';
        
        // Mapping for folder names (some classes use underscores in folders but not in keys)
        const folderMapping: Record<string, string> = {
          demonslayer: 'demon_slayer',
          plaguedoctor: 'plague_doctor',
          shieldlancer: 'shield_lancer',
          whitemage: 'white_mage',
          jotunn: 'jotunn'
        };
        const folder = folderMapping[cls] || cls;

        // Use classNames for the prefix (e.g., "Demon Slayer" -> "Demon_Slayer")
        const displayName = classNames[cls as ClassKey] || cls;
        const filePrefix = displayName.replace(/\s+/g, '_');

        const baseForLocal = raw.replace(/['’!]/g, '').replace(/\s+/g, '_');
        return `/images/${folder}/${filePrefix}_${baseForLocal}.png`;
      };

      const mapLegacyTree = (legacySkills: any[], prefix: string) => {
        const tree = createEmptyTree(prefix);
        legacySkills.forEach((lSkill) => {
          const row = lSkill.r;
          const col = lSkill.c;
          const index = (row - 1) * 3 + (col - 1);
          if (index >= 0 && index < 15) {
            const skillName = lSkill.n;
            // More aggressive normalization for matching
            const cleanName = skillName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            
            tree[index] = {
              id: `skill-${prefix}-${index}-${Date.now()}`,
              name: skillName,
              description: descriptionsMap[cleanName] || '',
              icon: getIconPath(selectedClass, skillName),
              hasSubTree: false,
              position: index
            };
          }
        });
        return tree;
      };

      setData({
        t1: legacy.t1 || 'Tree 1',
        t2: legacy.t2 || 'Tree 2',
        tree1: mapLegacyTree(legacy.s1, 't1'),
        tree2: mapLegacyTree(legacy.s2, 't2')
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao importar dados legados.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando...</div>;
  if (!data) return <div className="p-8 text-center text-red-500 font-bold uppercase tracking-widest">Erro ao carregar dados da classe.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-brand-darker">
            Hero Skills: <span className="text-brand-orange">{classNames[selectedClass]}</span>
          </h2>
          <p className="text-sm text-brand-darker/60 uppercase font-bold tracking-widest">Gerenciar grids de habilidades das classes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={importLegacyData}
            className="inline-flex items-center gap-2 bg-brand-orange/10 text-brand-orange border border-brand-orange/20 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-orange hover:text-white transition-colors"
            title="Importar de Hero Siege Brasil"
          >
            <Download className="w-4 h-4" />
            Puxar Dados
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-brand-dark text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-darker transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Grid'}
          </button>
        </div>
      </div>

      {flash && (
        <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${flash.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {flash.text}
          <button onClick={() => setFlash(null)} className="ml-auto uppercase text-[10px]">Fechar</button>
        </div>
      )}

      <div className="bg-white border border-brand-dark/10 rounded-3xl p-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {classKeys.map((k) => (
            <button
              key={k}
              onClick={() => setSelectedClass(k)}
              className={`w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center overflow-hidden shrink-0 ${
                selectedClass === k ? 'border-brand-orange bg-brand-orange/5' : 'border-transparent hover:border-brand-dark/10 bg-brand-bg'
              }`}
              title={classNames[k]}
            >
              <img src={`/images/classes/${k}.webp`} alt={classNames[k]} className="w-full h-full object-contain pixelated p-1" />
            </button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {(['tree1', 'tree2'] as const).map((treeKey) => (
            <div key={treeKey} className="space-y-4">
              <div className="bg-white border border-brand-dark/10 rounded-3xl p-6">
                <input
                  value={data?.[treeKey === 'tree1' ? 't1' : 't2'] || ''}
                  onChange={(e) => setData(d => d ? { ...d, [treeKey === 'tree1' ? 't1' : 't2']: e.target.value } : null)}
                  placeholder="Título da Árvore"
                  className="w-full bg-transparent border-none text-xl font-black uppercase italic tracking-tighter text-brand-darker focus:ring-0 p-0 mb-6 placeholder:opacity-20"
                />
                
                <SortableContext
                  id={treeKey}
                  items={(data?.[treeKey] || []).map(s => s.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-3 gap-3">
                    {(data?.[treeKey] || []).map((skill) => (
                      <SortableSkill key={skill.id} skill={skill} />
                    ))}
                  </div>
                </SortableContext>
              </div>

            <div className="bg-white border border-brand-dark/10 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-brand-dark/10 bg-brand-bg/50">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-darker/60">
                  Editar Conteúdo - {data?.[treeKey === 'tree1' ? 't1' : 't2'] || treeKey.toUpperCase()}
                </h4>
              </div>
              <div className="divide-y divide-brand-dark/5 max-h-[400px] overflow-y-auto">
                {(data?.[treeKey] || []).map((skill, idx) => (
                  <div key={skill.id} className="p-4 space-y-3 hover:bg-brand-bg/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-bg border border-brand-dark/10 flex items-center justify-center text-[10px] font-black text-brand-dark/20">
                        {idx + 1}
                      </div>
                      <input
                        value={skill.name}
                        onChange={(e) => updateSkill(treeKey, idx, 'name', e.target.value)}
                        placeholder="Nome da Skill"
                        className="flex-1 bg-transparent border-none font-bold text-sm text-brand-darker focus:ring-0 p-0 placeholder:opacity-30"
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skill.hasSubTree}
                          onChange={(e) => updateSkill(treeKey, idx, 'hasSubTree', e.target.checked)}
                          className="w-4 h-4 rounded border-brand-dark/20 text-brand-orange focus:ring-brand-orange"
                        />
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-darker/40">Árvore Extra</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
                      <div className="relative group">
                        <div className="w-12 h-12 rounded-xl bg-brand-bg border border-brand-dark/10 flex items-center justify-center overflow-hidden">
                          {skill.icon ? (
                            <img src={skill.icon} className="w-8 h-8 object-contain pixelated" onError={e => e.currentTarget.src = '/images/herosiege.png'} />
                          ) : (
                            <Plus className="w-4 h-4 text-brand-dark/20" />
                          )}
                        </div>
                        <input
                          value={skill.icon}
                          onChange={(e) => updateSkill(treeKey, idx, 'icon', e.target.value)}
                          placeholder="/images/..."
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          title="Caminho do ícone"
                        />
                      </div>
                      <textarea
                        value={skill.description}
                        onChange={(e) => updateSkill(treeKey, idx, 'description', e.target.value)}
                        placeholder="Descrição da habilidade..."
                        className="w-full bg-brand-bg/50 border border-brand-dark/10 rounded-xl p-2 text-xs text-brand-darker/70 focus:outline-none focus:border-brand-orange min-h-[60px] resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          ))}
        </div>

        <DragOverlay adjustScale={true}>
          {activeId ? (
            <SkillCard 
              skill={[...(data?.tree1 || []), ...(data?.tree2 || [])].find(s => s.id === activeId)!} 
              isOverlay 
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
