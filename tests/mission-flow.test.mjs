import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldMap,hubMap} from '../src/game/world.js';
import {Simulation} from '../src/game/simulation.js';
import {getMission,trialMission} from '../src/data/campaign.js';
import {createProfile} from '../src/game/progression.js';
import {packSave,unpackSave} from '../src/core/save.js';

test('descending bridges meet each platform without a vertical step',()=>{
  const world=new WorldMap(getMission('c06'));
  for(const bridge of world.bridges.filter(b=>b.a.y!==b.b.y)){
    let previous=bridge.a.y;
    for(let i=0;i<=1000;i++){
      const t=i/1000,p={x:bridge.a.x+(bridge.b.x-bridge.a.x)*t,z:bridge.a.z+(bridge.b.z-bridge.a.z)*t};
      const y=world.heightAt(p);
      assert.ok(y<=previous+1e-7,'a descending bridge cannot climb at a platform edge');
      assert.ok(Math.abs(y-previous)<.04,`height discontinuity on bridge ${bridge.id}: ${previous} -> ${y}`);
      previous=y;
    }
    assert.equal(previous,bridge.b.y);
  }
});

test('Warden deck blocks its visible masts and excludes water outside the bow',()=>{
  const world=hubMap();
  for(const z of [-7,13])assert.equal(world.isWalkable({x:0,z}),false);
  for(const z of [6,-15])assert.equal(world.isWalkable({x:0,z}),true,'old phantom mast position');
  assert.equal(world.isWalkable({x:8,z:-28}),false,'outside the tapering bow');
  assert.equal(world.isWalkable({x:0,z:-30}),true);
  assert.equal(world.clearLine({x:8,z:-28},{x:0,z:-20}),false);
  const actor={x:-4,z:8,radius:.55,speed:7},goal={x:4,z:17};
  for(let i=0;i<600&&Math.hypot(actor.x-goal.x,actor.z-goal.z)>.8;i++)world.steer(actor,goal,1/60);
  assert.ok(Math.hypot(actor.x-goal.x,actor.z-goal.z)<.8,'crew can route around the visible mast');
});

test('an encounter starts once and cannot award victory after defeat',()=>{
  const sim=new Simulation(createProfile('story'),getMission('s01'));
  sim.director.start();const count=sim.enemies.length;
  sim.director.start();assert.equal(sim.enemies.length,count);
  let completed=false;sim.on('missionComplete',()=>{completed=true;});
  sim.fail('fixture defeat');
  const index=sim.director.index;
  sim.director.finishStage();sim.director.update(1/60);
  assert.equal(sim.state,'defeated');assert.equal(sim.director.index,index);assert.equal(completed,false);
  sim.dispose();
});

test('optional discoveries are secured without snapshotting partial combat rewards',()=>{
  const profile=createProfile('story'),mission=getMission('s01'),sim=new Simulation(profile,mission);
  sim.on('checkpoint',({checkpoint})=>{profile.checkpoint=checkpoint;});
  sim.director.start();sim.stats.kills=3;
  const memory=sim.objects.find(o=>o.optional&&o.objectType==='memory');
  Object.assign(sim.activeHero,{x:memory.x,z:memory.z});
  assert.equal(sim.director.interact(memory),true);
  assert.equal(profile.checkpoint.stats.kills,0,'the encounter still restarts at its boundary');
  assert.equal(profile.checkpoint.stats.optional,1);
  const restored=unpackSave(packSave(profile));
  const resumed=new Simulation(restored,mission,{checkpoint:restored.checkpoint});
  assert.equal(resumed.stats.optional,1);
  assert.equal(resumed.objects.find(o=>o.key===memory.key).used,true);
  assert.equal(resumed.director.interact(resumed.objects.find(o=>o.key===memory.key)),false);
  sim.dispose();resumed.dispose();
});

test('replaying a cathedral decision does not repeat its one-time shard grant',()=>{
  const profile=createProfile('story'),mission={...getMission('w08'),stages:[{type:'choice',title:'The City Beneath the Ice',param:'cathedral'}]};
  const start=profile.shards;
  for(let i=0;i<2;i++){
    const sim=new Simulation(profile,mission);sim.director.start();
    const decision=sim.director.required[0];Object.assign(sim.activeHero,{x:decision.x,z:decision.z});
    assert.ok(sim.director.interact(decision));assert.ok(sim.director.choose('take'));
    assert.equal(profile.shards,start+12);sim.dispose();
  }
});

test('mission lookup rejects invalid trial tiers and inherited object properties',()=>{
  for(const id of ['trial-0','trial-01','trial-1002','trial-'+ '9'.repeat(400),'toString','constructor','__proto__'])assert.equal(getMission(id),null,id);
  assert.equal(getMission('trial-1001').tier,1001);
  for(const tier of [Infinity,NaN,-2,1.6,999999]){
    const mission=trialMission(tier);
    assert.ok(Number.isInteger(mission.region)&&mission.region>=0&&mission.region<5);
    assert.ok(Number.isFinite(mission.level));
  }
});
