import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,EMPTY_INPUT,containsHazard} from '../src/game/simulation.js';
import {CAMPAIGN,COMPANION_QUESTS,HUNTS,trialMission,getMission} from '../src/data/campaign.js';
import {HEROES} from '../src/data/heroes.js';
import {createProfile,finishMission,storyCount} from '../src/game/progression.js';
import {trainingMission} from '../src/game/training.js';
import {resetEntityIds} from '../src/game/entities.js';
import {SaveStore,packSave,unpackSave} from '../src/core/save.js';
import {play} from './helpers/pilot.mjs';

const fixture=stages=>({...CAMPAIGN[0],id:'qa-fixture',stages,level:1});
const anchorStage=[{type:'anchors',title:'The Shattered Oath'}];
for(const hero of HEROES)test(`final anchor accepts ${hero.short}'s first ability at its cast origin`,()=>{
  const p=createProfile('story');p.unlocked=HEROES.map(h=>h.id);
  const s=new Simulation(p,fixture(anchorStage));s.director.start();
  const a=s.director.required.find(a=>a.heroId===hero.id);
  // Unit fixture placement, not a campaign skip. Cast uses the real ability handler.
  Object.assign(s.activeHero,{x:a.x,z:a.z});assert.equal(s.director.interact(a),true);
  assert.equal(s.abilities.cast(s.activeHero,0),true);
  assert.equal(a.bound,true);assert.equal(s.director.progress,1);s.dispose();
});
test('training cannot enter defeat or increment journey deaths',()=>{
  const p=createProfile(),s=new Simulation(p,trainingMission(p,'boss'));s.director.start();
  for(const h of s.party)s.combat.damage(s.environment,h,h.maxHp*100,{unblockable:true,noReaction:true});
  assert.equal(s.state,'running');assert.equal(p.deaths,0);assert.equal(s.stats.deaths,0);
  assert.ok(s.party.every(h=>!h.dead&&h.hp>0));s.dispose();
});
test('save roundtrip, failed primary recovery, and manual slots stay independent',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const store=new SaveStore(storage),p=createProfile();assert.ok(store.save(p,0));
  p.aether+=10;assert.ok(store.save(p,0));assert.ok(store.save(p,1));
  map.set('stormcrown.save.v3.0','damaged');const restored=store.load(0);
  assert.equal(restored.aether,p.aether-10);assert.match(store.error,/backup/i);
  assert.equal(store.load(1).aether,p.aether);assert.deepEqual(unpackSave(packSave(p)).party,p.party);
});
test('all authored story missions reach the playable ending using production input and combat',()=>{
  const p=createProfile('story');
  for(const m of CAMPAIGN){
    resetEntityIds();const s=new Simulation(p,m),r=play(s,600);
    assert.equal(r.state,'victory',`${m.id}: ${JSON.stringify(r)}`);
    finishMission(p,m,r.result);assert.equal(unpackSave(packSave(p)).completed.length,p.completed.length);s.dispose();
  }
  assert.equal(storyCount(p),40);assert.equal(p.ended,true);assert.equal(p.unlocked.length,11);
});
