import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN, EXPEDITIONS, availableMissions, getMission } from '../src/data/campaign.js';
import { createProfile, finishMission, storyCount, nextStory } from '../src/game/progression.js';
import { Simulation, EMPTY_INPUT, containsHazard } from '../src/game/simulation.js';
import { packSave, unpackSave } from '../src/core/save.js';
import { play } from './helpers/pilot.mjs';

function profileAt(chapter,difficulty='story') {
  const profile=createProfile(difficulty);
  for(const mission of CAMPAIGN.slice(0,chapter))finishMission(profile,mission,{time:100});
  return profile;
}

for(const mission of EXPEDITIONS){
  test(`${mission.id}: unlocks at its chapter and preserves main story progression`,()=>{
    assert.equal(availableMissions(profileAt(mission.unlockAt-1)).includes(mission),false);
    const profile=profileAt(mission.unlockAt);
    assert.equal(availableMissions(profile).includes(mission),true);
    const next=nextStory(profile).id;
    finishMission(profile,mission,{time:100});
    const restored=unpackSave(packSave(profile));
    assert.equal(storyCount(restored),mission.unlockAt);
    assert.equal(nextStory(restored).id,next);
    assert.ok(restored.completed.includes(mission.id));
    assert.equal(getMission(mission.id),mission);
  });

  test(`${mission.id}: complete every encounter using production movement and combat`,()=>{
    const profile=profileAt(mission.unlockAt),sim=new Simulation(profile,mission);
    const result=play(sim,600);
    assert.equal(result.state,'victory',JSON.stringify(result));
    assert.equal(result.stages.length,mission.stages.length);
    assert.ok(result.result.kills>0);
    sim.dispose();
  });

  test(`${mission.id}: every encounter checkpoint restores and reaches its beacons`,()=>{
    const profile=profileAt(mission.unlockAt);
    for(let stage=0;stage<mission.stages.length;stage++){
      const sim=new Simulation(profile,mission,{checkpoint:{stage,party:profile.party}});
      profile.checkpoint=sim.director.checkpoint();
      const restored=unpackSave(packSave(profile)),loaded=new Simulation(restored,mission,{checkpoint:restored.checkpoint});
      assert.equal(loaded.director.index,stage);
      assert.ok(loaded.world.isWalkable(loaded.activeHero,loaded.activeHero.radius));
      loaded.director.start();
      for(const beacon of loaded.director.route||[]){
        assert.ok(loaded.world.isWalkable(beacon,.55));
        assert.ok(loaded.world.clearLine(loaded.activeHero,beacon,.55)||loaded.world.path(loaded.activeHero,beacon,.55).length>1);
      }
      sim.dispose();loaded.dispose();
    }
  });
}

test('stormwall warnings become moving damage zones and end at the checkpoint',()=>{
  const sim=new Simulation(profileAt(4),getMission('x01'));
  sim.director.start();sim.director.updateStormwalls(4.1);
  const wall=sim.hazards.find(h=>h.visual==='stormwall'),x=wall.x;
  assert.equal(wall.warn,1.8);assert.equal(wall.active,false);
  for(let i=0;i<180;i++)sim.updateHazards(1/60);
  assert.ok(wall.x<x-3,'the warning must sweep across the arena after activating');
  assert.equal(wall.active,true);
  sim.director.finishStage();assert.equal(sim.hazards.length,0);
  sim.dispose();
});

test('lava consumes the escape route monotonically and a missed escape is a defeat',()=>{
  const sim=new Simulation(profileAt(12),getMission('x02'),{checkpoint:{stage:2,party:['rael','sera','brann']}});
  sim.director.start();const d=sim.director,h=d.lava;
  const firstFront=h.z-h.length/2;
  d.clock=20;d.update_escape(0);
  assert.ok(h.z-h.length/2<firstFront-15);
  assert.equal(containsHazard(h,{x:d.room.x,z:d.room.z+27,radius:.55}),true);
  assert.equal(containsHazard(h,d.route[3]),false,'last beacon remains ahead of the front');
  d.clock=d.timeLimit;d.update_escape(0);
  assert.equal(sim.state,'defeated');
  sim.dispose();
});
