import { SAVE_VERSION, DIFFICULTY } from './config.js';
import { createProfile, profileSummary, availablePoints } from '../game/progression.js';
import { HEROES, HERO_BY_ID, skillNodes } from '../data/heroes.js';
import { CAMPAIGN, getMission } from '../data/campaign.js';
import { RELIC_BY_ID } from '../data/relics.js';
import { LORE_BY_ID } from '../data/lore.js';
import { clamp, hashString } from './math.js';

const PREFIX = 'stormcrown.save.v3.';
const MAX_BYTES = 2_000_000;
const number = (v, min, max, fallback = 0) => Number.isFinite(v) ? clamp(v,min,max) : fallback;
const strings = (v, allowed, max = 500) => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x.length < 150 && (!allowed || allowed(x))))].slice(0,max) : [];
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

/** Strict import boundary. Save files can never inject markup, code, or prototype properties. */
export function sanitizeProfile(raw) {
  if (!plain(raw)) throw new Error('This is not a STORMCROWN save file.');
  if (raw.version !== SAVE_VERSION) throw new Error(`Save version ${raw.version ?? 'unknown'} is not supported by this build.`);
  const p = createProfile(DIFFICULTY[raw.difficulty] ? raw.difficulty : 'oathkeeper');
  p.created = number(raw.created,0,1e15,Date.now()); p.updated = number(raw.updated,0,1e15,Date.now());
  p.name = typeof raw.name === 'string' ? raw.name.replace(/[<>\u0000-\u001f]/g,'').slice(0,40) : 'The Warden';
  p.completed = strings(raw.completed,id => !!getMission(id));
  // Do not allow a malformed noncontiguous story list to unlock later acts.
  let gap = false;
  for (const m of CAMPAIGN) { if (!p.completed.includes(m.id)) gap = true; else if (gap) p.completed = p.completed.filter(id => id !== m.id); }
  const earned = ['rael','sera','brann', ...CAMPAIGN.filter(m => p.completed.includes(m.id) && m.unlockHero).map(m => m.unlockHero)];
  p.ended = p.completed.includes(CAMPAIGN.at(-1).id);
  p.unlocked = p.ended ? HEROES.map(h => h.id) : [...new Set(earned)];
  const party = strings(raw.party,id => p.unlocked.includes(id),3);
  for (const id of p.unlocked) if (party.length < 3 && !party.includes(id)) party.push(id);
  p.party = party; p.active = Math.floor(number(raw.active,0,2));
  for (const key of ['xp','aether','shards','kills','reactions','rescues','deaths']) p[key] = Math.floor(number(raw[key],0,1e9,p[key]));
  p.elapsed = number(raw.elapsed,0,3e8); p.bestTrial = Math.floor(number(raw.bestTrial,0,1000)); p.trialTier = Math.floor(number(raw.trialTier,1,1001,1));
  p.crownfall = p.ended && raw.crownfall === true; p.oathArmor = p.completed.includes('eleven') && raw.oathArmor === true;
  const heroData = plain(raw.heroes) ? raw.heroes : {};
  for (const h of HEROES) {
    const saved = plain(heroData[h.id]) ? heroData[h.id] : {};
    p.heroes[h.id].weapon = Math.floor(number(saved.weapon,0,4));
    p.heroes[h.id].talks = strings(saved.talks,id => /^act-[0-4]$/.test(id),5);
    for (const node of skillNodes(h.id)) {
      const rank = Math.floor(number(saved.nodes?.[node.id],0,node.max));
      if (rank && (node.tier === 0 || p.heroes[h.id].nodes[`${h.id}-${node.path}-${node.tier-1}`])) p.heroes[h.id].nodes[node.id] = rank;
    }
    // Invalid overallocated skill trees are reset; legitimate progress is preserved.
    if (availablePoints(p,h.id) < 0) p.heroes[h.id].nodes = {};
  }
  p.relics = strings(raw.relics,id => !!RELIC_BY_ID[id],30);
  p.equippedRelics = strings(raw.equippedRelics,id => p.relics.includes(id),2);
  p.lore = strings(raw.lore,id => !!LORE_BY_ID[id],100);
  p.journalRead = strings(raw.journalRead,id => !!LORE_BY_ID[id],100);
  p.tutorialSeen = strings(raw.tutorialSeen,null,50);
  for (const [key,value] of Object.entries(plain(raw.choices) ? raw.choices : {})) if (['cathedral','vex','lucen'].includes(key) && typeof value === 'string' && value.length < 80) p.choices[key] = value;
  for (const [key,value] of Object.entries(plain(raw.medals) ? raw.medals : {})) if (getMission(key) && ['bronze','silver','gold'].includes(value?.rank)) p.medals[key] = {rank:value.rank,time:number(value.time,0,1e7),kills:number(value.kills,0,100000)};
  for (const [key,value] of Object.entries(plain(raw.visited) ? raw.visited : {})) { const [id,room] = key.split(':'); if (getMission(id) && /^\d+$/.test(room||'') && Number(room)<40 && value === true) p.visited[key] = true; }
  if (plain(raw.checkpoint)) {
    const c = raw.checkpoint, mission = getMission(c.mission);
    if (mission && Number.isInteger(c.stage) && c.stage >= 0 && c.stage < mission.stages.length) {
      p.checkpoint = {
        mission:mission.id, stage:c.stage, seed:Math.floor(number(c.seed,0,0xffffffff,1)),
        party:strings(c.party,id => p.unlocked.includes(id),3), active:Math.floor(number(c.active,0,2)),
        resources:Array.isArray(c.resources) ? c.resources.slice(0,3).map(r => ({ hp:number(r?.hp,.05,1,1), focus:number(r?.focus,0,250,100), judgment:number(r?.judgment,0,100,40) })) : [],
        remedies:Math.floor(number(c.remedies,0,6,3)), elapsed:number(c.elapsed,0,1e7),
        optional:strings(c.optional,null,60), crownfall:p.ended && c.crownfall === true,
        stats:{ kills:number(c.stats?.kills,0,100000), rescues:number(c.stats?.rescues,0,10000), reactions:number(c.stats?.reactions,0,100000), damageTaken:number(c.stats?.damageTaken,0,1e9), deaths:number(c.stats?.deaths,0,10000) },
      };
      if (p.checkpoint.party.length !== 3) p.checkpoint.party = [...p.party];
    }
  }
  return p;
}
export function packSave(profile) {
  const payload = JSON.stringify(sanitizeProfile(profile));
  return JSON.stringify({ format:'STORMCROWN', version:SAVE_VERSION, checksum:hashString(payload).toString(16), payload });
}
export function unpackSave(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('The save file is empty or too large.');
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('The save file is not valid JSON.'); }
  if (envelope.format !== 'STORMCROWN' || typeof envelope.payload !== 'string') throw new Error('This is not a STORMCROWN save file.');
  if (hashString(envelope.payload).toString(16) !== envelope.checksum) throw new Error('This save is damaged. Try its automatic backup.');
  return sanitizeProfile(JSON.parse(envelope.payload));
}
export class SaveStore {
  constructor(storage) {
    try { this.storage = storage ?? globalThis.localStorage; }
    catch { this.storage = null; }
    this.error = null;
  }
  save(profile, slot = 0) {
    if (!this.storage) { this.error = 'Browser storage is unavailable. Use Export Save to keep your progress.'; return false; }
    const key = PREFIX + clamp(slot,0,3);
    try {
      const previous = this.storage.getItem(key);
      if (previous) { try { unpackSave(previous); this.storage.setItem(key+'.backup',previous); } catch { /* Never replace a healthy backup with corrupt data. */ } }
      profile.updated = Date.now();
      const packed = packSave(profile);
      this.storage.setItem(key,packed);
      // Read-back catches storage implementations that silently reject a write.
      if (this.storage.getItem(key) !== packed) throw new Error('The browser did not retain the save.');
      this.error = null; return true;
    } catch (error) { this.error = 'Could not save locally. Export your save before closing the game. ' + error.message; return false; }
  }
  load(slot = 0) {
    const key = PREFIX + clamp(slot,0,3); this.error = null;
    for (const suffix of ['', '.backup']) {
      try {
        const text = this.storage?.getItem(key+suffix); if (!text) continue;
        const profile = unpackSave(text);
        if (suffix) this.error = 'The most recent save was damaged. Its previous automatic backup was restored.';
        return profile;
      } catch (error) { this.error = error.message; }
    }
    return null;
  }
  list() { return [0,1,2,3].map(slot => { const p = this.load(slot); return {slot, ...(p ? profileSummary(p) : {empty:true})}; }); }
  delete(slot) { if (slot < 0 || slot > 3) return false; try { this.storage?.removeItem(PREFIX+slot); this.storage?.removeItem(PREFIX+slot+'.backup'); return true; } catch { return false; } }
  export(profile) { return packSave(profile); }
  import(text) { return unpackSave(text); }
}
