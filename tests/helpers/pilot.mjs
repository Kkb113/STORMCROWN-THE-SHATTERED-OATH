/** Deterministic QA pilot. Supplies player commands to the production simulation.
 * It never kills enemies, completes stages, teleports, changes stats, or grants rewards.
 * This is an automated mechanics/route check, not a substitute for human playtesting.
 */
import { EMPTY_INPUT } from '../../src/game/simulation.js';
import { distance, normalize2, angleTo, TAU } from '../../src/core/math.js';
export class Pilot {
  constructor(sim) {
    this.sim=sim; this.route=[]; this.repath=0; this.lastGoal=null; this.lastStage=-1;
    this.last={x:sim.activeHero.x,z:sim.activeHero.z};this.stuck=0;
    sim.on('dialogue',e=>e.after?.());
    sim.on('choice',e=>{const o=e.options.find(o=>!o.locked);if(o)e.choose(o.id);});
    sim.on('boon',e=>e.choose('shelter'));
  }
  input(dt=1/60) {
    const s=this.sim,d=s.director,h=s.activeHero,out={...EMPTY_INPUT};
    this.repath-=dt;
    if(d.index!==this.lastStage){this.route=[];this.lastStage=d.index;this.repath=0;}
    const enemies=s.targetsFor(h).filter(e=>e.spawnTime<=0);
    enemies.sort((a,b)=>(distance(h,a)-(a.style==='priest'?6:0))-(distance(h,b)-(b.style==='priest'?6:0)));
    const enemy=enemies[0];let goal=null,stop=1.3;
    if(!d.started)goal=d.room;
    else if(d.stage.type==='anchors') {
      const anchor=d.required.find(o=>!o.used);
      goal=anchor;
      if(anchor&&distance(h,anchor)<2.5){out.interact=true;if(d.attuned===anchor.id)out.skill1=true;}
    } else if(d.stage.type==='escape') {goal=d.route[d.progress];stop=2;}
    else if(enemy) {goal=enemy;stop=Math.min(h.range*.6,8);}
    else if(d.stage.type==='rescue') {
      const cage=d.required.find(o=>!o.used);
      if(cage){goal=cage;out.interact=distance(h,cage)<2.7;}
      else {const c=s.civilians.filter(c=>c.stage===d.index&&!c.safe&&!c.dead).sort((a,b)=>distance(b,d.exitPoint)-distance(a,d.exitPoint))[0];goal=c&&distance(c,h)>8?c:d.exitPoint;}
    } else if(d.stage.type==='escort') {goal=d.transport;stop=3;out.interact=h.focus>=40&&d.transport.hp/d.transport.maxHp<.8;}
    else if(d.stage.type==='defend') {goal=d.anchor;stop=4;}
    else if(d.stage.type==='relay') {goal=d.required.find(o=>o.seal===d.sequence[d.sequenceProgress]);out.interact=!!goal&&distance(h,goal)<2.7;}
    else if(['collect','sabotage','oath','choice'].includes(d.stage.type)) {goal=d.required.find(o=>!o.used&&!o.dead);out.interact=!!goal&&distance(h,goal)<2.7;}
    if(enemy&&(!goal||!['escape','anchors'].includes(d.stage?.type))) {
      out.aim=enemy;
      out.attack=distance(h,enemy)<h.range+1;
      out.heavy=distance(h,enemy)<h.range+1&&s.tick%90<24;
      out.skill1=h.cooldowns[0]<=0&&h.focus>28&&distance(h,enemy)<11;
      out.skill2=h.cooldowns[1]<=0&&h.focus>40&&distance(h,enemy)<12;
      out.ultimate=h.judgment>=100&&distance(h,enemy)<12&&(enemies.length>=3||enemy.kind==='boss');
      out.remedy=h.hp/h.maxHp<.5||s.party.some(e=>e.dead);
    }
    const danger=s.dangerAt(h,.3);
    if(danger&&!(danger.absorb&&h.heroId==='rael')&&h.invulnerable<=0) {
      let best=null,bestScore=-Infinity;
      for(let i=0;i<16;i++){
        const angle=i*TAU/16,p={x:h.x+Math.sin(angle)*6,z:h.z+Math.cos(angle)*6};
        if(!s.world.isWalkable(p,h.radius)||!s.world.clearLine(h,p,h.radius))continue;
        const safe=!s.dangerAt(p,.6),score=(safe?100:0)+distance(p,danger)-(goal?distance(p,goal)*.1:0);
        if(score>bestScore){bestScore=score;best=p;}
      }
      if(best){goal=best;stop=.2;this.route=[];this.repath=0;out.dodge=h.stamina>=24;}
    }
    if(goal&&distance(h,goal)>stop){
      if(this.repath<=0||!this.lastGoal||distance(goal,this.lastGoal)>3){this.route=s.world.path(h,goal);this.lastGoal={x:goal.x,z:goal.z};this.repath=.4;}
      while(this.route.length>1&&distance(h,this.route[0])<1.5)this.route.shift();
      const waypoint=s.world.clearLine(h,goal,h.radius)?goal:(this.route[0]||goal);
      const direction=normalize2(waypoint.x-h.x,waypoint.z-h.z);
      let a=Math.atan2(direction.x,direction.z),score=Infinity;
      for(const off of [0,.4,-.4,.8,-.8,1.3,-1.3,1.9,-1.9,2.5,-2.5]){
        const p={x:h.x+Math.sin(a+off)*1.8,z:h.z+Math.cos(a+off)*1.8};
        if(s.world.isWalkable(p,h.radius)&&distance(p,waypoint)<score){score=distance(p,waypoint);direction.x=Math.sin(a+off);direction.z=Math.cos(a+off);}
      }
      out.moveX=direction.x*Math.cos(.64)-direction.z*Math.sin(.64);
      out.moveY=direction.x*Math.sin(.64)+direction.z*Math.cos(.64);
      if(!enemy&&!danger&&s.tick%50===0)out.dodge=true;
    }
    return out;
  }
}
export function play(sim,maxSeconds=1800){
  const pilot=new Pilot(sim);let result=null,reason=null;const stages=[];
  sim.on('stage',e=>stages.push({index:e.index,type:e.stage.type,time:sim.elapsed}));
  sim.on('missionComplete',e=>result=e.result);sim.on('defeat',e=>reason=e.reason);
  for(let i=0;i<maxSeconds*60&&sim.state==='running';i++)sim.update(1/60,pilot.input());
  return {state:sim.state,result,reason,time:sim.elapsed,stage:sim.director.index,type:sim.director.stage?.type,
    progress:sim.director.progress,remaining:sim.director.liveEnemies.length,stages,
    position:{x:sim.activeHero.x,z:sim.activeHero.z},hp:sim.party.map(h=>Math.round(h.hp))};
}
