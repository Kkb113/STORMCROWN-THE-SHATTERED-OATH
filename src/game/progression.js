import { HEROES, HERO_BY_ID, BONDS, skillNodes } from '../data/heroes.js';
import { CAMPAIGN, MISSION_BY_ID } from '../data/campaign.js';
import { RELICS, RELIC_BY_ID } from '../data/relics.js';
import { LORE } from '../data/lore.js';
import { clamp } from '../core/math.js';
import { SAVE_VERSION, DIFFICULTY } from '../core/config.js';

export const MAX_LEVEL = 45;
export const WEAPON_GATES = [0, 4, 12, 24, 32];
export const WEAPON_COSTS = [0, 500, 1400, 2600, 4200];
export const WEAPON_SHARDS = [0, 3, 6, 10, 16];
export const xpForLevel = level => Math.round(180 * (level - 1) + 42 * (level - 1) ** 2);
export function levelForXP(xp) { let level = 1; while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++; return level; }
export function storyCount(profile) { return CAMPAIGN.filter(m => profile.completed.includes(m.id)).length; }
export function nextStory(profile) { return CAMPAIGN.find(m => !profile.completed.includes(m.id)) ?? null; }
export function createProfile(difficulty = 'oathkeeper', now = Date.now()) {
  return {
    version: SAVE_VERSION, created: now, updated: now, name: 'The Warden', difficulty: DIFFICULTY[difficulty] ? difficulty : 'oathkeeper',
    completed: [], unlocked: ['rael','sera','brann'], party: ['rael','sera','brann'], active: 0,
    heroes: Object.fromEntries(HEROES.map(h => [h.id, { weapon: 0, nodes: {}, talks: [] }])),
    xp: 0, aether: 550, shards: 6, choices: {}, lore: ['crownfall','warden'],
    relics: [], equippedRelics: [], medals: {}, checkpoint: null, elapsed: 0,
    kills: 0, reactions: 0, rescues: 0, deaths: 0, bestTrial: 0, trialTier: 1,
    ended: false, oathArmor: false, crownfall: false, visited: {}, journalRead: [], tutorialSeen: [],
  };
}
export function availablePoints(profile, heroId) {
  const hero = profile.heroes[heroId];
  const granted = levelForXP(profile.xp) - 1 + (profile.completed.includes(heroId+'1') ? 2 : 0) + (profile.completed.includes(heroId+'2') ? 3 : 0);
  return granted - Object.values(hero?.nodes ?? {}).reduce((a,b) => a+b,0);
}
export function heroBonuses(profile, heroId) {
  const nodes = profile.heroes[heroId]?.nodes ?? {};
  const out = {};
  for (const node of skillNodes(heroId)) out[node.effect] = (out[node.effect] ?? 0) + (nodes[node.id] ?? 0) * node.value;
  return out;
}
export function relicEffects(profile) {
  const out = {};
  for (const id of profile.equippedRelics) for (const [key,value] of Object.entries(RELIC_BY_ID[id]?.effects ?? {})) out[key] = (out[key] ?? 0) + value;
  return out;
}
export function heroStats(profile, id) {
  const h = HERO_BY_ID[id];
  if (!h) throw new Error(`Unknown hero: ${id}`);
  const level = levelForXP(profile.xp), b = heroBonuses(profile,id), r = relicEffects(profile);
  const rank = profile.heroes[id].weapon;
  const scale = 1 + (level - 1) * .079;
  return {
    hp: Math.round(h.hp * scale * (1 + (b.health || 0))),
    damage: h.damage * scale * (1 + rank * .14 + (b.damage || 0)),
    speed: h.speed * (1 + (r.speed || 0)),
    range: h.range, armor: clamp(h.armor + (b.armor || 0) * .5, 0, .65),
    power: 1 + (b.power || 0) + rank * .05,
    attackSpeed: 1 + (b.attackSpeed || 0),
    crit: .06 + (b.crit || 0),
    execute: b.execute || 0,
    maxFocus: 100 + Math.round(100 * (b.focus || 0)),
    focusRegen: 6.5 * (1 + (b.focus || 0)),
    cooldown: 1 / (1 + (b.cooldown || 0)),
    ultimate: 1 + (b.ultimate || 0),
    parryWindow: DIFFICULTY[profile.difficulty].parryWindow + (b.parry || 0) * .25,
    recovery: 1 + (b.recovery || 0),
    level, rank,
  };
}
export function investPoint(profile, heroId, nodeId) {
  if (!profile.unlocked.includes(heroId)) return { ok:false, reason:'This anchor has not joined the crew.' };
  const node = skillNodes(heroId).find(n => n.id === nodeId);
  if (!node) return { ok:false, reason:'Unknown discipline.' };
  const nodes = profile.heroes[heroId].nodes;
  if (availablePoints(profile,heroId) < 1) return { ok:false, reason:'Earn more experience to gain a discipline point.' };
  if ((nodes[node.id] || 0) >= node.max) return { ok:false, reason:'This discipline is mastered.' };
  if (node.tier > 0 && !(nodes[`${heroId}-${node.path}-${node.tier-1}`] > 0)) return { ok:false, reason:'Learn the preceding discipline first.' };
  nodes[node.id] = (nodes[node.id] || 0) + 1;
  return { ok:true };
}
export function resetPoints(profile, heroId) { if (profile.heroes[heroId]) profile.heroes[heroId].nodes = {}; }
export function upgradeWeapon(profile, heroId) {
  if (!profile.unlocked.includes(heroId)) return { ok:false, reason:'This anchor has not joined the crew.' };
  const hero = profile.heroes[heroId], next = hero.weapon + 1;
  if (next > 4) return { ok:false, reason:'The weapon has fulfilled its oath.' };
  if (storyCount(profile) < WEAPON_GATES[next]) return { ok:false, reason:`Complete ${WEAPON_GATES[next]} story missions to discover this transformation.` };
  if (profile.aether < WEAPON_COSTS[next] || profile.shards < WEAPON_SHARDS[next]) return { ok:false, reason:'More Aether and Crown splinters are needed.' };
  profile.aether -= WEAPON_COSTS[next]; profile.shards -= WEAPON_SHARDS[next]; hero.weapon = next;
  return { ok:true, name:HERO_BY_ID[heroId].upgrades[next] };
}
export function setParty(profile, slot, heroId) {
  if (!profile.unlocked.includes(heroId) || !Number.isInteger(slot) || slot < 0 || slot > 2) return false;
  const oldSlot = profile.party.indexOf(heroId);
  if (oldSlot >= 0) [profile.party[slot],profile.party[oldSlot]] = [profile.party[oldSlot],profile.party[slot]];
  else profile.party[slot] = heroId;
  return true;
}
export function equipRelic(profile, id) {
  if (!profile.relics.includes(id)) return { ok:false, reason:'This relic has not been discovered.' };
  if (profile.equippedRelics.includes(id)) { profile.equippedRelics = profile.equippedRelics.filter(v => v !== id); return {ok:true}; }
  if (profile.equippedRelics.length >= 2) return { ok:false, reason:'Unequip a relic first. The crew can carry two active relics.' };
  profile.equippedRelics.push(id); return {ok:true};
}
export function unlockedBonds(profile) {
  return BONDS.filter(b => b.heroes.every(id => profile.unlocked.includes(id)) &&
    (b.id === 'thunderfire' ? storyCount(profile) >= 4 : b.heroes.some(id => profile.completed.includes(id+'2'))));
}
export function currentBonds(profile, party = profile.party) { return unlockedBonds(profile).filter(b => b.heroes.every(id => party.includes(id))); }
export function discoverRewards(profile) {
  const count = storyCount(profile), fresh = { relics:[], lore:[] };
  for (const r of RELICS) if (!profile.relics.includes(r.id) && (r.quest ? profile.completed.includes(r.quest) : count >= r.at)) { profile.relics.push(r.id); fresh.relics.push(r); }
  for (const l of LORE) if (!profile.lore.includes(l.id) && count >= l.at) { profile.lore.push(l.id); fresh.lore.push(l); }
  return fresh;
}
export function finishMission(profile, mission, result = {}) {
  const first = !profile.completed.includes(mission.id), oldLevel = levelForXP(profile.xp);
  if (first) profile.completed.push(mission.id);
  const multiplier = first ? 1 : .3;
  const aether = Math.round(mission.reward * multiplier + (result.optional || 0) * 80);
  const xp = Math.round((300 + mission.level * 80) * (first ? 1 : .45));
  const shards = first ? (mission.kind === 'hunt' ? 12 : mission.kind === 'companion' ? 8 : 5) : 2;
  profile.aether += aether; profile.shards += shards; profile.xp += xp;
  profile.kills += result.kills || 0; profile.rescues += result.rescues || 0; profile.reactions += result.reactions || 0;
  const medal = result.deaths ? 'bronze' : result.damageTaken > (result.maxHealth || 1000) * 2 ? 'silver' : 'gold';
  const order = {bronze:1,silver:2,gold:3};
  if ((order[medal] || 0) > (order[profile.medals[mission.id]?.rank] || 0)) profile.medals[mission.id] = { rank:medal, time:result.time || 0, kills:result.kills || 0 };
  if (mission.unlockHero && !profile.unlocked.includes(mission.unlockHero)) profile.unlocked.push(mission.unlockHero);
  if (mission.final) { profile.ended = true; profile.unlocked = HEROES.map(h => h.id); }
  if (mission.kind === 'trial') { profile.bestTrial = Math.max(profile.bestTrial,mission.tier); profile.trialTier = Math.max(profile.trialTier,mission.tier+1); }
  if (mission.eleven) profile.oathArmor = true;
  profile.checkpoint = null; profile.updated = Date.now();
  const rewards = discoverRewards(profile);
  return { first, aether, xp, shards, medal, oldLevel, level:levelForXP(profile.xp), unlocked:mission.unlockHero, ...rewards };
}
/** Dialogue has progression rewards only once per character per act. */
export function recordConversation(profile, heroId) {
  const act = Math.min(4, Math.floor(storyCount(profile)/8)), key = `act-${act}`;
  const h = profile.heroes[heroId];
  if (!h || h.talks.includes(key)) return false;
  h.talks.push(key); profile.aether += 80; return true;
}
export function recordChoice(profile, missionId, value) { profile.choices[missionId] = value; }
export function profileSummary(profile) {
  return { level:levelForXP(profile.xp), story:storyCount(profile), total:CAMPAIGN.length, name:profile.name, elapsed:profile.elapsed, updated:profile.updated, mission:profile.checkpoint?.mission || null, ended:profile.ended, heroes:profile.unlocked.length };
}
