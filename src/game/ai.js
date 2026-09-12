import { angleTo, distance, normalize2, angleDelta, moveAngle, clamp } from '../core/math.js';

/** Cheap perception updates; movement and combat timers still run at the fixed timestep. */
export class AI {
  constructor(sim) { this.sim=sim; }
  target(e) {
    const sim=this.sim;
    if(e.tauntTime>0){const t=sim.entity(e.tauntId);if(t&&!t.dead)return t;}
    const pool=sim.targetsFor(e).filter(t=>t.invisible<=0 && t.kind!=='object' || t.damageable && t.team!==e.team);
    let best=null,score=Infinity;
    for(const t of pool){
      let d=distance(e,t);
      if(t.id===sim.activeHero?.id)d-=2;
      if(t.kind==='construct')d-=3.5;
      if((t.kind==='civilian'||t.objectType==='anchor') && e.id%3===0)d-=10;
      if(d<score){score=d;best=t;}
    }
    return best;
  }
  enemies(dt) {
    for(const e of this.sim.enemies){
      e.moving=false;
      if(e.stationary)continue;
      if(e.dead || e.spawnTime>0 || e.stun>0 || e.frozen>0 || e.y>1.3)continue;
      if(e.kind==='boss'){this.sim.bosses.update(e,dt);continue;}
      this.enemy(e,dt);
    }
  }
  enemy(e,dt) {
    const sim=this.sim;
    e.think-=dt;e.tauntTime=Math.max(0,(e.tauntTime||0)-dt);
    if(e.think<=0){e.think=.18+(e.id%5)*.016;const t=this.target(e);e.targetId=t?.id;}
    const t=sim.entity(e.targetId);if(!t || t.dead)return;
    if(e.action)return;
    const d=distance(e,t),angle=angleTo(e,t);
    e.angle=moveAngle(e.angle,angle,dt*7);
    const slow=e.statuses.root>0?0:e.statuses.frost>0?.5:1;
    if(e.style==='priest' && this.priest(e))return;
    if(e.style==='stalker' && d>5 && (e.specialTimer||0)<=0){e.invisible=1.4;e.specialTimer=7;sim.emit('effect',{type:'darkness',x:e.x,z:e.z,radius:2,color:0xb27be0,life:.8});}
    e.specialTimer=Math.max(0,(e.specialTimer||0)-dt);
    if(e.style==='blink' && d>7 && d<22 && (e.specialTimer||0)<=0){
      e.specialTimer=6.5;e.action={kind:'windup',move:'blink',duration:.65,elapsed:0};
      const old={x:e.x,z:e.z},dir=normalize2(e.x-t.x,e.z-t.z),p={x:t.x+dir.x*2.7,z:t.z+dir.z*2.7};
      sim.emit('effect',{type:'sigil',...p,radius:2,color:0xa794ed,life:.65});
      sim.schedule(.5,()=>{if(sim.world.isWalkable(p,e.radius)){e.x=p.x;e.z=p.z;}sim.emit('effect',{type:'bolt',from:{...old,y:1},to:{x:e.x,y:1,z:e.z},color:0xa797ff,width:.05});},e.id);
      return;
    }
    const ranged=['ranged','wisp','priest','guardian'].includes(e.style),desired=ranged?Math.min(e.range*.72,11):e.range*.86;
    if(ranged && d<desired*.55 && slow>0){
      const dir=normalize2(e.x-t.x,e.z-t.z),p={x:e.x+dir.x*3,z:e.z+dir.z*3};e.moving=sim.world.steer(e,p,dt,e.speed*.82*slow);
    }else if(d>desired && slow>0)e.moving=sim.world.steer(e,t,dt,e.speed*slow);
    else if(ranged && e.attackTimer>.8 && slow>0){const side=e.id%2?1:-1;sim.world.move(e,Math.cos(angle)*dt*e.speed*.4*side,-Math.sin(angle)*dt*e.speed*.4*side);e.moving=true;}
    if(d<=e.range+1 && e.attackTimer<=0)this.strike(e,t);
  }
  strike(e,t) {
    const sim=this.sim,angle=angleTo(e,t),windup=e.windup || .7,damage=e.damage*(e.style==='brute'&&e.statuses.fire>0?1.35:1);
    e.angle=angle;e.invisible=0;e.attackTimer=e.attackInterval;e.action={kind:'windup',duration:windup+.32,elapsed:0,move:'attack'};
    const ownerAction=e.action;
    if(['ranged','wisp','priest'].includes(e.style)){
      sim.emit('effect',{type:'aim',from:{x:e.x,z:e.z},to:{x:t.x,z:t.z},color:e.element==='physical'?0xffba94:0xbca0fb,life:windup});
      sim.schedule(windup,()=>{if(e.action!==ownerAction || !sim.combat.available(e))return;sim.projectile(e,{angle,speed:e.style==='ranged'?15:10,range:e.range+8,power:1,element:e.element,apply:true,radius:e.style==='wisp'?.55:.3,visual:e.style==='ranged'?'arrow':'orb'});e.action={kind:'attack',duration:.28,elapsed:0};},e.id);
    }else if(e.style==='guardian'){
      sim.hazard(e,{x:t.x,z:t.z,shape:'circle',radius:3,warn:1.05,damage,element:e.element,visual:e.element==='storm'?'lightning':'burst',apply:true,parryable:false,ownerAction});
    }else{
      sim.hazard(e,{x:e.x,z:e.z,shape:'cone',angle,arc:e.style==='brute'?2.4:1.7,radius:e.range+.6,warn:windup,damage,element:e.element,visual:e.style==='brute'?'impact':'cleave',parryable:true,apply:e.element!=='physical',launch:e.style==='brute',ownerAction});
    }
  }
  priest(e) {
    const sim=this.sim;if(e.attackTimer>0)return false;
    if(e.resurrections<2){
      const corpse=sim.enemies.find(c=>c.dead&&c.kind==='enemy'&&!c.resurrected&&c.deathAge>.65&&c.deathAge<8&&distance(c,e)<15);
      if(corpse){
        e.attackTimer=5;e.action={kind:'ability',duration:1.4,elapsed:0};e.resurrections++;
        sim.emit('label',{text:'RESURRECTION',x:e.x,z:e.z,color:'#d4b4ff'});
        sim.emit('effect',{type:'soul',from:{x:e.x,y:1.5,z:e.z},to:{x:corpse.x,y:1,z:corpse.z},color:0xbb91e3,life:1.1});
        sim.schedule(1.1,()=>{const raised=sim.spawnEnemy(corpse.enemyType,{x:corpse.x,z:corpse.z});if(raised){raised.hp=raised.maxHp*.6;raised.resurrected=true;raised.spawnTime=.45;}corpse.deathAge=20;},e.id);return true;
      }
    }
    const ally=sim.enemies.find(t=>!t.dead&&t.id!==e.id&&t.hp/t.maxHp<.55&&distance(t,e)<13);
    if(ally){e.attackTimer=4.5;e.action={kind:'ability',duration:1,elapsed:0};sim.schedule(.75,()=>{sim.combat.heal(e,ally,ally.maxHp*.18);sim.emit('effect',{type:'soul',from:{x:e.x,y:1.5,z:e.z},to:{x:ally.x,y:1.5,z:ally.z},color:0xbb91e3,life:.6});},e.id);return true;}
    return false;
  }
  companions(dt) {
    const sim=this.sim,leader=sim.activeHero;if(!leader)return;
    for(const e of sim.party){
      if(e.id===leader.id||e.dead)continue;
      if(sim.mission.kind==='training'&&sim.mission.trainingMode==='parry'){e.moving=false;continue;}
      e.moving=false;
      if(e.stun>0||e.frozen>0||e.dodge>0||e.y>1.3)continue;
      if(e.aiGuardTime>0){e.aiGuardTime-=dt;if(e.aiGuardTime<=0)e.blocking=false;}
      const danger=sim.dangerAt(e,.75);
      if(danger && !e.action){
        const dir=normalize2(e.x-danger.x,e.z-danger.z);
        if(e.stamina>35 && danger.warn<.35){sim.combat.dodge(e,dir);continue;}
        const p={x:e.x+dir.x*5,z:e.z+dir.z*5};e.moving=sim.world.steer(e,p,dt,e.speed);continue;
      }
      let enemies=sim.enemies.filter(t=>!t.dead&&distance(t,leader)<27);
      enemies.sort((a,b)=>(distance(e,a)-(a.style==='priest'?5:0))-(distance(e,b)-(b.style==='priest'?5:0)));
      const target=enemies[0];
      if(target && distance(e,leader)<32){
        const d=distance(e,target);e.angle=moveAngle(e.angle,angleTo(e,target),dt*9);
        if(e.action)continue;
        e.aiAbilityTimer=Math.max(0,(e.aiAbilityTimer||0)-dt);
        if(e.aiAbilityTimer<=0 && sim.aiAbilities && this.supportAbility(e,target,enemies.length)){e.aiAbilityTimer=2.6;continue;}
        const reach=Math.min(e.range*.82,10.5);
        if(d>reach)e.moving=sim.world.steer(e,target,dt,e.speed*(e.statuses.frost>0?.55:1));
        else if(e.attackTimer<=0)sim.combat.attack(e,sim.rng()<.24,e.angle);
        if(target.action?.kind==='windup'&&d<4&&sim.rng()<dt*1.5){sim.combat.guard(e,true,true);e.aiGuardTime=.35;}
      }else{
        e.blocking=false;
        const side=e.slot%2===0?1:-1,a=leader.angle;
        const follow={x:leader.x-Math.sin(a)*2.8+Math.cos(a)*side*2,z:leader.z-Math.cos(a)*2.8-Math.sin(a)*side*2};
        const d=distance(e,follow);
        if(d>1.5){e.angle=moveAngle(e.angle,angleTo(e,follow),dt*6);e.moving=sim.world.steer(e,follow,dt,e.speed*(d>9?1.5:1));}
      }
    }
  }
  supportAbility(e,target,count) {
    const sim=this.sim;
    let slot=0;
    if(e.heroId==='mira')slot=sim.party.some(h=>h.hp/h.maxHp<.65)?0:1;
    else if(e.heroId==='brann')slot=count>3&&sim.party.some(h=>h.hp/h.maxHp<.8)?1:0;
    else if(e.heroId==='oren')slot=sim.constructs.some(c=>c.ownerId===e.id&&!c.dead)?0:1;
    else if(e.heroId==='maelin')slot=sim.party.some(h=>h.hp/h.maxHp<.7)?1:0;
    else if(e.heroId==='nym'||e.heroId==='kes')slot=count>2?1:0;
    else if(e.heroId==='sera')slot=distance(e,target)<5?1:0;
    else slot=e.cooldowns[0]<=0?0:1;
    if(e.cooldowns[slot]>0||e.focus<e.definition.skills[slot].cost)return false;
    if(['brann','sera','torren'].includes(e.heroId)&&distance(e,target)>12)return false;
    return sim.abilities.cast(e,slot,target);
  }
  constructs(dt) {
    const sim=this.sim;
    for(const e of sim.constructs){
      if(e.dead)continue;e.life-=dt;if(e.life<=0){e.dead=true;e.deathAge=0;continue;}
      e.shotTimer-=dt;const target=sim.nearestTarget(e,e.range);if(!target)continue;
      e.angle=angleTo(e,target);
      if(e.constructType==='spirit'&&distance(e,target)>4)e.moving=sim.world.steer(e,target,dt,e.speed);
      else e.moving=false;
      if(e.shotTimer<=0){
        e.shotTimer=(e.constructType==='engine'?.65:e.constructType==='spirit'?.8:1)/(1+(sim.relics.constructSpeed||0));
        if(e.constructType==='spirit'&&distance(e,target)<5){sim.combat.arc(e,5,2.5,e.damage,{element:'spirit',apply:true,heavy:false});sim.emit('effect',{type:'slash',x:e.x,z:e.z,radius:4,angle:e.angle,color:0xb8c8ff});e.action={kind:'attack',duration:.45,elapsed:0};}
        else sim.projectile(e,{angle:e.angle,speed:22,range:e.range+3,power:1,element:e.element,apply:true,radius:e.constructType==='engine'?.75:.3,visual:'rune',splash:e.constructType==='engine'?3.5:0});
      }
    }
  }
}
