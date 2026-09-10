import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldMap} from '../src/game/world.js';
import {getMission,CAMPAIGN} from '../src/data/campaign.js';
import {random} from '../src/core/math.js';
for(const [id,from,index]of [['w02',{x:-44.47110616395725,z:-47.093943518968494},2],['c02',{x:11.104581724044268,z:-14.086925728220645},1]])test(`${id}: bridge-corner route respects swept clearance`,()=>{
  const w=new WorldMap(getMission(id)),goal=w.rooms[index],h={...from,radius:.55,speed:7};
  for(let i=0;i<1500&&Math.hypot(h.x-goal.x,h.z-goal.z)>1;i++)w.steer(h,goal,1/60);
  assert.ok(Math.hypot(h.x-goal.x,h.z-goal.z)<1,JSON.stringify(h));assert.ok(w.isWalkable(h,h.radius));
});

test('analytic clearance never crosses off-platform slivers or pillar interiors',()=>{
  const rng=random(62843);
  for(const mission of CAMPAIGN.filter((m,i)=>i%8===1)){
    const w=new WorldMap(mission);
    for(let i=0;i<50;i++){
      const a=w.point(i%w.rooms.length,rng()*Math.PI*2,rng()*.9,.55),b=w.point((i+1)%w.rooms.length,rng()*Math.PI*2,rng()*.9,.55);
      if(!w.clearLine(a,b,.55))continue;
      for(let j=0;j<=1000;j++)assert.ok(w.isWalkable({x:a.x+(b.x-a.x)*j/1000,z:a.z+(b.z-a.z)*j/1000},.55));
    }
  }
});
