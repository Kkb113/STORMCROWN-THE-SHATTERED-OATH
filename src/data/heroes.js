/** The eleven anchors of Aetherra. Mechanics live in the combat system, data here. */
const skill = (name, type, description, cooldown, cost, power, radius = 4) => ({ name, type, description, cooldown, cost, power, radius });
export const HEROES = [
  {
    id: 'rael', name: 'Rael Corven', short: 'Rael', role: 'The Stormblade', element: 'storm', weapon: 'sword',
    color: '#9b8cff', colorHex: 0x9283ff, cloth: 0x243366, hair: 0x251b1a, skin: 0xc69578,
    hp: 660, damage: 42, speed: 7.4, range: 3.2, armor: 0.12, height: 1.04,
    passive: 'Eye of the Storm', passiveText: 'Absorb marked lightning strikes to restore Focus and charge Judgment. Consecutive attacks increase damage.',
    quote: 'We do not need another king. We need each other.',
    paths: ['Storm Duelist', 'Thunder Lord', 'Tempest Guardian'],
    upgrades: ['Broken military sword', 'Stormblade', 'Tempest Fang', 'Crownshard', 'Oathbreaker'],
    skills: [
      skill('Lightning Dash', 'stormdash', 'Become a bolt of lightning. Pierce enemies ahead and escape danger.', 4.5, 18, 1.9, 3),
      skill('Chain Arc', 'chain', 'Lightning leaps through nearby enemies. Wet targets trigger CHAIN SURGE.', 8, 28, 2.4, 10),
      skill('Judgment Tempest', 'tempest', 'Raise the Stormblade. Repeated strikes launch enemies before a final, colossal detonation.', 1, 100, 8, 13),
    ],
  },
  {
    id: 'sera', name: 'Sera Vhal', short: 'Sera', role: 'The Ember Duelist', element: 'fire', weapon: 'chains',
    color: '#ff885a', colorHex: 0xff713a, cloth: 0x601b28, hair: 0x882e17, skin: 0xbd825e,
    hp: 580, damage: 43, speed: 8.1, range: 3.6, armor: 0.07, height: 0.98,
    passive: 'Last Ember', passiveText: 'Gain up to 55% damage as health falls. Burning enemies return a little health when struck.',
    quote: 'You do not get to call their ashes a necessary sacrifice.',
    paths: ['Cinder Dancer', 'Phoenix Heart', 'Ashen Vow'],
    upgrades: ['Prison chains', 'Ember links', 'Cinder fangs', 'Phoenix talons', 'Unbound'],
    skills: [
      skill('Cinder Tether', 'tether', 'Hook a distant foe and drag them into your blades, igniting them.', 5, 20, 2.1, 11),
      skill('Ember Spiral', 'firespin', 'Spin flaming chains around you. Move while striking every nearby enemy.', 9, 30, 3, 5.5),
      skill('Phoenix Rift', 'phoenix', 'Become a blazing phoenix. Tear through the battlefield and leave a burning rift.', 1, 100, 9, 14),
    ],
  },
  {
    id: 'brann', name: 'Brann Korr', short: 'Brann', role: 'The Vanguard', element: 'earth', weapon: 'hammer',
    color: '#d2ae78', colorHex: 0xd6a85a, cloth: 0x3b3430, hair: 0x372a20, skin: 0xac8569,
    hp: 930, damage: 66, speed: 5.8, range: 3.6, armor: 0.3, height: 1.18,
    passive: 'Unbroken', passiveText: 'Perfect parries grant Resolve. Heavy attacks spend Resolve for enormous stagger and shatter frozen foes.',
    quote: 'A wall is only worth building when someone is behind it.',
    paths: ['Worldbreaker', 'Iron Mountain', 'Stone Sentinel'],
    upgrades: ['Siege hammer', 'Bastion', 'Mountain heart', 'Worldsplitter', 'The Last Wall'],
    skills: [
      skill('Faultline', 'faultline', 'Raise a line of stone that launches enemies. Frozen enemies SHATTER.', 7, 25, 3.5, 9),
      skill('Living Bulwark', 'bulwark', 'Taunt nearby enemies and shield the entire party. Counters generate Resolve.', 13, 30, 0.8, 10),
      skill('Worldsplitter', 'worldsplitter', 'Fracture the battlefield with a hammer blow. Stone erupts beneath every foe.', 1, 100, 10, 13),
    ],
  },
  {
    id: 'nym', name: 'Nym Avel', short: 'Nym', role: 'The Frost Oracle', element: 'frost', weapon: 'staff',
    color: '#a4e7ff', colorHex: 0x8fe7ff, cloth: 0x7594ac, hair: 0xc4dbe0, skin: 0xe0baae,
    hp: 510, damage: 33, speed: 6.7, range: 14, armor: 0.06, height: 1.01,
    passive: 'A Second Stolen', passiveText: 'Frost slows enemies. Repeated frost hits freeze them. Your heavy attack shatters frozen targets.',
    quote: 'I have seen the end. That does not mean I have accepted it.',
    paths: ['Winter Seer', 'Glass Dominion', 'Stillwater'],
    upgrades: ['Pilgrim staff', 'Rimewood', 'Winterglass', 'Still Hour', 'Tomorrow'],
    skills: [
      skill('Rime Lance', 'frostlance', 'A piercing lance of ice freezes enemies in a line.', 5.5, 18, 2.6, 14),
      skill('Stillwater', 'blizzard', 'Create a blizzard that slows, then freezes, foes in its center.', 11, 32, 3, 7),
      skill('White Silence', 'silence', 'Stop the battlefield in a stolen moment. Everything frozen then shatters.', 1, 100, 8, 16),
    ],
  },
  {
    id: 'vex', name: 'Vex Talon', short: 'Vex', role: 'The Assassin', element: 'shadow', weapon: 'daggers',
    color: '#cc9bff', colorHex: 0xb866ff, cloth: 0x261e34, hair: 0x15111e, skin: 0x927069,
    hp: 520, damage: 35, speed: 8.8, range: 2.5, armor: 0.08, height: 1.02,
    passive: 'A Knife Remembered', passiveText: 'Striking from behind deals double damage. Marked enemies take additional damage from Blackout.',
    quote: 'Trust is not something I deserve. It is something I intend to earn.',
    paths: ['Night Reaver', 'Silent Verdict', 'Veilwalker'],
    upgrades: ['Imperial knives', 'Whispers', 'Night teeth', 'Dusk and Ruin', 'Atonement'],
    skills: [
      skill('Shadowstep', 'shadowstep', 'Reappear behind your target. Mark them and briefly become untouchable.', 4.5, 20, 2.8, 13),
      skill('Nightblades', 'daggerfan', 'Throw a fan of daggers that marks enemies with Void corruption.', 8, 25, 2.6, 13),
      skill('Blackout', 'blackout', 'Extinguish the battlefield. Execute marked, weakened enemies in a chain of shadow strikes.', 1, 100, 8, 15),
    ],
  },
  {
    id: 'mira', name: 'Mira Solenne', short: 'Mira', role: 'The Sun Knight', element: 'light', weapon: 'spearshield',
    color: '#ffe6a1', colorHex: 0xffdb84, cloth: 0xdfc994, hair: 0x593d28, skin: 0xb47f62,
    hp: 810, damage: 44, speed: 6.5, range: 4, armor: 0.23, height: 1.09,
    passive: 'Dawnkeeper', passiveText: 'Blocked damage becomes Radiance. Shields protect allies. Light striking corruption triggers ECLIPSE.',
    quote: 'Perhaps the light was never asking us to burn anyone.',
    paths: ['Solar Judge', 'Dawn Aegis', 'Merciful Flame'],
    upgrades: ['Votive spear', 'Sunward', 'Daybreak', 'Heavenfall', 'Mercy'],
    skills: [
      skill('Sunward', 'sunward', 'Raise a radiant barrier and restore health to the party.', 15, 30, 1.5, 12),
      skill('Radiant Lance', 'lightlance', 'A spear of light pierces the enemy line and detonates Void corruption.', 7, 25, 3.1, 15),
      skill('Solar Descent', 'solar', 'Call down a monumental spear of light. Heal allies beneath its radiance.', 1, 100, 9, 13),
    ],
  },
  {
    id: 'torren', name: 'Torren Fen', short: 'Torren', role: 'The Wildshaper', element: 'nature', weapon: 'claws',
    color: '#9ddc8a', colorHex: 0x79ce6d, cloth: 0x33452d, hair: 0x412d1a, skin: 0xa87a4a,
    hp: 790, damage: 48, speed: 7.6, range: 3, armor: 0.16, height: 1.13,
    passive: 'Wild Heart', passiveText: 'Attacks build Rage. Transforming restores health and grants unstoppable, sweeping claw attacks.',
    quote: 'The forest remembers. I am trying to learn how to forgive.',
    paths: ['Titan Blood', 'Thornspeaker', 'Primal Warden'],
    upgrades: ['Bone claws', 'Briar teeth', 'Elder talons', 'Maw of Ages', 'First Spring'],
    skills: [
      skill('Briar Snare', 'briars', 'Living roots drag enemies together and hold them in place.', 9, 25, 2.3, 8),
      skill('Predator Leap', 'leap', 'Leap to your prey and rend them with both claws.', 5, 20, 3.4, 11),
      skill('Titan Maw', 'beast', 'Become an ancient beast for 14 seconds. Gain health, reach, and devastating attacks.', 1, 100, 5, 9),
    ],
  },
  {
    id: 'kes', name: 'Kes Renn', short: 'Kes', role: 'The Storm Hunter', element: 'wind', weapon: 'bow',
    color: '#80e0d1', colorHex: 0x77dfcd, cloth: 0x28534e, hair: 0xa3885f, skin: 0xbb916e,
    hp: 535, damage: 37, speed: 8.1, range: 20, armor: 0.05, height: 1.02,
    passive: 'High Ground', passiveText: 'Distant shots deal more damage. Heavy arrows pierce shields. Wind ignites burning enemies into FIRESTORM.',
    quote: 'There is always another way through. Usually a very stupid one.',
    paths: ['Gale Strider', 'Hawkeye', 'Tempest Arrows'],
    upgrades: ['Skywood bow', 'Gale string', 'Hawkfall', 'Last Horizon', 'Sky Funeral'],
    skills: [
      skill('Gale Pin', 'galearrow', 'Loose a charged arrow that pierces armor and throws enemies backward.', 5, 18, 3.2, 21),
      skill('Cyclone', 'cyclone', 'A wandering tornado gathers enemies. Add fire to create a firestorm.', 11, 30, 3.2, 8),
      skill('Sky Funeral', 'arrowstorm', 'Fill a vast cyclone with hundreds of arrows and descend upon your prey.', 1, 100, 9, 14),
    ],
  },
  {
    id: 'oren', name: 'Oren Vox', short: 'Oren', role: 'The Runesmith', element: 'arcane', weapon: 'gauntlets',
    color: '#75bdff', colorHex: 0x559fff, cloth: 0x314254, hair: 0x4b4035, skin: 0xc89b7a,
    hp: 740, damage: 43, speed: 6.2, range: 3.1, armor: 0.2, height: 0.94,
    passive: 'Measure Twice', passiveText: 'Constructs draw enemy attention. Heavy punches detonate your nearby mines for bonus damage.',
    quote: 'Impossible is a word for people who have not checked their sums.',
    paths: ['Siege Artisan', 'Runic Dynamo', 'Iron Covenant'],
    upgrades: ['Foundry gloves', 'Runefists', 'Siegebreakers', 'Crown Engine', 'New Foundation'],
    skills: [
      skill('Rune Mine', 'mine', 'Place a runic trap. It explodes when enemies approach, staggering the entire group.', 5, 18, 4, 5),
      skill('Sentinel', 'turret', 'Build a rune sentinel that fires at nearby enemies for 16 seconds.', 14, 32, 0.8, 16),
      skill('Rune Engine', 'engine', 'Deploy a towering war construct that bombards enemies for 18 seconds.', 1, 100, 6, 18),
    ],
  },
  {
    id: 'maelin', name: 'Maelin Dray', short: 'Maelin', role: 'The Gravebinder', element: 'spirit', weapon: 'ritual',
    color: '#b4c4ed', colorHex: 0xa5b2ef, cloth: 0x3c354b, hair: 0x9b91ad, skin: 0xc3a4b0,
    hp: 565, damage: 38, speed: 6.8, range: 11, armor: 0.1, height: 1.06,
    passive: 'No One Forgotten', passiveText: 'Nearby deaths restore Focus and gather Souls. Souls empower your summoned warriors.',
    quote: 'The dead are not a weapon. They are people who still have something to say.',
    paths: ['Soul Shepherd', 'Veil Cantor', 'Grave Covenant'],
    upgrades: ['Mourning blade', 'Gravesong', 'Soulglass', 'Last Choir', 'Remembrance'],
    skills: [
      skill('Grave Mark', 'gravemark', 'Corrupt a group with Spirit and Void. Their deaths feed your power.', 6, 20, 2.4, 8),
      skill('Soul Tithe', 'soultithe', 'Draw life from marked foes to heal the party and raise a spectral ally.', 12, 30, 2.8, 11),
      skill('Choir of the Dead', 'choir', 'Call fallen warriors back to the battlefield. The choir fights beside you for 18 seconds.', 1, 100, 6, 16),
    ],
  },
  {
    id: 'lucen', name: 'Lucen Corven', short: 'Lucen', role: 'The Tempest Warden', element: 'storm', secondary: 'void', weapon: 'twinspears',
    color: '#b390ff', colorHex: 0x9970ff, cloth: 0x252138, hair: 0x302127, skin: 0xb98a78,
    hp: 760, damage: 51, speed: 8.2, range: 4.1, armor: 0.16, height: 1.12,
    passive: 'Between Two Storms', passiveText: 'Perfect counters reset Rift Step. Switching from Rael imbues the next attack with both Storm and Void.',
    quote: 'Seventeen years, little brother. And you still refuse to let go.',
    paths: ['Rift Warden', 'Crownless King', 'Brother of Thunder'],
    upgrades: ['Imperial spears', 'Twin tempests', 'Riftspires', 'Crownless', 'Brothers of the Storm'],
    skills: [
      skill('Rift Step', 'riftstep', 'Pass through enemies in a tear of Void. Your next counter releases lightning.', 5, 20, 3, 11),
      skill('Storm Spears', 'stormspears', 'Hurl twin spears that bind enemies inside a violent electric vortex.', 9, 30, 3.8, 13),
      skill('Crown of Storms', 'hurricane', 'Become the eye of a hurricane of Storm and Void. Tear enemies from the ground.', 1, 100, 10, 15),
    ],
  },
];
export const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
export const ELEMENTS = {
  storm: { name: 'Storm', color: '#a298ff', hex: 0x9d8cff, glyph: 'ϟ' },
  fire: { name: 'Flame', color: '#ff8a54', hex: 0xff783c, glyph: '♨' },
  earth: { name: 'Earth', color: '#d9b87d', hex: 0xd4ac62, glyph: '◆' },
  frost: { name: 'Frost', color: '#a2e7ff', hex: 0x9beaff, glyph: '❄' },
  shadow: { name: 'Shadow', color: '#c794ff', hex: 0xc18bff, glyph: '☽' },
  light: { name: 'Light', color: '#ffe7a1', hex: 0xffe290, glyph: '☀' },
  nature: { name: 'Nature', color: '#96d883', hex: 0x8bd67a, glyph: '❧' },
  wind: { name: 'Wind', color: '#88e2d5', hex: 0x88e2d5, glyph: '≋' },
  arcane: { name: 'Arcane', color: '#7bbcff', hex: 0x7bbcff, glyph: '⌘' },
  spirit: { name: 'Spirit', color: '#b8c7ff', hex: 0xb8c7ff, glyph: '✧' },
  void: { name: 'Void', color: '#af79ff', hex: 0xaf79ff, glyph: '◈' },
};
export const BONDS = [
  { id: 'thunderfire', heroes: ['rael', 'sera'], name: 'Thunderfire', color: 0xff9fc8, text: 'Storm races through Sera’s chains, creating rings of electrical fire.' },
  { id: 'frozenearth', heroes: ['nym', 'brann'], name: 'Frozen Earth', color: 0xa5e7ff, text: 'A forest of frozen stone erupts, then shatters into a thousand blades.' },
  { id: 'twintempest', heroes: ['rael', 'lucen'], name: 'Twin Tempest', color: 0xa58bff, text: 'Two brothers. Two storms. One devastating collision.' },
  { id: 'eclipse', heroes: ['mira', 'maelin'], name: 'The Merciful Eclipse', color: 0xffe4ff, text: 'Light and forbidden Spirit become a sanctuary, not a sentence.' },
  { id: 'wildhunt', heroes: ['torren', 'kes'], name: 'The Wild Hunt', color: 0x9af8b9, text: 'Living roots and a hail of windborne arrows trap the enemy line.' },
  { id: 'nightengine', heroes: ['vex', 'oren'], name: 'The Unseen Engine', color: 0xb193ff, text: 'Hidden runes detonate wherever Vex steps through the veil.' },
];
export function skillNodes(heroId) {
  const h = HERO_BY_ID[heroId];
  if (!h) return [];
  const effects = [
    ['damage', 'attackSpeed', 'crit', 'execute'],
    ['power', 'focus', 'cooldown', 'ultimate'],
    ['health', 'armor', 'parry', 'recovery'],
  ];
  const labels = [
    ['Edge of Resolve', 'Relentless Rhythm', 'Perfect Opening', 'Last Word'],
    ['Elemental Memory', 'Crown Vessel', 'Endless Current', 'World Awakener'],
    ['An Oath to Keep', 'Stand Together', 'Unbroken Moment', 'Second Dawn'],
  ];
  return effects.flatMap((path, pi) => path.map((effect, ni) => ({ id: `${heroId}-${pi}-${ni}`, path: pi, tier: ni, name: labels[pi][ni], effect, max: 3, value: [0.07, 0.06, 0.045, 0.08][ni], description: `${h.paths[pi]} • ${['Foundation', 'Discipline', 'Mastery', 'Ascendancy'][ni]}` })));
}
