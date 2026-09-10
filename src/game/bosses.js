import { angleTo, distance, normalize2, TAU, clamp } from '../core/math.js';
import { ELEMENTS } from '../data/heroes.js';

const COLORS = { physical:0xd7bd95, storm:0xaaa0ff, fire:0xff8845, frost:0x9feaff, nature:0x9bd677, void:0xb886ff, light:0xffdfa0, earth:0xcbaa72 };
/** Boss attacks modify space and movement rules, not only damage numbers. */
export class Bosses {
  constructor(sim) { this.sim=sim; }
  update(e,dt) {
    if(e.dead||e.spawnTime>0||e.stun>0||e.frozen>0)return;
    if(e.echo){this.echo(e,dt);return;}
    const phaseCount=e.definition.phases.length;
    const phase=Math.min(phaseCount-1,Math.floor((1-e.hp/e.maxHp)*phaseCount));
    if(phase>e.phase){e.phase=phase;this.phase(e);}
    if(e.action)return;
    const target=this.sim.nearestTarget(e,80);if(!target)return;
    e.angle=angleTo(e,target);
    const d=distance(e,target),r=this.sim.director?.room || this.sim.world.rooms[0];
    if(e.attackTimer>0){
      if(d>e.range && distance(e,r)<r.radius*.68 && !['astra','rootless'].includes(e.bossType))e.moving=this.sim.world.steer(e,target,dt,e.speed);
      return;
    }
    const moves=e.definition.moves,move=moves[e.moveIndex++%moves.length];
    e.attackTimer=Math.max(1.25,e.attackInterval-e.phase*.22);
    const fn=this[move];if(typeof fn!=='function')throw new Error(`Boss move has no implementation: ${move}`);
    fn.call(this,e,target,r);
  }
  phase(e) {
    const sim=this.sim;
    sim.emit('bossPhase',{boss:e,phase:e.phase,title:e.definition.phases[e.phase]});
    sim.emit('effect',{type:'shockwave',x:e.x,z:e.z,radius:14,color:COLORS[e.element]||0xba90ff});
    sim.emit('shake',{amount:.6});sim.emit('audio',{type:'bossPhase',x:e.x,z:e.z});
    e.invulnerable=1.1;e.attackTimer=1.8;e.stun=0;e.stagger=0;e.action=null;
    if(e.bossType==='ashking'){e.armor=Math.max(0,.14-e.phase*.07);e.speed+=.8;if(e.phase===2)e.weapon='gauntlets';}
    if(e.bossType==='colossus')this.stormfield(e,sim.activeHero,sim.director.room);
    if(e.bossType==='saint')this.mirrors(e,sim.activeHero,sim.director.room);
    if(e.bossType==='worldbeast'){const room=sim.director.room;sim.emit('toast',{text:e.phase===1?'The World Beast is wounded. It is guarding something beneath the ground.':'Break the corruption. Do not mistake the guardian for the enemy.'});this.roar(e,sim.activeHero,room);}
    if(e.bossType==='rootless')this.movingfloor(e,sim.activeHero,sim.director.room);
    if(e.bossType==='malthren')this.elements(e,sim.activeHero,sim.director.room);
    if(e.bossType==='astra'){this.shatterfloor(e,sim.activeHero,sim.director.room);sim.emit('skyPhase',{phase:e.phase});}
  }
  pose(e,kind,seconds=1.3) { e.action={kind:'windup',move:kind,duration:seconds,elapsed:0}; }
  warn(e,p,shape,delay,config={}) {
    return this.sim.hazard(e,{x:p.x,z:p.z,shape,warn:delay,damage:e.damage,element:e.element,color:COLORS[e.element],...config});
  }
  slam(e,target,room) {
    this.pose(e,'slam',1.55);
    this.warn(e,e,'circle',1.1,{radius:6.5+e.phase,damage:e.damage*1.25,launch:true,unblockable:true,visual:'impact'});
    if(e.phase>0)this.sim.schedule(1.2,()=>this.warn(e,e,'ring',.55,{radius:13,inner:8,damage:e.damage,visual:'shockwave',unblockable:true}),e.id);
  }
  cleave(e,target) {
    this.pose(e,'cleave',1.2);e.angle=angleTo(e,target);
    this.warn(e,e,'cone',.82,{radius:8.5,angle:e.angle,arc:2.4,damage:e.damage*1.2,parryable:true,visual:'cleave'});
    if(e.phase>=2)this.sim.schedule(.9,()=>{e.angle+=Math.PI;this.warn(e,e,'cone',.65,{radius:9,angle:e.angle,arc:2.8,damage:e.damage,parryable:true,visual:'cleave'});},e.id);
  }
  stormfield(e,target,room) {
    this.pose(e,'stormfield',1.5);
    const count=3+e.phase*2;
    for(let i=0;i<count;i++) {
      const p=i<2&&this.sim.party[i]?{x:this.sim.party[i].x,z:this.sim.party[i].z}:this.sim.world.point(room.id,i*2.399,.25+(i%3)*.22);
      this.warn(e,p,'circle',1.15+i*.18,{radius:2.8+e.phase*.25,damage:e.damage*1.25,element:'storm',color:0xa497ff,absorb:true,visual:'lightning',unblockable:true});
    }
  }
  charge(e,target,room) {
    this.pose(e,'charge',1.8);
    const dir=normalize2(target.x-e.x,target.z-e.z),from={x:e.x,z:e.z},length=Math.min(room.radius*1.3,distance(e,target)+7);
    const to={x:from.x+dir.x*length,z:from.z+dir.z*length},mid={x:(from.x+to.x)/2,z:(from.z+to.z)/2};
    e.angle=Math.atan2(dir.x,dir.z);
    this.warn(e,mid,'rect',1,{width:4.5,length,angle:e.angle,damage:e.damage*1.45,visual:'charge',unblockable:true,launch:true});
    this.sim.schedule(1,()=>{this.sim.world.move(e,dir.x*length,dir.z*length);e.vy=1.5;this.sim.emit('effect',{type:'dash',from,to:{x:e.x,z:e.z},color:COLORS[e.element],wide:true});},e.id);
  }
  shatterfloor(e,target,room) {
    this.pose(e,'shatterfloor',2.1);
    const points=[this.sim.world.point(room.id,e.moveIndex*.7,.8),this.sim.world.point(room.id,e.moveIndex*.7+Math.PI,.8)];
    for(const p of points){
      this.warn(e,p,'circle',1.75,{radius:4.5,damage:e.damage*1.5,element:e.bossType==='astra'?'storm':'earth',visual:'shatterfloor',unblockable:true,launch:true});
      this.sim.schedule(1.8,()=>{
        // A smaller actual hole than the warning gives players a generous safety margin.
        if(distance(this.sim.activeHero,p)<4.1){const d=normalize2(room.x-p.x,room.z-p.z);this.sim.world.move(this.sim.activeHero,d.x*5,d.z*5);}
        this.sim.world.holes.push({...p,radius:3.3,life:12});this.sim.emit('floorBreak',{...p,radius:4,life:12});
      },e.id);
    }
  }
  lavaring(e,target,room) {
    this.pose(e,'lavaring',1.2);
    this.warn(e,room,'ring',1.5,{radius:room.radius-1,inner:room.radius*(.57-e.phase*.06),damage:e.damage*.7,element:'fire',color:COLORS.fire,activeFor:7,interval:1,visual:'lava',unblockable:true});
    this.sim.emit('toast',{text:'Lava is rising. Find the cool stone near the center.'});
  }
  eruption(e,target,room) {
    this.pose(e,'eruption',1.3);
    for(let i=0;i<5+e.phase;i++){
      const p=i<2?{x:target.x+(i?4:-3),z:target.z}:this.sim.world.point(room.id,i*2.7,.4+(i%2)*.3);
      this.warn(e,p,'circle',1.25+i*.16,{radius:3,damage:e.damage*1.1,element:'fire',visual:'meteor',launch:true});
    }
  }
  frostfan(e,target) {
    this.pose(e,'frostfan',1.4);e.angle=angleTo(e,target);
    this.warn(e,e,'cone',.95,{radius:17,angle:e.angle,arc:1.45,damage:0,element:'frost',visual:'frostfan'});
    this.sim.schedule(.95,()=>{for(let i=0;i<7+e.phase*2;i++)this.sim.projectile(e,{angle:e.angle+(i-(6+e.phase*2)/2)*.18,speed:12+e.phase,range:24,power:.82,element:'frost',apply:true,freeze:e.phase>=2,radius:.55,visual:'ice'});},e.id);
  }
  timefreeze(e,target,room) {
    this.pose(e,'timefreeze',2);
    const safe=this.sim.world.point(room.id,e.moveIndex*1.7,.45);
    this.sim.emit('effect',{type:'sanctuary',x:safe.x,z:safe.z,radius:5,color:0xd4f4ff,life:3});
    this.sim.emit('toast',{text:'The clock is stopping. Reach the bright ward to keep your time.'});
    this.warn(e,room,'ring',2,{radius:room.radius,inner:0,damage:0,element:'frost',visual:'timefreeze',onImpact:()=>{
      for(const hero of this.sim.party)if(!hero.dead&&distance(hero,safe)>5&&hero.invulnerable<=0){hero.frozen=1.1;this.sim.emit('label',{text:'TIME FRACTURE',x:hero.x,z:hero.z,color:'#b8edff'});}
      this.sim.emit('grade',{element:'frost',duration:1.3});
    }});
    this.sim.schedule(2.35,()=>this.frostfan(e,this.sim.activeHero),e.id);
  }
  mirrors(e,target,room) {
    this.pose(e,'mirrors',1.2);
    for(let i=0;i<2+e.phase;i++){
      const p=this.sim.world.point(room.id,i*TAU/(2+e.phase)+.7,.7);
      this.sim.schedule(.5+i*.2,()=>{const echo=this.sim.spawnEnemy('wisp',p,{elite:true});if(echo){echo.element='frost';echo.name='Reflection of the Still Hour';echo.color=0xb3eaff;}this.sim.emit('effect',{type:'mirror',...p,radius:2,color:COLORS.frost});},e.id);
    }
  }
  iceprison(e,target) {
    this.pose(e,'iceprison',1.2);
    const p={x:target.x,z:target.z};
    this.warn(e,p,'circle',1.2,{radius:3.5,damage:e.damage*.65,element:'frost',visual:'iceprison',apply:true,freeze:true,activeFor:2.5,interval:1.3});
    for(let i=0;i<3;i++){const a=i*TAU/3;this.warn(e,{x:p.x+Math.sin(a)*6,z:p.z+Math.cos(a)*6},'circle',1.7,{radius:2,damage:e.damage*.8,element:'frost',visual:'ice'});}
  }
  pounce(e,target) {
    this.pose(e,'pounce',1.4);const p={x:target.x,z:target.z};
    this.warn(e,p,'circle',1.05,{radius:5,damage:e.damage*1.3,element:'nature',visual:'impact',launch:true});
    this.sim.schedule(.55,()=>{if(this.sim.world.isWalkable(p,e.radius)){e.x=p.x;e.z=p.z;e.y=7;e.vy=-8;}},e.id);
  }
  roots(e,target,room) {
    this.pose(e,'roots',1.4);
    for(let i=0;i<3+e.phase;i++){
      const a=i*Math.PI/(3+e.phase)+e.moveIndex*.45;
      this.warn(e,room,'rect',1+i*.13,{width:2.3,length:room.radius*1.8,angle:a,damage:e.damage*.9,element:e.bossType==='rootless'?'void':'nature',visual:'roots',root:true,activeFor:1.2,interval:1.3});
    }
  }
  roar(e,target,room) {
    this.pose(e,'roar',1.4);
    this.warn(e,e,'ring',1,{radius:14,inner:5,damage:e.damage*.7,element:'nature',visual:'shockwave',launch:true});
    if(this.sim.enemies.filter(t=>!t.dead&&t.kind!=='boss').length<4)for(let i=0;i<3;i++)this.sim.spawnEnemy('shardborn',this.sim.world.point(room.id,i*2.1,.8));
  }
  voidzones(e,target,room) {
    this.pose(e,'voidzones',1.5);
    for(let i=0;i<3+e.phase;i++) {
      const p=this.sim.world.point(room.id,i*2.399+e.moveIndex,.25+(i%3)*.25);
      this.warn(e,p,'circle',1.35,{radius:3.7,damage:e.damage*.55,element:'void',visual:'void',activeFor:7,interval:1,unblockable:true});
    }
  }
  summon(e,target,room) {
    this.pose(e,'summon',1.8);
    if(this.sim.enemies.filter(t=>!t.dead&&t.kind!=='boss').length>=6)return;
    for(let i=0;i<3;i++)this.sim.schedule(.6+i*.25,()=>this.sim.spawnEnemy(e.bossType==='malthren'?'guardian':e.bossType==='rootless'?'stalker':'legionary',this.sim.world.point(room.id,i*2.1+.4,.75)),e.id);
    this.sim.emit('effect',{type:'summon',x:e.x,z:e.z,radius:6,color:COLORS[e.element]});
  }
  movingfloor(e,target,room) {
    this.pose(e,'movingfloor',1.6);this.sim.emit('groundPulse',{duration:8,amount:.5});
    for(let i=0;i<4;i++)this.warn(e,{x:room.x-15+i*10,z:room.z},'rect',1.2+i*.5,{width:4,length:room.radius*1.8,angle:0,damage:e.damage*.7,element:'void',visual:'roots',activeFor:1.7,interval:1.7,launch:true});
  }
  blinkstrike(e,target) {
    const old={x:e.x,z:e.z},dir=normalize2(target.x-e.x,target.z-e.z),p={x:target.x+dir.x*3,z:target.z+dir.z*3};
    this.pose(e,'blinkstrike',1.3);
    this.warn(e,p,'circle',.9,{radius:4,damage:e.damage*1.3,element:'storm',visual:'lightning',parryable:true});
    this.sim.schedule(.45,()=>{if(this.sim.world.isWalkable(p,e.radius)){e.x=p.x;e.z=p.z;e.angle=angleTo(e,target);}this.sim.emit('effect',{type:'bolt',from:{...old,y:1.5},to:{x:e.x,y:1.5,z:e.z},color:COLORS.storm,width:.12});},e.id);
  }
  stormwall(e,target,room) {
    this.pose(e,'stormwall',1.4);
    const gapZ=room.z+(e.moveIndex%3-1)*5;
    // Two moving sections leave a six-unit passage; dodge is an alternative.
    for(const side of [-1,1]){
      const z=gapZ+side*10;
      this.warn(e,{x:room.x-18,z},'rect',1.35,{width:1.8,length:13,angle:0,damage:e.damage*.95,element:'storm',visual:'stormwall',activeFor:11,interval:.9,velocity:{x:3.2,z:0},unblockable:true});
    }
    this.sim.emit('toast',{text:'The stormwall has a gap. Cross through it or evade through the lightning.'});
  }
  counter(e) {
    this.pose(e,'counter',2.1);e.buffs.counter=2.3;e.armor=.3;
    this.sim.emit('effect',{type:'shield',x:e.x,z:e.z,radius:3,color:COLORS.void,life:2});
    this.sim.emit('label',{text:'COUNTER STANCE',x:e.x,z:e.z,color:'#c9b0ff'});
    this.sim.schedule(2.3,()=>{e.armor=.1;},e.id);
  }
  hurricane(e,target,room) {
    this.pose(e,'hurricane',1.8);
    this.warn(e,e,'ring',1.6,{radius:16,inner:4,damage:e.damage*.65,element:'storm',visual:'hurricane',activeFor:5,interval:1,unblockable:true});
    for(let i=0;i<3;i++)this.warn(e,this.sim.world.point(room.id,i*2.1,.55),'circle',2+i*.3,{radius:2.5,damage:e.damage,element:'storm',visual:'lightning',absorb:true});
  }
  elements(e,target,room) {
    const elements=['fire','frost','storm','earth','void'];e.element=elements[e.moveIndex%5];
    this.sim.emit('bossElement',{element:e.element,boss:e});
    if(e.element==='fire')this.lavaring(e,target,room);
    else if(e.element==='frost')this.frostfan(e,target,room);
    else if(e.element==='storm')this.stormfield(e,target,room);
    else if(e.element==='earth')this.roots(e,target,room);
    else this.voidzones(e,target,room);
  }
  crownbeam(e,target,room) {
    this.pose(e,'crownbeam',2);
    const angle=angleTo(e,target),dir={x:Math.sin(angle),z:Math.cos(angle)},length=room.radius*2;
    const p={x:e.x+dir.x*length*.4,z:e.z+dir.z*length*.4};
    this.warn(e,p,'rect',1.35,{width:4.3,length,angle,damage:e.damage*1.2,element:e.element,visual:'crownbeam',activeFor:1.2,interval:.65,unblockable:true});
    if(e.phase>=2)this.warn(e,room,'rect',1.85,{width:3,length:room.radius*2,angle:angle+Math.PI/2,damage:e.damage,element:'void',visual:'crownbeam',activeFor:.8,interval:1,unblockable:true});
  }
  skyhand(e,target,room) {
    this.pose(e,'skyhand',2.5);
    const p={x:target.x,z:target.z};
    this.sim.emit('skyHand',{...p,side:e.moveIndex%2,delay:2.1});
    this.warn(e,p,'circle',2.1,{radius:7.5,damage:e.damage*1.6,element:'storm',visual:'skyhand',unblockable:true,launch:true});
    this.sim.schedule(2.3,()=>this.warn(e,p,'ring',.55,{radius:15,inner:8,damage:e.damage*.85,element:'storm',visual:'shockwave',unblockable:true}),e.id);
  }
  echo(e,dt) {
    const sim=this.sim,t=sim.nearestTarget(e,60);if(!t)return;
    e.judgment=clamp(e.judgment+dt*3.5,0,100);e.focus=clamp(e.focus+dt*8,0,e.maxFocus);
    if(e.action)return;
    e.angle=angleTo(e,t);
    const d=distance(e,t);
    if(e.judgment>=100 && e.hp/e.maxHp<.65 && e.attackTimer<=0){
      sim.emit('toast',{text:`${e.definition.short} is invoking ${e.definition.skills[2].name}. Make space.`});
      this.warn(e,t,'circle',1.2,{radius:7,damage:0,element:e.element,visual:'none'});
      e.attackTimer=1.4;this.sim.schedule(1.2,()=>sim.abilities.cast(e,2,t),e.id);return;
    }
    if(e.attackTimer<=0 && e.focus>25){const slot=e.cooldowns[0]<=0?0:e.cooldowns[1]<=0?1:-1;if(slot>=0 && sim.rng()<.5){sim.abilities.cast(e,slot,t);return;}}
    if(d>Math.min(e.range,10)*.8)e.moving=sim.world.steer(e,t,dt,e.speed);
    else if(e.attackTimer<=0)sim.combat.attack(e,sim.rng()<.27,e.angle);
  }
}
