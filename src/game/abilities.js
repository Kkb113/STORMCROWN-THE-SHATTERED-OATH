import { HERO_BY_ID, ELEMENTS } from '../data/heroes.js';
import { clamp, distance, normalize2, angleTo, TAU } from '../core/math.js';
import { makeConstruct } from './entities.js';
import { currentBonds } from './progression.js';

const color = element => ELEMENTS[element]?.hex || 0xb8a2ef;
/** Every entry is an executable, distinct move. The same moves drive Crown echoes. */
export class Abilities {
  constructor(sim) {
    this.sim=sim; this.combat=sim.combat;
    this.handlers={
      stormdash:this.stormdash, chain:this.chain, tempest:this.tempest,
      tether:this.tether, firespin:this.firespin, phoenix:this.phoenix,
      faultline:this.faultline, bulwark:this.bulwark, worldsplitter:this.worldsplitter,
      frostlance:this.frostlance, blizzard:this.blizzard, silence:this.silence,
      shadowstep:this.shadowstep, daggerfan:this.daggerfan, blackout:this.blackout,
      sunward:this.sunward, lightlance:this.lightlance, solar:this.solar,
      briars:this.briars, leap:this.leap, beast:this.beast,
      galearrow:this.galearrow, cyclone:this.cyclone, arrowstorm:this.arrowstorm,
      mine:this.mine, turret:this.turret, engine:this.engine,
      gravemark:this.gravemark, soultithe:this.soultithe, choir:this.choir,
      riftstep:this.riftstep, stormspears:this.stormspears, hurricane:this.hurricane,
    };
  }
  cast(e,slot,aim=null) {
    if (!e || !this.combat.available(e) || e.action?.kind==='ultimate') return false;
    const skill=HERO_BY_ID[e.heroId]?.skills[slot];
    if (!skill || !this.handlers[skill.type]) return false;
    if (e.cooldowns[slot]>0) {this.feedback(e,`${skill.name} is recovering.`);return false;}
    const ultimate=slot===2, cost=ultimate?100*(1+(e.team==='party'?(this.sim.relics.ultimateCost||0):0)):skill.cost;
    if (ultimate ? e.judgment<cost : e.focus<cost) {this.feedback(e,ultimate?'Judgment is not yet full.':'Not enough Focus. Strike enemies to restore it.');return false;}
    if (ultimate) e.judgment-=cost; else e.focus-=cost;
    e.cooldowns[slot]=ultimate?1:skill.cooldown*(e.stats?.cooldown||1)*(e.rank>=2?.92:1);
    const point=this.aimPoint(e,aim,skill.radius>10?skill.radius:13);
    e.angle=angleTo(e,point); e.invisible=0;
    this.combat.beginAction(e,ultimate?'ultimate':'ability',ultimate?1.05:.42,{skill:skill.type});
    const power=e.damage*(e.stats?.power||1)*(ultimate?(e.stats?.ultimate||1):1), radius=skill.radius*(e.rank>=3?1.12:1);
    if (ultimate) {
      e.invulnerable=Math.max(e.invulnerable,1.2);
      if(e.team==='party') {
        this.sim.emit('ultimate',{heroId:e.heroId,name:skill.name,element:e.element,x:e.x,z:e.z,duration:3.2});
        if(this.sim.relics.oathEmpower)for(const ally of this.sim.party)if(ally.id!==e.id)ally.buffs.empowered=8;
      }
      this.sim.emit('audio',{type:'ultimate',element:e.element,x:e.x,z:e.z});
      this.sim.emit('grade',{element:e.element,duration:3.5});
    } else this.sim.emit('audio',{type:'cast',element:e.element,x:e.x,z:e.z});
    this.handlers[skill.type].call(this,e,{...skill,power,radius,point});
    this.sim.director?.abilityUsed(e,slot);
    return true;
  }
  feedback(e,text) {if(e.id===this.sim.activeHero?.id)this.sim.emit('feedback',{text});}
  aimPoint(e,aim,max=14) {
    let p=aim || this.sim.nearestTarget(e,20) || {x:e.x+Math.sin(e.angle)*8,z:e.z+Math.cos(e.angle)*8};
    const d=distance(e,p);
    return d>max?{x:e.x+(p.x-e.x)*max/d,z:e.z+(p.z-e.z)*max/d}:{x:p.x,z:p.z};
  }
  target(e,range=14,point=e) {return this.sim.targetsFor(e).filter(t=>distance(e,t)<=range).sort((a,b)=>distance(a,point)-distance(b,point))[0] || null;}
  effect(type,p,element,extra={}) {this.sim.emit('effect',{type,x:p.x,z:p.z,color:color(element),...extra});}
  strike(e,p,amount,radius,element,extra={}) {this.combat.area(e,p,radius,amount,{element,apply:true,heavy:true,...extra});}
  blink(e,dist) {const from={x:e.x,z:e.z};this.sim.world.move(e,Math.sin(e.angle)*dist,Math.cos(e.angle)*dist);e.invulnerable=Math.max(e.invulnerable,.38);return {from,to:{x:e.x,z:e.z}};}
  blast(e,p,amount,radius,element,extra={}) {
    this.strike(e,p,amount,radius,element,extra);this.effect('burst',p,element,{radius});this.sim.emit('shake',{amount:.27});
  }
  stormdash(e,s) {
    const line=this.blink(e,11);
    this.combat.line(e,line.from,line.to,3.4,s.power*1.9,{element:'storm',apply:true,heavy:true,launch:true});
    this.sim.emit('effect',{type:'bolt',from:{...line.from,y:1},to:{...line.to,y:1.2},color:color('storm'),width:.11});
    this.sim.emit('effect',{type:'dash',...line,color:color('storm'),wide:true});
  }
  chain(e,s) {
    let current=e, targets=this.sim.targetsFor(e).filter(t=>distance(e,t)<s.radius+3),count=0;
    while(targets.length && count<7) {
      targets.sort((a,b)=>distance(a,current)-distance(b,current));const target=targets.shift();
      if(distance(current,target)>s.radius+1)break;
      const from={x:current.x,y:current.y+1.4,z:current.z},to={x:target.x,y:target.y+1,z:target.z};
      const jump=count;this.sim.schedule(jump*.075,()=>{this.combat.damage(e,target,s.power*2.4*(1-jump*.025),{element:'storm',apply:true,heavy:true,stagger:60});this.sim.emit('effect',{type:'bolt',from,to,color:color('storm'),width:.08});},e.id);
      current=target;count++;
    }
    if(count===0)this.sim.emit('effect',{type:'bolt',from:{x:e.x,y:1.4,z:e.z},to:{...s.point,y:.2},color:color('storm'),width:.05});
  }
  tempest(e,s) {
    const center={x:e.x,z:e.z};
    this.effect('sigil',center,'storm',{radius:s.radius,life:3.5});
    this.sim.emit('shake',{amount:.18});
    for(let i=0;i<14;i++) this.sim.schedule(.28+i*.16,()=>{
      const targets=this.sim.targetsFor(e).filter(t=>distance(t,center)<s.radius+2);
      const t=targets.length?targets[i%targets.length]:{x:center.x+Math.sin(i*2.4)*s.radius*.65,z:center.z+Math.cos(i*2.4)*s.radius*.65};
      const p={x:t.x,z:t.z};
      this.sim.emit('effect',{type:'lightning',x:p.x,z:p.z,height:22,radius:2.5,color:color('storm'),branches:3});
      this.strike(e,p,s.power*.72,3.2,'storm',{launch:true});
      if(i%3===0)this.sim.emit('audio',{type:'thunder',x:p.x,z:p.z,volume:.6});
    },e.id);
    this.sim.schedule(2.72,()=>{
      this.sim.emit('effect',{type:'lightning',x:e.x,z:e.z,height:32,radius:s.radius,color:0xcebbff,branches:8,major:true});
      this.strike(e,e,s.power*4.8,s.radius,'storm',{launch:true,stagger:240});
      this.effect('shockwave',e,'storm',{radius:s.radius*1.3,life:1.1});
      this.sim.emit('shake',{amount:1});this.sim.emit('audio',{type:'thunder',x:e.x,z:e.z,volume:1});
      e.focus=Math.min(e.maxFocus,e.focus+40);
    },e.id);
  }
  tether(e,s) {
    const t=this.target(e,s.radius,s.point);
    if(!t){this.effect('slash',e,'fire',{radius:5,angle:e.angle});return;}
    this.sim.emit('effect',{type:'chain',from:{x:e.x,y:1.2,z:e.z},to:{x:t.x,y:1,z:t.z},color:color('fire'),life:.42});
    this.combat.damage(e,t,s.power*2.1,{element:'fire',apply:true,stagger:75,heavy:true});
    if(t.kind!=='boss'){const dir=normalize2(t.x-e.x,t.z-e.z);t.pull={x:e.x+dir.x*2,z:e.z+dir.z*2,time:.32};t.stun=.8;}
  }
  firespin(e,s) {
    e.buffs.firespin=2.7;
    for(let i=0;i<6;i++)this.sim.schedule(i*.42,()=>{this.strike(e,e,s.power*.65,s.radius,'fire',{stagger:24});this.effect('slash',e,'fire',{radius:s.radius,angle:i*1.7,heavy:true,full:true});},e.id);
  }
  phoenix(e,s) {
    e.invulnerable=1.45;e.buffs.phoenix=1.2;
    const from={x:e.x,z:e.z},line=this.blink(e,18);
    this.combat.line(e,line.from,line.to,7,s.power*6,{element:'fire',apply:true,heavy:true,launch:true});
    const mid={x:(from.x+e.x)/2,z:(from.z+e.z)/2};
    this.sim.emit('effect',{type:'phoenix',from,to:{x:e.x,z:e.z},color:color('fire'),radius:10});
    for(let i=0;i<5;i++){const p={x:from.x+(e.x-from.x)*i/4,z:from.z+(e.z-from.z)*i/4};this.sim.zone(e,{kind:'flame',...p,radius:3.5,life:5,interval:.6,power:.35,element:'fire'});}
    this.sim.schedule(.55,()=>{this.blast(e,e,s.power*4,s.radius*.65,'fire',{launch:true});this.effect('wings',e,'fire',{radius:10});},e.id);
  }
  faultline(e,s) {
    const end={x:e.x+Math.sin(e.angle)*s.radius,z:e.z+Math.cos(e.angle)*s.radius};
    this.combat.line(e,e,end,4,s.power*3.5,{element:'earth',apply:true,heavy:true,launch:true,stagger:100});
    this.sim.emit('effect',{type:'faultline',from:{x:e.x,z:e.z},to:end,color:color('earth'),radius:2});
    this.sim.emit('shake',{amount:.4});
  }
  bulwark(e,s) {
    e.buffs.bulwark=8;e.resource=Math.min(3,e.resource+1);
    for(const ally of this.sim.alliesFor(e)){if(distance(e,ally)>s.radius)continue;ally.shield=Math.max(ally.shield,ally.maxHp*.24);ally.shieldTime=8;ally.buffs.bulwark=6;this.effect('shield',ally,'earth',{radius:2,life:1.2});}
    for(const enemy of this.sim.targetsFor(e))if(distance(e,enemy)<s.radius+3){enemy.tauntId=e.id;enemy.tauntTime=6;}
    this.effect('dome',e,'earth',{radius:s.radius,life:1.5});
  }
  worldsplitter(e,s) {
    const center={x:e.x,z:e.z};
    this.effect('sigil',center,'earth',{radius:s.radius,life:2.4});
    for(let n=0;n<3;n++)this.sim.schedule(.45+n*.52,()=>{
      this.strike(e,center,s.power*(n===2?4.5:2.5),s.radius*(.5+n*.25),'earth',{launch:true,stagger:150});
      for(let i=0;i<9;i++){const a=i*TAU/9+n*.18;this.sim.emit('effect',{type:'faultline',from:center,to:{x:center.x+Math.sin(a)*s.radius,z:center.z+Math.cos(a)*s.radius},color:color('earth'),radius:2.5});}
      this.effect('shockwave',center,'earth',{radius:s.radius*1.1});this.sim.emit('shake',{amount:n===2?.9:.5});this.sim.emit('audio',{type:'impact',x:e.x,z:e.z});
    },e.id);
  }
  frostlance(e,s) {
    this.sim.projectile(e,{angle:e.angle,speed:28,range:s.radius+2,power:2.6*(e.stats?.power||1),element:'frost',apply:true,freeze:true,pierce:10,radius:.9,heavy:true,visual:'ice'});
    this.effect('castRing',e,'frost',{radius:2});
  }
  blizzard(e,s) {
    this.sim.zone(e,{kind:'blizzard',...s.point,radius:s.radius,life:6.2,interval:.72,power:.52*(e.stats?.power||1),element:'frost',slow:.55});
    this.effect('snowburst',s.point,'frost',{radius:s.radius});
  }
  silence(e,s) {
    const targets=this.sim.targetsFor(e).filter(t=>distance(t,e)<s.radius+3);
    for(const t of targets){t.frozen=t.kind==='boss'?1.5:4.5;this.effect('freeze',t,'frost',{scale:t.scale});}
    this.effect('dome',e,'frost',{radius:s.radius,life:2.5});this.effect('sigil',e,'frost',{radius:s.radius,life:2.5});
    this.sim.schedule(1.65,()=>{for(const t of targets){if(t.dead)continue;this.combat.damage(e,t,s.power*8,{element:'frost',apply:true,heavy:true,launch:true,stagger:150});this.effect('shatter',t,'frost',{radius:3.5});}this.effect('shockwave',e,'frost',{radius:s.radius*1.2});this.sim.emit('shake',{amount:.7});this.sim.emit('audio',{type:'shatter',x:e.x,z:e.z});},e.id);
  }
  shadowstep(e,s) {
    const t=this.target(e,14,s.point),from={x:e.x,z:e.z};
    if(t){const p={x:t.x-Math.sin(t.angle)*2,z:t.z-Math.cos(t.angle)*2};if(this.sim.world.isWalkable(p,e.radius)){e.x=p.x;e.z=p.z;e.angle=angleTo(e,t);}this.combat.damage(e,t,s.power*2.5,{element:'shadow',apply:true,critical:true,heavy:true});}
    else this.blink(e,8);
    e.invisible=2.2;e.invulnerable=.45;e.buffs.backstab=3;
    this.sim.emit('effect',{type:'shadowstep',from,to:{x:e.x,z:e.z},color:color('shadow')});
  }
  daggerfan(e,s) {
    for(let i=0;i<7;i++)this.sim.projectile(e,{angle:e.angle+(i-3)*.18,speed:25,range:13,power:1.05*(e.stats?.power||1),element:'shadow',apply:true,pierce:2,radius:.32,visual:'dagger'});
    this.effect('slash',e,'shadow',{radius:4,angle:e.angle,heavy:true});
  }
  blackout(e,s) {
    const original={x:e.x,z:e.z},targets=this.sim.targetsFor(e).filter(t=>distance(t,e)<s.radius+2).slice(0,10);
    e.invulnerable=2.5;e.invisible=2.3;
    this.effect('darkness',e,'shadow',{radius:s.radius,life:2.5});
    targets.forEach((t,i)=>this.sim.schedule(.3+i*.15,()=>{
      if(t.dead)return;
      const p={x:t.x-Math.sin(t.angle)*1.8,z:t.z-Math.cos(t.angle)*1.8};
      if(this.sim.world.isWalkable(p,e.radius)){this.sim.emit('effect',{type:'shadowstep',from:{x:e.x,z:e.z},to:p,color:color('shadow')});e.x=p.x;e.z=p.z;}
      const execute=t.kind!=='boss'&&t.hp/t.maxHp<.35;
      this.combat.damage(e,t,execute?t.maxHp*3:s.power*5.5,{element:'shadow',apply:true,critical:true,heavy:true,stagger:100});this.effect('slash',t,'shadow',{radius:4,angle:i,heavy:true});
    },e.id));
    this.sim.schedule(2,()=>{if(this.sim.world.isWalkable(original,e.radius)){e.x=original.x;e.z=original.z;}this.blast(e,e,s.power*3,s.radius,'shadow');e.invisible=0;},e.id);
  }
  sunward(e,s) {
    for(const ally of this.sim.alliesFor(e))if(distance(ally,e)<s.radius+4){this.combat.heal(e,ally,ally.maxHp*.17+e.resource*.4);ally.shield=Math.max(ally.shield,ally.maxHp*.16);ally.shieldTime=7;ally.buffs.protected=7;}
    e.resource=clamp(e.resource+20,0,100);this.effect('dome',e,'light',{radius:s.radius,life:1.4});this.effect('heal',e,'light',{radius:s.radius});
  }
  lightlance(e,s) {
    const end={x:e.x+Math.sin(e.angle)*s.radius,z:e.z+Math.cos(e.angle)*s.radius},bonus=1+e.resource*.009;e.resource=0;
    this.combat.line(e,e,end,3.4,s.power*3.4*bonus,{element:'light',apply:true,heavy:true,pierce:true,stagger:90});
    this.sim.emit('effect',{type:'beam',from:{x:e.x,y:1.2,z:e.z},to:{...end,y:1},color:color('light'),width:.2,life:.42});
  }
  solar(e,s) {
    const p=s.point;
    this.effect('sigil',p,'light',{radius:s.radius,life:1.4});
    this.sim.schedule(.75,()=>{this.strike(e,p,s.power*10,s.radius,'light',{launch:true,stagger:230});this.sim.emit('effect',{type:'solar',x:p.x,z:p.z,height:35,radius:s.radius,color:color('light')});this.sim.emit('shake',{amount:.85});for(const ally of this.sim.alliesFor(e))this.combat.heal(e,ally,ally.maxHp*.2);this.sim.emit('audio',{type:'impact',x:p.x,z:p.z});},e.id);
  }
  briars(e,s) {
    this.strike(e,s.point,s.power*1.5,s.radius,'nature',{root:true});
    this.sim.zone(e,{kind:'briars',...s.point,radius:s.radius,life:6,interval:1,power:.35,element:'nature',root:true});
  }
  leap(e,s) {
    const from={x:e.x,z:e.z},dir=normalize2(s.point.x-e.x,s.point.z-e.z),d=Math.min(11,distance(e,s.point));
    this.sim.world.move(e,dir.x*d,dir.z*d);e.vy=5;e.y=1.2;e.invulnerable=.6;e.resource=clamp(e.resource+20,0,100);
    this.sim.emit('effect',{type:'leap',from,to:{x:e.x,z:e.z},color:color('nature')});
    this.sim.schedule(.38,()=>{this.blast(e,e,s.power*3.1,5.5,'nature',{launch:true,root:true});},e.id);
  }
  beast(e,s) {
    e.buffs.beast=18;e.resource=0;this.combat.heal(e,e,e.maxHp*.28);
    this.blast(e,e,s.power*4,9,'nature',{launch:true});this.effect('transform',e,'nature',{radius:7,life:2});
    for(const t of this.sim.targetsFor(e))if(distance(e,t)<16){t.tauntId=e.id;t.tauntTime=8;}
  }
  galearrow(e,s) {
    this.sim.projectile(e,{angle:e.angle,speed:38,range:21,power:3.1*(e.stats?.power||1),element:'wind',apply:true,pierce:10,radius:.75,heavy:true,pin:true,visual:'arrow'});
    this.effect('castRing',e,'wind',{radius:2});
  }
  cyclone(e,s) {
    this.sim.zone(e,{kind:'cyclone',...s.point,radius:s.radius,life:6.5,interval:.7,power:.5,element:'wind',pull:6});
  }
  arrowstorm(e,s) {
    const p=s.point;this.sim.zone(e,{kind:'cyclone',...p,radius:s.radius*.65,life:5.5,interval:.55,power:.45,element:'wind',pull:5});
    this.effect('sigil',p,'wind',{radius:s.radius,life:5});
    for(let i=0;i<24;i++)this.sim.schedule(.35+i*.17,()=>{
      const a=i*2.399,d=Math.sqrt((i%8)/8)*s.radius*.8,t={x:p.x+Math.sin(a)*d,z:p.z+Math.cos(a)*d};
      this.sim.emit('effect',{type:'arrowRain',x:t.x,z:t.z,radius:4,color:color('wind'),height:18});
      this.strike(e,t,s.power*.85,4,'wind',{stagger:26});
    },e.id);
    this.sim.schedule(4.7,()=>this.blast(e,p,s.power*3,s.radius,'wind',{launch:true}),e.id);
  }
  mine(e,s) {
    const mines=this.sim.zones.filter(z=>z.kind==='mine'&&z.ownerId===e.id);if(mines.length>=3)mines[0].trigger=true;
    this.sim.zone(e,{kind:'mine',x:e.x+Math.sin(e.angle)*1.3,z:e.z+Math.cos(e.angle)*1.3,radius:s.radius,life:25,interval:99,power:4,element:'arcane',arming:.6});
    this.effect('castRing',e,'arcane',{radius:2});
  }
  summonConstruct(e,p,kind,life,power) {
    const existing=this.sim.constructs.filter(c=>c.ownerId===e.id&&!c.dead);
    const max=kind==='spirit'?5:2;if(existing.filter(c=>c.constructType===kind).length>=max){const old=existing.find(c=>c.constructType===kind);old.dead=true;old.deathAge=0;}
    const r=e.team==='party'?this.sim.relics:{};
    const construct=makeConstruct(e,p,kind,life*(1+(r.constructDuration||0)),power);
    this.sim.constructs.push(construct);this.effect('summon',p,construct.element,{radius:3,life:1});return construct;
  }
  turret(e,s) {const p={x:e.x+Math.sin(e.angle)*2.5,z:e.z+Math.cos(e.angle)*2.5};this.summonConstruct(e,p,'turret',16,.85);}
  engine(e,s) {const p={x:e.x+Math.sin(e.angle)*3,z:e.z+Math.cos(e.angle)*3};this.summonConstruct(e,p,'engine',18,1.75);this.blast(e,p,s.power*3.5,8,'arcane',{launch:true});}
  gravemark(e,s) {
    this.strike(e,s.point,s.power*2.4,s.radius,'spirit');
    for(const t of this.sim.targetsFor(e))if(distance(t,s.point)<s.radius){t.statuses.void=8;t.buffs.weakened=6;}
    this.effect('sigil',s.point,'spirit',{radius:s.radius,life:1.4});this.effect('implosion',s.point,'spirit',{radius:s.radius});
  }
  soultithe(e,s) {
    let stolen=0;
    for(const t of this.sim.targetsFor(e))if(distance(t,e)<s.radius){const marked=t.statuses.spirit>0||t.statuses.void>0;stolen+=this.combat.damage(e,t,s.power*(marked?2.8:1.4),{element:'spirit',apply:true});this.sim.emit('effect',{type:'soul',from:{x:t.x,y:1,z:t.z},to:{x:e.x,y:1.4,z:e.z},color:color('spirit'),life:.8});}
    const allies=this.sim.alliesFor(e);for(const a of allies)this.combat.heal(e,a,stolen*.25/Math.max(1,allies.length)+s.power*.4);
    this.summonConstruct(e,{x:e.x+2,z:e.z+1},'spirit',11,.8+e.resource*.06);
  }
  choir(e,s) {
    const souls=e.resource;e.resource=0;
    for(let i=0;i<5;i++){const a=i*TAU/5,p={x:e.x+Math.sin(a)*3,z:e.z+Math.cos(a)*3};this.sim.schedule(i*.16,()=>this.summonConstruct(e,p,'spirit',18,1+souls*.08),e.id);}
    this.blast(e,e,s.power*3,12,'spirit',{launch:true});this.effect('sigil',e,'spirit',{radius:12,life:3});
  }
  riftstep(e,s) {
    const line=this.blink(e,s.radius);
    this.combat.line(e,line.from,line.to,4,s.power*1.7,{element:'void',apply:true,heavy:true});
    this.sim.schedule(.14,()=>this.combat.line(e,line.from,line.to,4,s.power*1.5,{element:'storm',apply:true,heavy:true,launch:true}),e.id);
    this.sim.emit('effect',{type:'rift',...line,color:color('void'),radius:3});e.buffs.riftCounter=3;
  }
  stormspears(e,s) {
    for(const side of [-1,1])this.sim.projectile(e,{angle:e.angle+side*.08,speed:28,range:s.radius+3,power:2*(e.stats?.power||1),element:side<0?'storm':'void',apply:true,pierce:3,radius:.65,heavy:true,visual:'spear',onEnd:p=>this.sim.zone(e,{kind:'vortex',...p,radius:3.8,life:3.5,interval:.6,power:.38,element:'storm',pull:5})});
    this.effect('castRing',e,'storm',{radius:3});
  }
  hurricane(e,s) {
    e.buffs.hurricane=5.5;
    this.sim.zone(e,{kind:'hurricane',x:e.x,z:e.z,radius:s.radius,life:5.5,interval:.38,power:.65,element:'storm',pull:6,followOwner:true,launch:true});
    this.effect('sigil',e,'void',{radius:s.radius,life:5.5});
    this.sim.schedule(4.9,()=>{this.blast(e,e,s.power*4.2,s.radius,'void',{launch:true,stagger:220});this.effect('lightning',e,'storm',{height:30,branches:7,major:true,radius:s.radius});this.sim.emit('shake',{amount:.95});},e.id);
  }
  bond() {
    const sim=this.sim,e=sim.activeHero,bonds=currentBonds(sim.profile,sim.party.map(h=>h.heroId)).filter(b=>b.heroes.every(id=>sim.party.some(h=>h.heroId===id&&!h.dead)));
    if(!bonds.length){sim.emit('feedback',{text:'Complete companion quests to unlock a bond attack for this party.'});return false;}
    const cost=100*(1+(sim.relics.bondCost||0));
    if(sim.unity<cost){sim.emit('feedback',{text:'Build Unity with attacks, reactions, and perfect parries.'});return false;}
    const bond=bonds[sim.bondIndex++%bonds.length];sim.unity-=cost;
    const pair=sim.party.filter(h=>bond.heroes.includes(h.heroId)),power=pair.reduce((n,h)=>n+h.damage,0)/2;
    for(const hero of pair){hero.invulnerable=2;this.combat.beginAction(hero,'ultimate',1.2,{skill:bond.id});hero.focus=clamp(hero.focus+(sim.relics.bondFocus||0),0,hero.maxFocus);}
    sim.emit('ultimate',{heroId:e.heroId,name:bond.name,element:e.element,bond:true,duration:2.7});sim.emit('audio',{type:'bond',x:e.x,z:e.z});
    const center={x:e.x,z:e.z};this.effect('sigil',center,'storm',{radius:15,color:bond.color,life:2.8});
    const effects={thunderfire:['fire','storm','firespin'],frozenearth:['frost','earth','faultline'],twintempest:['storm','void','hurricane'],eclipse:['spirit','light','implosion'],wildhunt:['nature','wind','arrowRain'],nightengine:['shadow','arcane','rift']};
    const [first,second,visual]=effects[bond.id];
    for(let i=0;i<4;i++)sim.schedule(.3+i*.42,()=>{
      const element=i%2?second:first;this.strike(e,center,power*2.8,15,element,{launch:i===3,stagger:90});
      if(visual==='faultline')for(let n=0;n<8;n++)sim.emit('effect',{type:'faultline',from:center,to:{x:center.x+Math.sin(n*TAU/8)*15,z:center.z+Math.cos(n*TAU/8)*15},color:bond.color});
      else this.effect(i===3?'shockwave':visual==='hurricane'?'lightning':visual,center,element,{radius:15,height:25,major:true});
      sim.emit('shake',{amount:i===3?.9:.35});
    },e.id);
    if(bond.id==='eclipse')for(const ally of sim.party)this.combat.heal(e,ally,ally.maxHp*.35);
    return true;
  }
}
export const ABILITY_TYPES = Object.freeze(['stormdash','chain','tempest','tether','firespin','phoenix','faultline','bulwark','worldsplitter','frostlance','blizzard','silence','shadowstep','daggerfan','blackout','sunward','lightlance','solar','briars','leap','beast','galearrow','cyclone','arrowstorm','mine','turret','engine','gravemark','soultithe','choir','riftstep','stormspears','hurricane']);
