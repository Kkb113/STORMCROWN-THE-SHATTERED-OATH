import { Events } from '../core/events.js';
import { random, hashString, distance, normalize2, angleTo, angleDelta, moveAngle, clamp, segmentDistanceSq, TAU } from '../core/math.js';
import { REGIONS } from '../data/regions.js';
import { WorldMap, hubMap } from './world.js';
import { makeHero, makeEnemy, makeBoss } from './entities.js';
import { relicEffects } from './progression.js';
import { Combat } from './combat.js';
import { Abilities } from './abilities.js';
import { AI } from './ai.js';
import { Bosses } from './bosses.js';
import { MissionDirector } from './director.js';
import { TrainingDirector } from './training.js';
import { PlayerController } from './player.js';

export const EMPTY_INPUT = Object.freeze({moveX:0,moveY:0,attack:false,heavy:false,guard:false,guardPressed:false,dodge:false,skill1:false,skill2:false,ultimate:false,bond:false,remedy:false,interact:false,switchTo:null,aim:null});
const timedFields=['invulnerable','hitFlash','stun','frozen'];

export function containsHazard(h,p,extra=0){
  const x=p.x-h.x,z=p.z-h.z,d=Math.hypot(x,z),radius=(h.radius||0)+(p.radius||0)+extra;
  if(h.shape==='ring')return d<=radius&&d>=Math.max(0,(h.inner||0)-(p.radius||0)-extra);
  if(h.shape==='rect'){
    const a=h.angle||0,side=x*Math.cos(a)-z*Math.sin(a),along=x*Math.sin(a)+z*Math.cos(a);
    return Math.abs(side)<=(h.width||3)*.5+(p.radius||0)+extra && Math.abs(along)<=(h.length||10)*.5+(p.radius||0)+extra;
  }
  if(h.shape==='cone')return d<=radius&&Math.abs(angleDelta(h.angle||0,Math.atan2(x,z)))<=(h.arc||2)*.5+(extra>0?.05:0);
  return d<=radius;
}

