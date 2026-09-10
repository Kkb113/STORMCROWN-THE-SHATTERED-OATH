import { angleTo, angleDelta, distance, normalize2, clamp, segmentDistanceSq, TAU } from '../core/math.js';
import { ELEMENTS, HERO_BY_ID } from '../data/heroes.js';
import { DIFFICULTY } from '../core/config.js';

const ELEMENT_HEX = element => ELEMENTS[element]?.hex || 0xd2cedd;
export class Combat {
  constructor(sim) { this.sim=sim; }
  available(e) { return !e.dead && e.stun<=0 && e.frozen<=0 && e.dodge<=0 && !e.buffs.timeStopped; }
  beginAction(e,kind,duration,extra={}) {
    e.actionSerial=(e.actionSerial||0)+1;e.action={kind,duration,elapsed:0,serial:e.actionSerial,...extra}; e.attackTimer=Math.max(e.attackTimer,duration); e.blocking=false;
  }
  attack(e,heavy=false,aim=null) {
    if (!this.available(e) || e.attackTimer>0 || (e.action && e.action.elapsed<e.action.duration*.65)) return false;
    const sim=this.sim, h=e.definition, ranged=e.range>7;
    if (Number.isFinite(aim)) e.angle=aim;
    const speed=e.stats?.attackSpeed || 1, large=e.weapon==='hammer';
    const base=heavy?(large?1.08:.78):(large?.7:ranged?.5:.43);
    const combo=e.comboTime>0?(e.combo+1)%3:0;
    e.combo=combo; e.comboTime=1.3; e.streak=clamp(e.streak+1,0,10);
    const duration=base/speed, power=heavy?(large?2.65:2.15):[1,1.06,1.33][combo];
    this.beginAction(e,heavy?'heavy':'attack',duration,{combo});
    const serial=e.actionSerial;
    if (heavy) {e.stamina=Math.max(0,e.stamina-8);}
    sim.emit('audio',{type:heavy?'heavySwing':'swing',x:e.x,z:e.z,element:e.element});
    sim.schedule(duration*(ranged?.32:.4),() => {
      if (e.dead || e.stun>0 || e.frozen>0 || e.actionSerial!==serial) return;
      let p=power;
      if (e.heroId==='brann' && heavy) {p*=1+e.resource*.28;e.resource=0;}
      if (e.buffs.beast) p*=1.5;
      const apply=heavy || combo===2 || e.rank>=1;
      let element=e.element;
      if (e.heroId==='lucen' && (combo===1 || e.buffs.dualStorm)) {element='void';delete e.buffs.dualStorm;}
      if (ranged) {
        const count=heavy && e.weapon!=='ritual'?3:1;
        for (let i=0;i<count;i++) sim.projectile(e,{angle:e.angle+(i-(count-1)/2)*.12,speed:e.weapon==='bow'?33:24,range:e.range+3,power:p/(count===3?1.6:1),element,apply,pierce:heavy?3:0,radius:heavy?.58:.34,heavy,visual:e.weapon==='bow'?'arrow':'orb'});
        if (heavy && e.heroId==='nym') this.area(e,e,5,e.damage*.8,{element:'frost',apply:true,heavy:true});
      } else {
        const range=e.range+(heavy?1:.15)+(e.buffs.beast?2:0),arc=heavy?2.5:2.1;
        this.arc(e,range,arc,e.damage*p,{element,apply,heavy,launch:heavy || combo===2&&e.heroId==='rael',stagger:heavy?55:18});
        sim.emit('effect',{type:'slash',x:e.x,z:e.z,y:e.y+1,angle:e.angle,radius:range,color:ELEMENT_HEX(element),heavy,combo});
        if (e.heroId==='oren' && heavy) for (const mine of sim.zones.filter(z=>z.kind==='mine'&&z.ownerId===e.id&&distance(z,e)<8)) mine.trigger=true;
      }
    },e.id);
    return true;
  }
  dodge(e,direction) {
    if (!this.available(e) || e.stamina<22*(1+(this.sim.relics.dodgeCost||0))) return false;
    if (e.action?.kind==='ultimate') return false;
    const dir=Math.hypot(direction.x,direction.z)>.05?normalize2(direction.x,direction.z):{x:Math.sin(e.angle),z:Math.cos(e.angle)};
    e.actionSerial=(e.actionSerial||0)+1;e.dodge=.34; e.invulnerable=Math.max(e.invulnerable,.39);e.dodgeX=dir.x;e.dodgeZ=dir.z;
    e.stamina-=22*(1+(this.sim.relics.dodgeCost||0));e.action={kind:'dodge',duration:.34,elapsed:0};e.attackTimer=.22;e.blocking=false;
    this.sim.emit('effect',{type:'dash',from:{x:e.x,z:e.z},to:{x:e.x+dir.x*5,z:e.z+dir.z*5},color:ELEMENT_HEX(e.element)});
    this.sim.emit('audio',{type:'dodge',x:e.x,z:e.z});
    return true;
  }
  guard(e,pressed,held) {
    if (!this.available(e) || e.action?.kind==='ultimate') {e.blocking=false;return;}
    if (pressed && e.stamina>=8) {e.actionSerial=(e.actionSerial||0)+1;e.parry=e.stats?.parryWindow || .2;e.action=null;e.attackTimer=Math.min(e.attackTimer,.08);e.blockAge=0;}
    e.blocking=held && e.stamina>2;
    if (!held) e.blockAge=0;
  }
  arc(source,range,arc,amount,options={}) {
    let hits=0;
    for (const target of this.sim.targetsFor(source)) {
      if (distance(source,target)>range+target.radius) continue;
      if (Math.abs(angleDelta(source.angle,angleTo(source,target)))>arc*.5) continue;
      if (this.damage(source,target,amount,options)>0) hits++;
    }
    return hits;
  }
  area(source,point,radius,amount,options={}) {
    let hits=0;
    for (const target of [...this.sim.targetsFor(source)]) if (distance(point,target)<=radius+target.radius && this.damage(source,target,amount,options)>0) hits++;
    return hits;
  }
  line(source,from,to,width,amount,options={}) {
    let hits=0;
    for (const target of [...this.sim.targetsFor(source)]) if (segmentDistanceSq(target,from,to)<(width*.5+target.radius)**2 && this.damage(source,target,amount,options)>0) hits++;
    return hits;
  }
  damage(source,target,amount,options={}) {
    const sim=this.sim;
    if (!target || target.dead || !Number.isFinite(amount) || amount<=0 || target.invulnerable>0 || target.spawnTime>0) return 0;
    if (source && source.team===target.team && !options.friendlyFire) return 0;
    const element=options.element || source?.element || 'physical';
    const hostile=target.team==='party' || target.team==='friendly';
    // Blue storm telegraphs have an intentional, learnable absorption counterplay.
    if (options.absorb && target.heroId==='rael') { this.absorb(target); return 0; }
    let damage=amount, critical=!!options.critical;
    const front=source?Math.abs(angleDelta(target.angle,angleTo(target,source)))<Math.PI*.58:true;
    if (target.blocking && front && !options.unblockable && !options.dot) {
      if (target.parry>0 && options.parryable!==false) {
        target.parry=0;target.stamina=clamp(target.stamina+25,0,100);target.focus=clamp(target.focus+22,0,target.maxFocus);target.judgment=clamp(target.judgment+18,0,100);
        if (source && source.kind!=='object') {source.stun=Math.max(source.stun,source.kind==='boss'?.75:2.1);source.action=null;source.stagger=0;}
        if (target.heroId==='brann') target.resource=Math.min(3,target.resource+1);
        if (target.heroId==='lucen') target.cooldowns[0]=0;
        if (target.heroId==='mira') target.resource=Math.min(100,target.resource+30);
        if (sim.relics.parryHeal) for (const ally of sim.alliesFor(target)) this.heal(target,ally,ally.maxHp*sim.relics.parryHeal);
        if (sim.relics.parryVoid && source) sim.schedule(.08,()=>this.damage(target,source,target.damage*1.8,{element:'void',apply:true}),target.id);
        sim.unity=clamp(sim.unity+7,0,100);sim.stats.parries++;
        sim.emit('effect',{type:'parry',x:target.x,z:target.z,color:0xffe2a3});
        sim.emit('label',{text:'PERFECT PARRY',x:target.x,z:target.z,color:'#ffe7a2',large:true});
        sim.emit('audio',{type:'parry',x:target.x,z:target.z});sim.hitStop=.035;sim.emit('shake',{amount:.24});
        return 0;
      }
      if (!sim.relics.freeBlock) target.stamina=Math.max(0,target.stamina-15);
      damage*=.24;
      if (target.heroId==='mira') target.resource=clamp(target.resource+damage*.12,0,100);
      sim.emit('audio',{type:'block',x:target.x,z:target.z});
    }
    if (target.style==='shield' && front && !options.dot) {
      damage*=options.heavy?.7:.25;
      if (options.heavy) {target.shieldHits++;if(target.shieldHits>=2){target.style='melee';target.stun=2;sim.emit('label',{text:'GUARD BROKEN',x:target.x,z:target.z,color:'#ead4a2'});sim.emit('effect',{type:'break',x:target.x,z:target.z,color:0xe4ca94});}}
    }
    if (target.buffs.counter && source && distance(source,target)<5 && !options.heavy && !options.dot) {
      damage*=.2;sim.schedule(.22,()=>this.damage(target,source,target.damage*1.4,{element:target.element,parryable:true}),target.id);
      sim.emit('label',{text:'COUNTER',x:target.x,z:target.z,color:'#c7b4ff'});
    }
    if (source?.heroId && !options.dot) {
      const stats=source.stats || {};
      if (source.heroId==='rael') damage*=1+source.streak*.022;
      if (source.heroId==='sera') damage*=1+.55*(1-source.hp/source.maxHp);
      if (source.heroId==='vex' && !front) {damage*=1.65;critical=true;}
      if (source.heroId==='kes' && (target.y>1 || target.action?.kind==='windup')) {damage*=1.45;critical=true;}
      if (!front && sim.relics.backstab) {damage*=1+sim.relics.backstab;source.focus=clamp(source.focus+(sim.relics.backFocus||0),0,source.maxFocus);}
      if (sim.rng()<(stats.crit||0)) critical=true;
      if (target.hp/target.maxHp<.22) damage*=1+(stats.execute||0);
      if (source.buffs.empowered) damage*=1.2;
      if (source.team==='party' && source.id!==sim.activeHero?.id) damage*=.72;
      if (sim.rescueBonus && source.team==='party') damage*=1+sim.rescueBonus;
      if (critical) damage*=1.55;
    }
    if (sim.modifier==='glass') damage*=1.35;
    damage*=1-clamp(target.armor+(target.buffs.bulwark?.2:0),0,.72);
    if (target.buffs.weakened) damage*=1.1;
    if (target.buffs.protected) damage*=.75;
    if (target.shield>0) {const absorbed=Math.min(target.shield,damage);target.shield-=absorbed;damage-=absorbed;sim.emit('effect',{type:'shieldHit',x:target.x,z:target.z,color:0x9ebdff});}
    damage=Math.max(0,Math.round(damage));
    if (!damage) return 0;
    if (damage>=target.hp && target.team==='party' && sim.relics.lastStand && !target.lastStandUsed) {
      target.hp=Math.round(target.maxHp*.2);target.lastStandUsed=true;target.invulnerable=2.5;
      sim.emit('label',{text:'AN EMBER UNSPENT',x:target.x,z:target.z,color:'#ffd69c',large:true});
      sim.emit('effect',{type:'burst',x:target.x,z:target.z,radius:4,color:0xffa459});return 0;
    }
    target.hp=Math.max(this.sim.mission.kind==='training'&&target.team==='party'?1:0,target.hp-damage);target.hitFlash=.12;
    if (hostile) {sim.stats.damageTaken+=damage;target.streak=0;if(target.id===sim.activeHero?.id)sim.emit('hurt',{amount:damage/target.maxHp});}
    if (source) {
      source.damageDealt+=damage;
      if (source.team==='party' && !options.dot) {source.judgment=clamp(source.judgment+Math.min(7,damage/(source.damage||40)*2.1),0,100);source.focus=clamp(source.focus+3,0,source.maxFocus);sim.unity=clamp(sim.unity+1.1,0,100);}
      if (source.heroId==='sera' && target.statuses.fire>0 && !options.dot) this.heal(source,source,Math.min(source.maxHp*.012,damage*.12));
      if (source.heroId==='torren' && !options.dot) source.resource=clamp(source.resource+7,0,100);
    }
    const stagger=(options.stagger || (options.heavy?50:14))*(1+(source?.team==='party'?(sim.relics.stagger||0):0));
    if (!options.dot && target.kind!=='object') {
      target.stagger+=stagger;
      const threshold=target.kind==='boss'?220:target.style==='brute'?110:65;
      if (target.stagger>=threshold) {target.stun=target.kind==='boss'?.65:1.1;target.stagger=0;target.action=null;sim.emit('label',{text:target.kind==='boss'?'STAGGERED':'',x:target.x,z:target.z,color:'#e5d0ab'});}
      if (options.launch && target.kind!=='boss') {
        target.vy=Math.max(target.vy,7+Math.min(4,damage/(target.maxHp||1)*8));target.stun=Math.max(target.stun,.7);target.airborne=.9;
        if (source?.team==='party') source.stamina=clamp(source.stamina+(sim.relics.launchStamina||0),0,100);
      }
      if (source && (options.heavy || target.stun>0)) {const dir=normalize2(target.x-source.x,target.z-source.z),force=target.kind==='boss'?1.2:options.launch?9:4;target.vx=dir.x*force;target.vz=dir.z*force;}
    }
    sim.emit('damage',{targetId:target.id,x:target.x,z:target.z,y:target.y+1.5,amount:damage,critical,element,hostile,dot:!!options.dot});
    if (!options.dot) {
      sim.emit('effect',{type:'hit',x:target.x,z:target.z,y:target.y+1,color:ELEMENT_HEX(element),heavy:options.heavy});
      sim.emit('audio',{type:critical?'critical':'hit',x:target.x,z:target.z,element});
      if (options.heavy && source?.id===sim.activeHero?.id) {sim.hitStop=Math.max(sim.hitStop,.028);sim.emit('shake',{amount:.11});}
    }
    if (target.hp<=0) this.kill(source,target,options);
    else if (options.apply && !options.noReaction) this.applyElement(source,target,element,damage,options);
    return damage;
  }
  applyElement(source,target,element,damage,options={}) {
    const sim=this.sim,s=target.statuses;
    if ((element==='earth' || options.heavy && ['physical','frost'].includes(element)) && target.frozen>0 && (s.reaction||0)<=0) {
      target.frozen=0;s.frostStacks=0;s.reaction=1.2;
      const power=damage*1.45*(1+(sim.relics.shatter||0));
      this.reaction(source,target,'SHATTER','frost',power,4.5);
    } else if (element==='storm' && s.wet>0 && (s.reaction||0)<=0) {
      s.reaction=1.3;
      const targets=sim.targetsFor(source).filter(e=>e.id!==target.id&&distance(e,target)<9&&e.statuses.wet>0).slice(0,5);
      for (const e of targets) {e.statuses.reaction=1.3;this.damage(source,e,damage*.52,{element:'storm',noReaction:true});sim.emit('effect',{type:'bolt',from:{x:target.x,y:target.y+1.1,z:target.z},to:{x:e.x,y:e.y+1,z:e.z},color:ELEMENT_HEX('storm'),width:.045});}
      if (targets.length) this.reactionLabel(source,target,'CHAIN SURGE','storm');
    } else if ((element==='light' && (s.void>0||s.shadow>0||s.spirit>0)) || (['void','shadow','spirit'].includes(element) && s.light>0)) {
      if ((s.reaction||0)<=0) {s.reaction=1.8;s.void=0;s.light=0;s.spirit=0;this.reaction(source,target,'ECLIPSE','void',damage*1.7,5.5);}
    } else if ((element==='fire' && s.wind>0) || (element==='wind' && s.fire>0)) {
      if ((s.reaction||0)<=0) {
        s.reaction=2;this.reactionLabel(source,target,'FIRESTORM','fire');
        sim.zone(source,{kind:'firestorm',x:target.x,z:target.z,radius:4.5,life:4.5,interval:.65,power:.5,element:'fire',pull:3});
        for (const z of sim.zones) if (z.kind==='cyclone'&&distance(z,target)<z.radius) {z.element='fire';z.ignited=true;z.power*=1.3;}
      }
    }
    if (element==='frost') {
      s.frost=5;s.frostStacks=(s.frostStacks||0)+1;
      if (s.frostStacks>=2 || options.freeze) {target.frozen=target.kind==='boss'?.55:2.5+(sim.relics.freezeTime||0);s.frostStacks=0;sim.emit('effect',{type:'freeze',x:target.x,z:target.z,color:ELEMENT_HEX('frost'),scale:target.scale});}
    } else if (element==='fire') {s.fire=4.5;s.burnSource=source?.id;s.burnPower=(source?.damage||damage)*.16;}
    else if (element==='nature') s.root=options.root?2.5:.65;
    else if (['void','shadow','spirit','light','wind'].includes(element)) s[element]=6;
  }
  reaction(source,target,name,element,power,radius) {
    power*=1+(this.sim.relics.reactionDamage||0);
    if(this.sim.modifier==='reactions')power*=2;
    this.area(source,target,radius,power,{element,noReaction:true,heavy:true,launch:true});
    this.sim.emit('effect',{type:name==='SHATTER'?'shatter':'implosion',x:target.x,z:target.z,radius,color:ELEMENT_HEX(element)});
    this.reactionLabel(source,target,name,element);
  }
  reactionLabel(source,target,name,element) {
    const sim=this.sim;sim.stats.reactions++;sim.unity=clamp(sim.unity+6,0,100);
    if(source)source.judgment=clamp(source.judgment+5+(sim.relics.reactionCharge||0),0,100);
    sim.emit('label',{text:name,x:target.x,z:target.z,color:ELEMENTS[element]?.color,large:true});
    sim.emit('audio',{type:'reaction',x:target.x,z:target.z,element});
    sim.emit('shake',{amount:.22});
  }
  absorb(e) {
    e.focus=clamp(e.focus+35,0,e.maxFocus);e.judgment=clamp(e.judgment+18,0,100);e.stamina=clamp(e.stamina+20,0,100);
    if (this.sim.relics.absorbHeal) this.heal(e,e,e.maxHp*this.sim.relics.absorbHeal);
    this.sim.emit('label',{text:'STORM ABSORBED',x:e.x,z:e.z,color:'#cdc1ff',large:true});
    this.sim.emit('effect',{type:'absorb',x:e.x,z:e.z,radius:4,color:ELEMENT_HEX('storm')});
    this.sim.emit('audio',{type:'absorb',x:e.x,z:e.z});
  }
  heal(source,target,amount) {
    if (!target || target.dead) return 0;
    amount*=1+(source?.team==='party'?(this.sim.relics.healing||0):0);
    const healed=Math.min(target.maxHp-target.hp,Math.round(amount));target.hp+=healed;
    if (healed>1) this.sim.emit('heal',{x:target.x,z:target.z,amount:healed,targetId:target.id});
    return healed;
  }
  kill(source,target,options={}) {
    if(target.dead)return;
    const sim=this.sim;target.dead=true;target.hp=0;target.deathAge=0;target.blocking=false;target.action=null;target.frozen=0;
    if(target.kind==='object'){sim.emit('objectDestroyed',{object:target});sim.emit('effect',{type:'break',x:target.x,z:target.z,color:target.color,radius:2});return;}
    if(target.team==='party'){
      sim.emit('heroDown',{hero:target});sim.emit('audio',{type:'down',x:target.x,z:target.z});return;
    }
    if(target.kind==='civilian'){sim.emit('civilianDown',{entity:target});return;}
    target.vy=Math.max(target.vy,options.launch?8:3.5);
    if(source){const d=normalize2(target.x-source.x,target.z-source.z);target.vx=d.x*(options.heavy?10:4);target.vz=d.z*(options.heavy?10:4);source.kills++;source.judgment=clamp(source.judgment+5,0,100);}
    if(target.team==='hostile') {
      sim.stats.kills++;sim.unity=clamp(sim.unity+2,0,100);
      if(!target.resurrected && target.kind!=='boss') sim.pickups.push({id:sim.nextEffectId++,kind:sim.rng()<.22?'health':'focus',x:target.x,z:target.z,age:0,life:25,value:sim.rng()<.15?14:7});
      for (const h of sim.party) {
        if(h.heroId==='maelin'&&!h.dead){h.focus=clamp(h.focus+5,0,h.maxFocus);h.resource=clamp(h.resource+1,0,10);}
      }
      if(sim.relics.deathHeal){const ally=sim.party.filter(h=>!h.dead).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally)this.heal(source,ally,ally.maxHp*sim.relics.deathHeal);}
    }
    sim.emit('enemyDown',{enemy:target,source});
    sim.emit('effect',{type:target.kind==='boss'?'bossDeath':'death',x:target.x,z:target.z,color:ELEMENT_HEX(target.element),radius:target.kind==='boss'?8:1});
    if(target.kind==='boss'){sim.emit('shake',{amount:.75});sim.emit('audio',{type:'bossDeath',x:target.x,z:target.z});}
  }
  remedy() {
    const sim=this.sim,e=sim.activeHero;
    if(!e || e.dead || sim.remedies<=0)return false;
    if(e.hp>=e.maxHp && sim.party.every(h=>!h.dead&&h.hp>=h.maxHp*.9)) {sim.emit('toast',{text:'The crew is already at full strength.'});return false;}
    sim.remedies--;
    for(const hero of sim.party){
      if(hero.dead){hero.dead=false;hero.hp=hero.maxHp*.3;hero.invulnerable=2;hero.x=e.x+(hero.slot-1)*2;hero.z=e.z+1;hero.deathAge=0;}
      else this.heal(e,hero,hero.maxHp*(hero.id===e.id?.48:.22));
      if(sim.relics.remedyShield)hero.buffs.protected=sim.relics.remedyShield;
    }
    sim.emit('effect',{type:'heal',x:e.x,z:e.z,radius:6,color:0x80e5ad});sim.emit('audio',{type:'heal',x:e.x,z:e.z});
    return true;
  }
  updateEntity(e,dt) {
    if(e.dead)return;
    e.attackTimer=Math.max(0,e.attackTimer-dt);e.parry=Math.max(0,e.parry-dt);e.invulnerable=Math.max(0,e.invulnerable-dt);
    e.stun=Math.max(0,e.stun-dt);e.frozen=Math.max(0,e.frozen-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);
    e.comboTime=Math.max(0,e.comboTime-dt);if(e.comboTime===0)e.streak=Math.max(0,e.streak-dt*3);
    e.invisible=Math.max(0,e.invisible-dt);e.airborne=Math.max(0,e.airborne-dt);
    if(e.spawnTime>0)e.spawnTime=Math.max(0,e.spawnTime-dt);
    if(e.shieldTime>0){e.shieldTime-=dt;if(e.shieldTime<=0)e.shield=0;}
    for(let i=0;i<e.cooldowns.length;i++)e.cooldowns[i]=Math.max(0,e.cooldowns[i]-dt);
    for(const key of Object.keys(e.buffs)){e.buffs[key]-=dt;if(e.buffs[key]<=0)delete e.buffs[key];}
    for(const key of ['wet','frost','root','fire','void','shadow','spirit','light','wind','reaction'])if(e.statuses[key]>0)e.statuses[key]=Math.max(0,e.statuses[key]-dt);
    if(e.statuses.frost<=0)e.statuses.frostStacks=0;
    if(e.statuses.fire>0){e.burnTick=(e.burnTick||0)-dt;if(e.burnTick<=0){e.burnTick=.6;const source=this.sim.entity(e.statuses.burnSource);if(source)this.damage(source,e,(e.statuses.burnPower||5)*.6,{element:'fire',dot:true,noReaction:true});}}
    if(e.action){e.action.elapsed+=dt;if(e.action.elapsed>=e.action.duration)e.action=null;}
    if(e.blocking)e.blockAge+=dt;
    const active=e.id===this.sim.activeHero?.id;
    if(e.team==='party'||e.echo){
      e.focus=clamp(e.focus+(e.stats?.focusRegen||6.5)*dt*(this.sim.modifier==='focus'?.5:1),0,e.maxFocus);
      e.stamina=clamp(e.stamina+dt*(e.blocking?4:24)*(e.stats?.recovery||1),0,100);
      if(!active && !e.dead && distance(e,this.sim.activeHero||e)>80){const p=this.sim.world.entry(this.sim.director?.index||0);e.x=p.x;e.z=p.z;e.nav=null;}
      if(this.sim.relics.lowRegen && e.hp/e.maxHp<.4 && distance(e,this.sim.activeHero||e)<8)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*this.sim.relics.lowRegen*dt);
    }
    if(e.dodge>0){const move=Math.min(dt,e.dodge)*18;this.sim.world.move(e,e.dodgeX*move,e.dodgeZ*move);e.dodge=Math.max(0,e.dodge-dt);}
    if(e.pull){const k=Math.min(1,dt/Math.max(.03,e.pull.time));this.sim.world.move(e,(e.pull.x-e.x)*k,(e.pull.z-e.z)*k);e.pull.time-=dt;if(e.pull.time<=0)e.pull=null;}
  }
}
