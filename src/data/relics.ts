'use client';

export type PassiveRelicRow = { name: string; stats: string[]; l1: string[]; l5: string[]; l10: string[] };
export type ExtraRelic = { name: string };

export const passiveRelics: PassiveRelicRow[] = [
  { name: 'Barbed Shield', stats: ['Dmg Returned'], l1: ['10%'], l5: ['60%'], l10: ['200%'] },
  { name: 'Bonsai Tree', stats: ['Vitality', 'Magic Find'], l1: ['+2', '2%'], l5: ['+10', '10%'], l10: ['+20', '20%'] },
  { name: 'Bracer of Life', stats: ['Replenish Life'], l1: ['5%'], l5: ['25%'], l10: ['50%'] },
  { name: 'Butterfly Knife', stats: ['Atk Speed', 'Crit Dmg'], l1: ['+2%', '+2%'], l5: ['+10%', '+10%'], l10: ['+20%', '+20%'] },
  { name: 'Cake', stats: ['Life Increased'], l1: ['2%'], l5: ['10%'], l10: ['20%'] },
  { name: 'Charmed Blood', stats: ['Life Stolen'], l1: ['1%'], l5: ['5%'], l10: ['10%'] },
  { name: 'Cheese Burger', stats: ['Replenish Life', 'Life'], l1: ['5%', '+25'], l5: ['25%', '+245'], l10: ['50%', '+580'] },
  { name: "Commander's Sword", stats: ['Move Speed', 'Atk Damage'], l1: ['-2%', '10%'], l5: ['-10%', '50%'], l10: ['-20%', '100%'] },
  { name: 'Cookies & Milk', stats: ['Replenish Life', 'Replenish Mana'], l1: ['3%', '3%'], l5: ['15%', '15%'], l10: ['30%', '30%'] },
  { name: 'Damned Buckler', stats: ['Armor', 'FHR'], l1: ['+5', '2%'], l5: ['+16', '10%'], l10: ['+32', '20%'] },
  { name: 'Dirge', stats: ['Atk Rating', 'Add Phys Dmg'], l1: ['+12', '+8'], l5: ['+110', '+128'], l10: ['+475', '+1896'] },
  { name: 'Doom Flute', stats: ['Strength', 'Dexterity'], l1: ['+4', '+4'], l5: ['+12', '+12'], l10: ['+22', '+22'] },
  { name: 'Fortune Card', stats: ['Extra Gold', 'Magic Find'], l1: ['3%', '3%'], l5: ['15%', '15%'], l10: ['30%', '30%'] },
  { name: 'Half Eaten Mochi', stats: ['Life After Kill', 'Mana After Kill'], l1: ['+3', '+3'], l5: ['+11', '+11'], l10: ['+21', '+21'] },
  { name: 'Hand of Midas', stats: ['Extra Gold'], l1: ['+4%'], l5: ['+20%'], l10: ['+40%'] },
  { name: 'Hand Scythe', stats: ['Atk Speed', 'Atk Rating'], l1: ['+3%', '+2%'], l5: ['+15%', '+10%'], l10: ['+30%', '+20%'] },
  { name: 'Hellscream Axe', stats: ['Add Phys Dmg', 'Add Fire Dmg'], l1: ['+8', '+8'], l5: ['+128', '+128'], l10: ['+1696', '+1696'] },
  { name: 'Horned Mask', stats: ['Dmg Returned', 'Phys Dmg Reduct'], l1: ['2%', '1%'], l5: ['10%', '5%'], l10: ['20%', '10%'] },
  { name: "Jefre's Subscription", stats: ['Light Radius', 'Magic Find'], l1: ['+1', '3%'], l5: ['+5', '15%'], l10: ['+10', '30%'] },
  { name: "King's Crown", stats: ['Extra Gold'], l1: ['3%'], l5: ['18%'], l10: ['35%'] },
  { name: 'Light Katana', stats: ['Atk Speed'], l1: ['+4%'], l5: ['+20%'], l10: ['+40%'] },
  { name: 'Lost Wand', stats: ['Cast Rate', 'Energy'], l1: ['+4%', '+5'], l5: ['+20%', '+25'], l10: ['+40%', '+50'] },
  { name: 'Magic Mushroom', stats: ['All Attributes'], l1: ['+3'], l5: ['+15'], l10: ['+30'] },
  { name: "Mayo's Old Sock", stats: ['Vitality', 'Life'], l1: ['+2', '+10'], l5: ['+10', '+110'], l10: ['+20', '+600'] },
  { name: 'Monkey King Bar', stats: ['Move Speed', 'Atk Damage'], l1: ['3%', '2%'], l5: ['+15%', '10%'], l10: ['+30%', '20%'] },
  { name: 'Newt Tail', stats: ['Move Speed', 'Magic Find'], l1: ['3%', '2%'], l5: ['15%', '10%'], l10: ['30%', '20%'] },
  { name: 'Nunchucks', stats: ['Atk Speed', 'Crit Dmg'], l1: ['3%', '3%'], l5: ['15%', '15%'], l10: ['30%', '30%'] },
  { name: 'Odd Book of Spells', stats: ['Magic Skill Dmg'], l1: ['1%'], l5: ['5%'], l10: ['10%'] },
  { name: 'Razer Blade', stats: ['Crit Dmg'], l1: ['+5%'], l5: ['+25%'], l10: ['+50%'] },
  { name: 'Rock Belt', stats: ['Move Speed', 'Strength'], l1: ['3%', '+3'], l5: ['15%', '+15'], l10: ['30%', '+30'] },
  { name: 'Sausage', stats: ['Life Inc.', 'Mana Inc.'], l1: ['1%', '1%'], l5: ['5%', '5%'], l10: ['10%', '10%'] },
  { name: 'Skull Axe', stats: ['Atk Rating', 'Strength'], l1: ['+10', '+4'], l5: ['+80', '+20'], l10: ['+250', '+40'] },
  { name: 'Spirit Skull', stats: ['Strength', 'Vitality'], l1: ['+3', '+3'], l5: ['+15', '+15'], l10: ['+30', '+30'] },
  { name: 'Steam Sale', stats: ['Merchant Prices Reduced'], l1: ['1%'], l5: ['5%'], l10: ['10%'] },
  { name: 'Stigmata', stats: ['Mana Costs', 'Replenish Mana'], l1: ['3%', '1%'], l5: ['15%', '5%'], l10: ['30%', '10%'] },
  { name: 'The Amputation Kit', stats: ['Move Speed'], l1: ['+5%'], l5: ['+25%'], l10: ['+50%'] },
  { name: 'The Holy Bible', stats: ['All Attributes', 'All Skills'], l1: ['+1', '+1'], l5: ['+5', '+2'], l10: ['+10', '---'] },
  { name: 'The Spoon', stats: ['Replenish Mana', 'Mana'], l1: ['3%', '+5'], l5: ['15%', '+25'], l10: ['30%', '+50'] },
  { name: 'Token of Luck', stats: ['Magic Find'], l1: ['2%'], l5: ['18%'], l10: ['50%'] },
  { name: 'Triforce', stats: ['All Stats', 'All Resistances'], l1: ['+3', '+3%'], l5: ['+15', '+15%'], l10: ['+30', '+30%'] },
  { name: 'Twin Blade', stats: ['Crit Chance', 'Crit Dmg'], l1: ['1%', '3%'], l5: ['5%', '15%'], l10: ['10%', '30%'] },
  { name: 'Whip', stats: ['Atk Speed', 'Add Phys Dmg'], l1: ['3%', '+5'], l5: ['15%', '+25'], l10: ['30%', '+50'] },
];

