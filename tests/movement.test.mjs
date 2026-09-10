import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, EMPTY_INPUT } from '../src/game/simulation.js';
import { createProfile, finishMission } from '../src/game/progression.js';
import { CAMPAIGN } from '../src/data/campaign.js';
import { HEROES } from '../src/data/heroes.js';
import { packSave, unpackSave } from '../src/core/save.js';

function fixture() {
  const sim = new Simulation(createProfile(), CAMPAIGN[0]);
  sim.director.update=()=>{}; sim.ai.enemies=()=>{}; sim.ai.companions=()=>{};
  sim.activeHero.x=0; sim.activeHero.z=0;
  return sim;
}
const tick=(sim, input={}, n=1)=>{for(let i=0;i<n;i++)sim.update(1/60,{...EMPTY_INPUT,...input});};

test('all eleven first abilities bind their final oath, including displacement skills', () => {
  const p=createProfile(); p.unlocked=HEROES.map(h=>h.id);
  const mission=CAMPAIGN.at(-1), sim=new Simulation(p,mission,{checkpoint:{stage:3,party:p.party}});
  sim.director.start();
  for(const anchor of sim.director.required) {
    sim.activeHero.x=anchor.x;sim.activeHero.z=anchor.z;
    assert.equal(sim.director.interact(anchor),true,anchor.heroId+' attune');
    assert.equal(sim.abilities.cast(sim.activeHero,0),true,anchor.heroId+' cast');
    assert.equal(anchor.bound,true,anchor.heroId+' must bind from cast origin');
  }
  assert.equal(sim.director.progress,11);
  // Execute the real final sequence timer, rather than granting victory in test code.
  tick(sim,{},300);
  assert.equal(sim.state,'victory');
});

test('an almost-ready ability honors one press; a long cooldown does not auto-fire later',()=>{
  const sim=fixture(),h=sim.activeHero;
  h.cooldowns[1]=.09;tick(sim,{skill2:true});tick(sim,{},8);
  assert.ok(h.cooldowns[1]>1);assert.equal(h.action?.skill,'chain');
  h.cooldowns[1]=2;h.action=null;h.focus=100;tick(sim,{skill2:true});tick(sim,{},140);
  assert.equal(h.cooldowns[1],0);
});

test('attack pressed during recovery is buffered once',()=>{
  const sim=fixture(),h=sim.activeHero;h.attackTimer=.09;
  tick(sim,{attack:true});tick(sim,{},7);
  assert.equal(h.action?.kind,'attack');
  const serial=h.actionSerial;tick(sim,{},60);assert.equal(h.actionSerial,serial);
});

test('dodge recovery chains into attack without preserving the full evade window',()=>{
  const sim=fixture(),h=sim.activeHero;
  tick(sim,{dodge:true,moveX:1});tick(sim,{},14);tick(sim,{attack:true});
  assert.equal(h.dodge,0);assert.equal(h.action?.kind,'attack');assert.ok(h.invulnerable<=.08);
});

test('movement accelerates promptly, brakes without skating, and normalizes diagonals',()=>{
  const a=fixture(),b=fixture();tick(a,{moveX:1},45);tick(b,{moveX:1,moveY:-1},45);
  const d=Math.hypot(a.activeHero.x,a.activeHero.z), dd=Math.hypot(b.activeHero.x,b.activeHero.z);
  assert.ok(d>3 && Math.abs(d-dd)<.015);
  const h=a.activeHero, x=h.x,z=h.z;tick(a,{},15);
  assert.ok(Math.hypot(h.x-x,h.z-z)<.12);assert.equal(h.moving,false);
});

test('switching does not carry buffered abilities or velocity to a different hero',()=>{
  const sim=fixture();sim.activeHero.cooldowns[1]=.10;
  tick(sim,{skill2:true,moveX:1});tick(sim,{switchTo:1});tick(sim,{},15);
  assert.equal(sim.activeIndex,1);assert.equal(sim.activeHero.cooldowns[1],0);
});

test('rooted and frozen heroes cannot drift using residual movement',()=>{
  const sim=fixture();tick(sim,{moveX:1},4);const h=sim.activeHero,x=h.x,z=h.z;
  h.statuses.root=1;tick(sim,{moveX:1},10);assert.equal(h.x,x);assert.equal(h.z,z);
  h.statuses.root=0;h.frozen=1;tick(sim,{moveX:1},10);assert.equal(h.x,x);assert.equal(h.z,z);
});

test('all story checkpoint schemas round-trip and restore a legal active character',()=>{
  const profile=createProfile();
  for(const mission of CAMPAIGN){
    for(let stage=0;stage<mission.stages.length;stage++){
      const sim=new Simulation(profile,mission,{checkpoint:{stage,party:profile.party}});
      profile.checkpoint=sim.director.checkpoint();
      const restored=unpackSave(packSave(profile));
      assert.equal(restored.checkpoint.stage,stage);
      const loaded=new Simulation(restored,mission,{checkpoint:restored.checkpoint});
      assert.ok(loaded.world.isWalkable(loaded.activeHero,loaded.activeHero.radius));
      assert.ok(Number.isFinite(loaded.activeHero.hp));
    }
    finishMission(profile,mission,{time:100,kills:20,rescues:3,reactions:5,damageTaken:0,deaths:0,optional:0});
  }
  assert.equal(profile.ended,true);
});
