/** Enemy timings are explicit so telegraphs, damage, and animation share a clock. */
export const ENEMIES = {
  legionary: { name: 'Imperial Legionary', hp: 150, damage: 25, speed: 3.8, radius: 0.6, range: 2.3, cooldown: 2.2, windup: 0.62, element: 'physical', style: 'melee', weapon: 'sword', color: 0x594655, scale: 1, xp: 12 },
  shield: { name: 'Imperial Shieldbearer', hp: 220, damage: 28, speed: 2.8, radius: 0.7, range: 2.5, cooldown: 3, windup: 0.85, element: 'physical', style: 'shield', weapon: 'spearshield', color: 0x494655, scale: 1.08, xp: 18 },
  knight: { name: 'Tempest Knight', hp: 245, damage: 42, speed: 4.5, radius: 0.65, range: 3.1, cooldown: 2.6, windup: 0.75, element: 'storm', style: 'blink', weapon: 'twinspears', color: 0x3e3555, scale: 1.1, xp: 24 },
  shardborn: { name: 'Shardborn', hp: 190, damage: 32, speed: 4.8, radius: 0.75, range: 2.8, cooldown: 1.9, windup: 0.7, element: 'region', style: 'beast', weapon: 'claws', color: 0x514864, scale: 1.12, xp: 15 },
  priest: { name: 'Hollow Priest', hp: 165, damage: 23, speed: 2.6, radius: 0.55, range: 14, cooldown: 4.2, windup: 1.05, element: 'void', style: 'priest', weapon: 'staff', color: 0x453647, scale: 1.04, xp: 24 },
  brute: { name: 'Ash Brute', hp: 390, damage: 55, speed: 2.65, radius: 0.95, range: 3.6, cooldown: 3.3, windup: 1.15, element: 'fire', style: 'brute', weapon: 'hammer', color: 0x664434, scale: 1.42, xp: 30 },
  stalker: { name: 'Void Stalker', hp: 165, damage: 41, speed: 5.4, radius: 0.55, range: 2.6, cooldown: 2.8, windup: 0.72, element: 'void', style: 'stalker', weapon: 'daggers', color: 0x34273f, scale: 1, xp: 22 },
  reaver: { name: 'Sky Reaver', hp: 175, damage: 32, speed: 4.3, radius: 0.6, range: 17, cooldown: 3.5, windup: 0.95, element: 'wind', style: 'ranged', weapon: 'bow', color: 0x3d5154, scale: 1, xp: 20 },
  guardian: { name: 'Crown Guardian', hp: 360, damage: 45, speed: 3.4, radius: 0.85, range: 9, cooldown: 3.6, windup: 1.05, element: 'region', style: 'guardian', weapon: 'gauntlets', color: 0x6c5b46, scale: 1.3, xp: 35 },
  wisp: { name: 'Fractured Echo', hp: 75, damage: 22, speed: 5.2, radius: 0.4, range: 10, cooldown: 2.5, windup: 0.8, element: 'region', style: 'wisp', weapon: 'ritual', color: 0x846caa, scale: 0.7, xp: 10 },
};
export const BOSSES = {
  colossus: { name: 'THE THUNDER COLOSSUS', title: 'A crown fragment given form', hp: 3800, damage: 70, scale: 3.4, speed: 2.6, weapon: 'gauntlets', element: 'storm', color: 0x6e6590, phases: ['Iron Prison', 'The Sky Descends', 'Heart of Thunder'], moves: ['slam', 'stormfield', 'charge', 'shatterfloor'] },
  ashking: { name: 'THE ASH KING', title: 'Nothing left to burn', hp: 4900, damage: 78, scale: 2.65, speed: 3.2, weapon: 'sword', element: 'fire', color: 0x956243, phases: ['The Burning Crown', 'A Broken Blade', 'Only Ash Remains'], moves: ['cleave', 'lavaring', 'charge', 'eruption'] },
  saint: { name: 'SAINT AVEL', title: 'Mother of the stolen hour', hp: 4350, damage: 68, scale: 1.75, speed: 3.6, weapon: 'staff', element: 'frost', color: 0x95c3d3, phases: ['The Still Hour', 'Seventeen Winters', 'A Mother Remembers'], moves: ['frostfan', 'timefreeze', 'mirrors', 'iceprison'] },
  worldbeast: { name: 'THE WORLD BEAST', title: 'Guardian, not monster', hp: 5100, damage: 75, scale: 3.1, speed: 4.4, weapon: 'claws', element: 'nature', color: 0x78905a, phases: ['Ancient Hunger', 'The Hunt', 'The Wound Beneath'], moves: ['pounce', 'roots', 'charge', 'roar'] },
  rootless: { name: 'THE ROOTLESS GOD', title: 'What the forest kept buried', hp: 6900, damage: 82, scale: 3.8, speed: 1.5, weapon: 'claws', element: 'void', color: 0x724d87, phases: ['Beneath the City', 'A Thousand Mouths', 'The Last Root'], moves: ['roots', 'voidzones', 'summon', 'movingfloor'] },
  lucen: { name: 'LUCEN CORVEN', title: 'Brother of the storm', hp: 4700, damage: 57, scale: 1.13, speed: 7.2, weapon: 'twinspears', element: 'storm', color: 0x7f63ba, phases: ['The Imperial Mask', 'Seventeen Years', 'Brothers'], moves: ['blinkstrike', 'stormwall', 'counter', 'hurricane'] },
  malthren: { name: 'EMPEROR MALTHREN VANE', title: 'Two million for the world', hp: 8800, damage: 87, scale: 1.62, speed: 4.3, weapon: 'sword', element: 'void', color: 0xc4a363, phases: ['The Five Fragments', 'The Ascension', 'A King Without a Sky'], moves: ['elements', 'cleave', 'crownbeam', 'summon'] },
  astra: { name: 'ASTRA VEYR', title: 'The Living Storm', hp: 12500, damage: 92, scale: 2.6, speed: 2.1, weapon: 'ritual', element: 'storm', color: 0xba95fc, phases: ['The Prison Opens', 'A World Unmade', 'Eleven Ordinary People'], moves: ['skyhand', 'stormfield', 'shatterfloor', 'crownbeam'] },
  warengine: { name: 'IMPERIAL WAR ENGINE', title: 'The Night of Thunder', hp: 2200, damage: 58, scale: 2.4, speed: 2.2, weapon: 'gauntlets', element: 'fire', color: 0x806749, phases: ['Siegebreaker', 'Overload'], moves: ['crownbeam', 'slam', 'summon'] },
  warden: { name: 'THE CROWNLESS WARDEN', title: 'An oath with no one left to keep it', hp: 5800, damage: 76, scale: 2.1, speed: 3.7, weapon: 'spearshield', element: 'void', color: 0x887aa6, phases: ['Forgotten Vow', 'No Crown, No Mercy', 'Release'], moves: ['cleave', 'voidzones', 'stormwall'] },
};
export const ENEMY_POOLS = [
  ['legionary', 'shield', 'reaver', 'knight', 'shardborn'],
  ['legionary', 'brute', 'priest', 'reaver', 'guardian'],
  ['shardborn', 'priest', 'shield', 'wisp', 'guardian'],
  ['shardborn', 'stalker', 'reaver', 'brute', 'priest'],
  ['knight', 'guardian', 'stalker', 'priest', 'brute', 'wisp'],
];