export const orbitalRelics: ExtraRelic[] = [
  { name: 'Demon Sheep' },
  { name: 'F.E.T.U.S' },
  { name: 'Guardian Angel' },
  { name: 'Shredder' },
  { name: "Steve's Dirty Head" },
  { name: 'Templar Shield' },
];

export const followerRelics: ExtraRelic[] = [
  { name: 'Ancient Rock' },
  { name: 'Honey Bee' },
  { name: 'Karp Head' },
  { name: 'Minisect' },
  { name: 'Shrunken Head' },
  { name: 'Skullbat' },
  { name: 'The Allmighty Fedora' },
  { name: 'The Eye' },
  { name: 'War Zeppelin' },
];

export const onDeathRelics: ExtraRelic[] = [{ name: 'Lottery Ticket' }];

export const onAttackOrHitRelics: ExtraRelic[] = [
  { name: "Assassin's Shuriken" },
  { name: 'Devil Skull' },
  { name: 'Razor Leaf' },
  { name: 'Witch Claw' },
  { name: 'Hungering Blade of Frost' },
  { name: "Odin's Sword" },
  { name: "Amazon's Spears" },
  { name: "Basilisk's Tooth" },
  { name: "Butcher's Knife" },
  { name: "Death's Scythe Relic" },
  { name: 'Fire & Ice' },
  { name: 'Frozen Orb' },
  { name: 'Ogre Club' },
  { name: 'Razorwire' },
  { name: 'Rice & Chopsticks' },
  { name: 'Storm Dagger' },
];

export const onCastRelics: ExtraRelic[] = [
  { name: 'Cactus' },
  { name: "DaPlayer's Dislocated Head" },
  { name: 'Mana Dice' },
  { name: 'The Holy Grail' },
  { name: "Winner's Drug" },
];

export const otherRelics: ExtraRelic[] = [
  { name: 'Breath of Ice' },
  { name: 'Burst of Rage' },
  { name: 'Chilling Strike' },
  { name: 'Disarming Strike' },
  { name: 'Divine Scorch' },
  { name: 'Frostburn' },
  { name: 'Heavens Light' },
  { name: 'Hexing Strike' },
  { name: 'Lightning Strike' },
  { name: 'Lucky Numbers' },
  { name: 'Mana Recovery' },
  { name: 'Manastream' },
  { name: 'Meat Bomb' },
  { name: 'Poisonous Hit' },
  { name: 'Razor Leaves' },
  { name: 'Reaping' },
  { name: 'Rotting Carcas' },
  { name: 'Rupture' },
  { name: 'Shruken Strike' },
  { name: 'Spiky Plant' },
  { name: 'Stoned' },
];

const allExtra = [...orbitalRelics, ...followerRelics, ...onDeathRelics, ...onAttackOrHitRelics, ...onCastRelics, ...otherRelics];
export const allRelicNames: string[] = Array.from(new Set([...passiveRelics.map((r) => r.name), ...allExtra.map((r) => r.name)].filter(Boolean))).sort((a, b) => a.localeCompare(b));