/** Fixed-step deterministic gameplay. Rendering never mutates this state. */
export class Simulation extends Events {
  constructor(profile,mission,options={}) {
    super();this.profile=profile;this.mission=mission;
    this.seed=options.checkpoint?.seed ?? hashString(mission.id);this.rng=random(this.seed);
    this.world=mission.id==='warden'?hubMap():new WorldMap(mission,this.seed);
    this.difficulty=profile.crownfall?'crownfall':profile.difficulty;
    this.state='running';this.elapsed=options.checkpoint?.elapsed || 0;this.tick=0;this.nextEffectId=100000;
    this.party=[];this.enemies=[];this.objects=[];this.civilians=[];this.constructs=[];this.figures=[];
    this.hazards=[];this.projectiles=[];this.zones=[];this.pickups=[];this.tasks=[];
    this.modifier=typeof mission.modifier==='object'?mission.modifier.effect:'';
    this.relics=relicEffects(profile);this.remedies=options.checkpoint?.remedies ?? 3;
    this.unity=0;this.bondIndex=0;this.rescueBonus=0;this.hitStop=0;this.aiAbilities=true;this.autoAim=true;
    this.stats={kills:0,rescues:0,reactions:0,parries:0,damageTaken:0,deaths:0,optional:0,time:0,...options.checkpoint?.stats};
    this.environment={id:0,team:'environment',kind:'environment',x:0,z:0,y:0,damage:60,element:REGIONS[mission.region]?.element||'storm',name:'The storm',damageDealt:0,kills:0,judgment:0};
    const ids=mission.solo?['rael']:(options.checkpoint?.party || profile.party),p=this.world.entry(options.checkpoint?.stage||0);
    ids.forEach((id,i)=>{
      const hero=makeHero(id,profile,{x:p.x+(i-1)*1.6,z:p.z+(i===0?0:1.2)},i);
      const r=options.checkpoint?.resources?.[i];if(r){hero.hp=hero.maxHp*clamp(r.hp,.2,1);hero.focus=clamp(r.focus,0,hero.maxFocus);hero.judgment=clamp(r.judgment,0,100);}
      if(!this.world.isWalkable(hero,hero.radius)){hero.x=p.x;hero.z=p.z;}
      this.party.push(hero);
    });
    this.activeIndex=clamp(options.checkpoint?.active ?? profile.active,0,this.party.length-1);
    if(this.world.isHub){this.party=[this.party[this.activeIndex]];this.activeIndex=0;this.party[0].x=0;this.party[0].z=10;this.party[0].slot=0;}
    this.combat=new Combat(this);this.abilities=new Abilities(this);this.ai=new AI(this);this.bosses=new Bosses(this);
    this.player=new PlayerController(this);
    this.resuming=!!options.checkpoint;this.director=mission.kind==='training'?new TrainingDirector(this):new MissionDirector(this,options.checkpoint);
    this.on('heroDown',()=>{const other=this.party.findIndex(h=>!h.dead);if(other<0)this.fail('The Warden’s last anchor fell.');else if(this.activeHero.dead)this.switchParty(other);});
    this.disposed=false;
  }
  get activeHero(){return this.party[this.activeIndex] || this.party[0];}
  get allEntities(){return [...this.party,...this.enemies,...this.objects,...this.civilians,...this.constructs,...this.figures];}
  entity(id){if(id===0)return this.environment;return this.party.find(e=>e.id===id)||this.enemies.find(e=>e.id===id)||this.objects.find(e=>e.id===id)||this.civilians.find(e=>e.id===id)||this.constructs.find(e=>e.id===id)||this.figures.find(e=>e.id===id)||null;}
  targetsFor(source){
    if(!source)return [];
    if(source.team==='party')return [...this.enemies,...this.objects.filter(e=>e.damageable&&e.team==='hostile')].filter(e=>!e.dead);
    if(source.team==='environment')return [...this.party,...this.civilians.filter(c=>!c.safe),...this.constructs,...this.enemies].filter(e=>!e.dead);
    if(source.team==='hostile')return [...this.party,...this.civilians.filter(c=>!c.safe),...this.constructs.filter(c=>c.team==='party'),...this.objects.filter(o=>o.team==='friendly'&&o.damageable)].filter(e=>!e.dead);
    return this.enemies.filter(e=>!e.dead);
  }
  alliesFor(source){
    if(source.team==='party')return [...this.party,...this.civilians.filter(c=>!c.safe),...this.objects.filter(o=>o.team==='friendly'&&o.damageable)].filter(e=>!e.dead);
    if(source.team==='hostile')return this.enemies.filter(e=>!e.dead);
    return [];
  }
  nearestTarget(source,range=Infinity){let best=null,score=range;for(const t of this.targetsFor(source)){const d=distance(source,t);if(d<score){score=d;best=t;}}return best;}
  schedule(delay,fn,ownerId=0,persist=false){const task={id:this.nextEffectId++,left:Math.max(0,delay),fn,ownerId,persist};this.tasks.push(task);return task.id;}
  updateTasks(dt){
    const tasks=this.tasks;this.tasks=[];
    for(const t of tasks){t.left-=dt;const owner=this.entity(t.ownerId);if(!t.persist&&t.ownerId!==0&&(!owner||owner.dead))continue;if(t.left<=0)t.fn();else this.tasks.push(t);}
  }
  spawnEnemy(type,p,options={}){
    if(this.enemies.filter(e=>!e.dead).length>=24)return null;
    const e=makeEnemy(type,p,this.mission.level||1,this.difficulty,this.mission.region,!!options.elite);
    e.encounter=this.director?.index || 0;this.enemies.push(e);this.emit('spawn',{entity:e});return e;
  }
  spawnBoss(type,p,modifier=1){const e=makeBoss(type,p,this.mission.level||1,this.difficulty,this.mission.region,modifier);e.encounter=this.director?.index||0;this.enemies.push(e);this.emit('spawn',{entity:e});return e;}
  projectile(owner,cfg){
    const angle=cfg.angle??owner.angle,range=cfg.range||20;
    const p={id:this.nextEffectId++,ownerId:owner.id,owner,team:owner.team,x:owner.x+Math.sin(angle)*.65,z:owner.z+Math.cos(angle)*.65,y:owner.y+1.2,
      prevX:owner.x,prevZ:owner.z,angle,speed:cfg.speed||20,range,traveled:0,radius:.3,power:1,element:owner.element,hit:new Set(),pierce:0,age:0,dead:false,...cfg};
    this.projectiles.push(p);return p;
  }
  endProjectile(p){if(p.dead)return;p.dead=true;if(p.onEnd)p.onEnd({x:p.x,z:p.z});if(p.splash)this.combat.area(p.owner,p,p.splash,p.owner.damage*p.power*.6,{element:p.element,apply:true,heavy:true});this.emit('effect',{type:'hit',x:p.x,z:p.z,y:p.y,color:elementColor(p.element)});}
  updateProjectiles(dt){
    for(const p of this.projectiles){
      if(p.dead)continue;p.age+=dt;p.prevX=p.x;p.prevZ=p.z;
      const step=Math.min(p.speed*dt,p.range-p.traveled);p.x+=Math.sin(p.angle)*step;p.z+=Math.cos(p.angle)*step;p.traveled+=step;
      const from={x:p.prevX,z:p.prevZ},to={x:p.x,z:p.z};
      for(const t of this.targetsFor(p.owner)){
        if(p.hit.has(t.id)||t.spawnTime>0||t.y>3.5)continue;
        if(segmentDistanceSq(t,from,to)>(p.radius+t.radius)**2)continue;
        p.hit.add(t.id);this.combat.damage(p.owner,t,p.owner.damage*p.power,{element:p.element,apply:p.apply,freeze:p.freeze,heavy:p.heavy,launch:p.launch,root:p.root,critical:p.critical,parryable:true});
        if(p.pin){t.stun=Math.max(t.stun,.8);t.vx=Math.sin(p.angle)*8;t.vz=Math.cos(p.angle)*8;}
        if(p.onHit)p.onHit(t);
        if(p.hit.size>p.pierce){this.endProjectile(p);break;}
      }
      if(p.traveled>=p.range||p.age>5)this.endProjectile(p);
    }
    this.projectiles=this.projectiles.filter(p=>!p.dead);
  }
  zone(owner,cfg){
    const z={id:this.nextEffectId++,ownerId:owner.id,owner,team:owner.team,x:owner.x,z:owner.z,kind:'field',radius:4,life:5,totalLife:cfg.life||5,tick:.05,interval:.65,power:.5,element:owner.element,age:0,...cfg};
    this.zones.push(z);this.emit('zoneCreated',{zone:z});return z;
  }
  updateZones(dt){
    for(const z of this.zones){
      z.life-=dt;z.age+=dt;z.tick-=dt;if(z.life<=0)continue;
      const owner=this.entity(z.ownerId)||z.owner;if(!owner || owner.dead && owner.kind!=='environment'){z.life=0;continue;}
      if(z.follow||z.followOwner){z.x=owner.x;z.z=owner.z;}
      if(z.kind==='mine'){
        if(z.age<.4)continue;
        if(z.trigger||this.targetsFor(owner).some(t=>distance(t,z)<z.radius)){
          this.combat.area(owner,z,z.radius+1.8,owner.damage*z.power,{element:z.element,apply:true,heavy:true,launch:true});z.life=0;
          this.emit('effect',{type:'runeExplosion',x:z.x,z:z.z,radius:z.radius+2,color:0x88bfff});this.emit('audio',{type:'explosion',element:'arcane'});
        }continue;
      }
      for(const t of this.targetsFor(owner)){
        if(distance(t,z)>z.radius+t.radius)continue;
        if(z.pull&&t.kind!=='boss'&&distance(t,z)>1.5){const d=normalize2(z.x-t.x,z.z-t.z);this.world.move(t,d.x*z.pull*dt,d.z*z.pull*dt);}
        if(z.root)t.statuses.root=.25;
        if(z.slow)t.statuses.frost=.3;
        if(z.tick<=0)this.combat.damage(owner,t,owner.damage*z.power,{element:z.element,apply:true,freeze:z.freeze,root:z.root,noReaction:z.noReaction,heavy:z.kind==='hurricane',launch:z.kind==='hurricane'&&z.age%1<.3});
      }
      if(z.tick<=0){z.tick=z.interval;this.emit('zonePulse',{zone:z});}
    }
    this.zones=this.zones.filter(z=>z.life>0);
  }
  hazard(owner,cfg){
    const h={id:this.nextEffectId++,ownerId:owner.id,owner,x:owner.x,z:owner.z,shape:'circle',radius:3,warn:1,totalWarn:cfg.warn??1,age:0,active:false,
      activeFor:0,interval:.65,tick:0,damage:owner.damage||80,element:owner.element||'physical',parryable:false,dead:false,...cfg};
    this.hazards.push(h);return h;
  }
  updateHazards(dt){
    for(const h of this.hazards){
      if(h.dead)continue;
      const owner=this.entity(h.ownerId)||h.owner;
      if(h.ownerId!==0&&(!owner||owner.dead)){h.dead=true;continue;}
      h.age+=dt;
      if(h.warn>0){h.warn-=dt;if(h.warn>0)continue;h.warn=0;h.active=true;h.tick=0;
        if(h.onImpact)h.onImpact(h);
        const type=h.visual==='lightning'?'skybolt':h.visual==='cleave'?'slash':h.visual==='stormwall'?'wall':'burst';
        this.emit('effect',{type,x:h.x,z:h.z,y:0,radius:h.radius||h.width||4,width:h.width||.12,length:h.length,angle:h.angle,color:elementColor(h.element),life:h.activeFor||.8,height:h.visual==='lightning'?32:undefined});
        this.emit('audio',{type:h.visual==='lightning'?'thunder':'impact',x:h.x,z:h.z,element:h.element});
        if(distance(h,this.activeHero)<22)this.emit('shake',{amount:h.radius>5?.3:.12});
      }
      h.tick-=dt;
      if(h.activeFor>0){h.x+=(h.vx||0)*dt;h.z+=(h.vz||0)*dt;}
      if(h.tick<=0){
        for(const t of this.targetsFor(owner))if(containsHazard(h,t)){
          this.combat.damage(owner,t,h.damage,{element:h.element,apply:h.apply!==false,absorb:h.absorb,unblockable:h.unblockable,parryable:h.parryable,heavy:h.heavy||h.launch,launch:h.launch,freeze:h.freeze,noReaction:h.noReaction});
          if(h.freeze && t.invulnerable<=0 && !t.dead)t.frozen=Math.max(t.frozen,t.kind==='boss'?.3:1);
        }
        h.tick=h.interval;
      }
      if(h.activeFor>0){h.activeFor-=dt;if(h.activeFor<=0)h.dead=true;}else h.dead=true;
    }
    this.hazards=this.hazards.filter(h=>!h.dead);
  }
  dangerAt(point,horizon=.65){return this.hazards.find(h=>!h.dead&&h.warn<=horizon&&containsHazard(h,point,.8)) || null;}
  switchParty(index){
    if(!Number.isInteger(index)||index<0||index>=this.party.length||this.party[index].dead||index===this.activeIndex)return false;
    const old=this.activeHero,next=this.party[index];this.activeIndex=index;this.profile.active=index;
    old.blocking=false;next.invulnerable=Math.max(next.invulnerable,.28);
    if(old.heroId==='rael'&&next.heroId==='lucen')next.buffs.dualStorm=5;
    if(this.relics.switchGuard&&(this.switchGuardCooldown||0)<=0){next.invulnerable=Math.max(next.invulnerable,this.relics.switchGuard);this.switchGuardCooldown=12;}
    this.emit('switch',{from:old,to:next,index});this.emit('audio',{type:'switch',element:next.element});return true;
  }
  assumeAnchor(id,p){
    const existing=this.party.findIndex(h=>h.heroId===id);
    if(existing>=0)this.activeIndex=existing;
    else{const old=this.activeHero;this.party[this.activeIndex]=makeHero(id,this.profile,p,this.activeIndex);old.retired=true;}
    const h=this.activeHero;h.x=p.x;h.z=p.z;h.y=0;h.vy=0;h.dead=false;h.hp=h.maxHp;h.focus=h.maxFocus;h.judgment=100;h.cooldowns=[0,0,0];h.angle=angleTo(h,this.director.room);h.action=null;
    this.emit('switch',{to:h,index:this.activeIndex});
  }
  revive(hero,fraction=.45){
    const p=this.activeHero?.dead?this.world.entry(this.director.index):this.activeHero;
    hero.dead=false;hero.deathAge=0;hero.hp=hero.maxHp*fraction;hero.stun=0;hero.frozen=0;hero.statuses={};hero.vy=0;hero.y=0;hero.invulnerable=2;
    if(p && hero.id!==p.id){hero.x=p.x+(hero.slot-1)*1.5;hero.z=p.z+1;}
    this.emit('revive',{hero});
  }
  fail(reason){if(this.state!=='running')return;this.state='defeated';this.stats.deaths++;this.profile.deaths++;this.emit('defeat',{reason});}
  updatePlayer(dt,input){ this.player.update(dt,input); }
  updatePhysics(e,dt){
    e.prevX=e.x;e.prevZ=e.z;e.prevY=e.y;e.prevAngle=e.angle;e.age+=dt;
    if(e.dead)e.deathAge+=dt;
    if(Math.abs(e.vx)+Math.abs(e.vz)>.05){this.world.move(e,e.vx*dt,e.vz*dt);const drag=Math.exp(-dt*6);e.vx*=drag;e.vz*=drag;}
    if(e.vy!==0||e.y>0){e.vy-=dt*19;e.y+=e.vy*dt;if(e.y<0){e.y=0;e.vy=0;if(e.airborne>0)this.emit('effect',{type:'dust',x:e.x,z:e.z,color:0xafa7b8});}}
    if(this.world.holes.some(p=>distance(e,p)<p.radius+(e.radius||.5))){const room=this.world.roomAt(e)||this.director.room;const p=this.world.point(room.id,angleTo(room,e),.42,e.radius);e.x=p.x;e.z=p.z;e.vy=4;e.invulnerable=Math.max(e.invulnerable,.5);e.nav=null;}
    this.combat.updateEntity(e,dt);
    if((REGIONS[this.mission.region]?.wet||this.modifier==='wet')&&!e.dead)e.statuses.wet=1;
  }
  separate(dt){
    const bodies=[...this.party,...this.enemies,...this.civilians].filter(e=>!e.dead&&e.dodge<=0&&e.y<1.3);
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j],min=(a.radius+b.radius)*.85,dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
      if(d>=min)continue;
      const n=d>.01?{x:dx/d,z:dz/d}:normalize2(Math.sin(a.id),Math.cos(b.id)),force=Math.min(.12,(min-d)*.35);
      if(a.id!==this.activeHero.id)this.world.move(a,-n.x*force,-n.z*force);
      if(b.id!==this.activeHero.id)this.world.move(b,n.x*force,n.z*force);
    }
  }
  updatePickups(dt){
    const h=this.activeHero;
    for(const p of this.pickups){p.age+=dt;p.life-=dt;const d=distance(p,h);if(d<6&&d>.5){const speed=dt*(10+4*(6-d));p.x+=(h.x-p.x)/d*speed;p.z+=(h.z-p.z)/d*speed;}if(d<1.4){p.life=0;if(p.kind==='health')this.combat.heal(h,h,h.maxHp*p.value*.003);else h.focus=clamp(h.focus+p.value,0,h.maxFocus);this.emit('pickup',{pickup:p});}}
    this.pickups=this.pickups.filter(p=>p.life>0);
  }
  update(dt,input=EMPTY_INPUT){
    if(this.state!=='running'||this.disposed)return;
    dt=clamp(dt,0,.05);this.tick++;this.elapsed+=dt;
    this.switchGuardCooldown=Math.max(0,(this.switchGuardCooldown||0)-dt);
    this.world.update(dt);
    for(const e of this.allEntities)if(e.kind!=='object'||e.damageable)this.updatePhysics(e,dt);
    this.updatePlayer(dt,input);
    this.updateTasks(dt);
    if(!this.world.isHub){this.ai.enemies(dt);this.ai.companions(dt);this.ai.constructs(dt);this.updateProjectiles(dt);this.updateZones(dt);this.updateHazards(dt);this.separate(dt);this.updatePickups(dt);this.director.update(dt);}
    this.enemies=this.enemies.filter(e=>!e.dead||e.deathAge<12);this.constructs=this.constructs.filter(e=>!e.dead||e.deathAge<1.5);
    for(const r of this.world.rooms)if(distance(r,this.activeHero)<r.radius+15)this.profile.visited[`${this.mission.id}:${r.id}`]=true;
    if(!Number.isFinite(this.activeHero.x)||!Number.isFinite(this.activeHero.z))throw new Error('Non-finite character position');
  }
  dispose(){this.disposed=true;this.tasks=[];this.clear();}
}
function elementColor(e){return {storm:0xaf9cff,fire:0xffa05d,frost:0xa1eaff,earth:0xd7ab71,nature:0x9be48e,light:0xffe3a0,void:0xc193ff,shadow:0xaf82ee,wind:0xa1efdf,spirit:0xbacbff,arcane:0x8fbbff,physical:0xddc9b0}[e]||0xbbaaff;}
