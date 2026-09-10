import { HEROES, HERO_BY_ID, ELEMENTS } from '../data/heroes.js';
import { ENEMY_POOLS } from '../data/enemies.js';
import { CHOICES, choiceOptions } from '../data/dialogue.js';
import { LORE } from '../data/lore.js';
import { makeObject, makeCivilian, makeHero, makeEcho } from './entities.js';
import { storyCount, recordChoice } from './progression.js';
import { clamp, distance, angleTo, normalize2, TAU, shuffle } from '../core/math.js';

export const STAGE_TYPES = Object.freeze(['fight','rescue','defend','escort','sabotage','collect','relay','escape','boss','oath','choice','anchors','trial','eleven']);
const GLYPHS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ'];
const BOONS = [
  {id:'edge',name:'A Sharper Oath',text:'All three signature weapons deal 12% more damage for this trial.'},
  {id:'shelter',name:'A Place to Stand',text:'Restore the party, replenish one remedy, and gain a 20% barrier.'},
  {id:'storm',name:'The Storm Within',text:'Fill every Judgment meter and increase Focus recovery by 15%.'},
];

/** Executes every authored stage against the same combat and navigation simulation.
 *  Checkpoints are stage boundaries, so reloading never resets rewards while retaining kills.
 */
export class MissionDirector {
  constructor(sim, checkpoint = null) {
    this.sim=sim;this.mission=sim.mission;this.index=checkpoint?.stage || 0;
    this.stage=null;this.room=sim.world.rooms[this.index];this.started=false;this.complete=false;
    this.clock=0;this.wave=0;this.nextWave=0;this.progress=0;this.goal=0;this.required=[];
    this.prompt='';this.waitingChoice=false;this.optional=new Set(checkpoint?.optional || []);
    this.elapsed=checkpoint?.elapsed || 0;this.modifierTimer=8;
    this.buildOptional();
    if(sim.world.isHub) this.buildHub();
  }
  get liveEnemies() {return this.sim.enemies.filter(e=>!e.dead && e.encounter===this.index);}
  get objective() {
    if(this.sim.world.isHub)return {title:'The Warden',text:'A home between the storms',progress:0,goal:0};
    if(!this.started)return {title:this.mission.stages[this.index]?.title || 'Return to the Warden',text:'Follow the gold path to the next encounter',progress:0,goal:0,travel:true};
    const type=this.stage.type;
    const descriptions={fight:`Defeat the invaders · wave ${this.wave}/${this.goal}`,rescue:'Free the captives [F] and guide them to the gold beacon',defend:'Stay near the tower to restore its ward. Protect the core.',escort:'Stay near the transport. Clear ambushes and guard its hull.',sabotage:'Shatter the three Imperial devices',collect:'Recover the scattered records [F]',relay:`Awaken the seals in order: ${this.sequence?.map(i=>GLYPHS[i]).join(' → ')}`,escape:'Follow the escape beacons before the catastrophe catches you',boss:'Read the attack warnings. Blue lightning can be absorbed by Rael.',oath:'Claim the fragment’s memory [F]',choice:'A decision the Warden will carry',anchors:'Approach an anchor [F], then cast its first ability [Q] inside the sigil',trial:`Storm Trial · wave ${this.wave}/${this.goal}`,eleven:`The Eleven · encounter ${this.wave}/9`};
    const p=['fight','boss','trial','eleven'].includes(type)?this.sim.stats.kills:this.progress;
    return {title:this.stage.title,text:descriptions[type]||'',progress:p,goal:this.goal,type,index:this.index,total:this.mission.stages.length,
      timer:type==='escape'?Math.max(0,this.timeLimit-this.clock):null,charge:type==='defend'?this.progress/this.goal:null,
      remaining:this.liveEnemies.length,sequence:this.sequence,sequenceProgress:this.sequenceProgress || 0};
  }
  buildOptional() {
    for(const p of this.sim.world.optional){
      const e=makeObject(p.kind==='reliquary'?'cache':p.kind,p,{label:p.label,key:p.id,optional:true,roomId:p.room,color:p.kind==='cache'?0xd8b67c:0x99caff});
      e.used=this.optional.has(p.id);this.sim.objects.push(e);
    }
  }
  buildHub() {
    const sim=this.sim;this.started=true;
    const fixtures=[['board',0,-12,'Chart a course'],['forge',-6,-3,'The signature forge'],['codex',6,-5,'The ship’s archive'],['training',0,18,'Practice on the aft deck']];
    for(const [kind,x,z,label] of fixtures)sim.objects.push(makeObject(kind,{x,z},{label,color:kind==='forge'?0xe4aa69:0xb1a2ff}));
    const count=storyCount(sim.profile),positions=[[-6,8],[6,8],[-7,-16],[7,-16],[-6,16],[6,16],[-7,1],[7,1],[-4,-22],[4,-22],[0,-24]];
    for(const id of sim.profile.unlocked){
      if(id===sim.activeHero.heroId)continue;
      const n=HEROES.findIndex(h=>h.id===id),p=positions[n],h=makeHero(id,sim.profile,{x:p[0],z:p[1]},-1);
      h.kind='figure';h.team='neutral';h.interactable=true;h.label=`Speak with ${h.short}`;h.angle=p[0]<0?Math.PI*.3:-Math.PI*.3;
      if(count>=24 && ['sera','brann'].includes(id)){h.x=id==='sera'?-5:-7;h.z=10;h.angle=id==='sera'?-Math.PI/2:Math.PI/2;}
      sim.figures.push(h);
    }
  }
  start() {
    if(this.complete || this.sim.world.isHub)return;
    const sim=this.sim;
    this.stage=this.mission.stages[this.index];this.room=sim.world.rooms[this.index];
    if(!this.stage || !STAGE_TYPES.includes(this.stage.type))throw new Error(`Unhandled mission stage ${this.mission.id}:${this.index}`);
    this.started=true;this.clock=0;this.wave=0;this.progress=0;this.nextWave=0;this.required=[];this.sequence=null;this.sequenceProgress=0;
    this.waitingChoice=false;this.goal=1;this.boss=null;this.transport=null;
    sim.emit('stage',{stage:this.stage,index:this.index,room:this.room,total:this.mission.stages.length});
    if(!sim.resuming)sim.emit('checkpoint',{checkpoint:this.checkpoint()});
    sim.resuming=false;
    this[`start_${this.stage.type}`]();
  }
  spawnWave(count=6,elite=false,types=null) {
    const sim=this.sim,pool=types || ENEMY_POOLS[this.mission.region] || ENEMY_POOLS[0];
    const live=sim.enemies.filter(e=>!e.dead).length;count=Math.min(count,22-live);
    for(let n=0;n<count;n++){
      const a=(n/Math.max(1,count))*TAU+this.wave*.7+sim.rng()*.35,p=sim.world.point(this.index,a,.68+sim.rng()*.12);
      let type=pool[(n+this.wave+Math.floor(sim.rng()*pool.length))%pool.length];
      if(this.mission.id==='s01'&&this.index===0)type=n===count-1&&this.wave===2?'shield':'legionary';
      const e=sim.spawnEnemy(type,p,{elite:elite&&n===count-1});if(e)e.encounter=this.index;
    }
    sim.emit('reinforcements',{wave:this.wave});
  }
  object(kind,angle,proportion,properties={}) {
    const p=this.sim.world.point(this.index,angle,proportion),e=makeObject(kind,p,{stage:this.index,roomId:this.index,...properties});
    this.sim.objects.push(e);this.required.push(e);return e;
  }
  start_fight(){this.goal=this.mission.id==='s01'&&this.index===0?2:2+(this.mission.level>14?1:0);this.wave=1;this.spawnWave(this.mission.id==='s01'?5:6+Math.floor(this.mission.level/10));}
  start_rescue(){
    this.goal=3;
    for(let i=0;i<3;i++)this.object('cage',Math.PI*.65+i*1.9,.53,{label:'Free the captive',captiveId:i,color:0xd9be82});
    this.exitPoint=this.sim.world.exit(this.index);this.sim.objects.push(makeObject('beacon',this.exitPoint,{stage:this.index,roomId:this.index,interactable:false,label:'Safety',color:0xe5c180}));
    this.spawnWave(6,true);this.wave=1;
  }
  start_defend(){
    this.goal=this.mission.id==='s01'?44:60+(this.mission.level>18?12:0);
    this.anchor=this.object('anchor',0,0,{label:'Lightning ward',team:'friendly',damageable:true,hp:2800+this.mission.level*90,maxHp:2800+this.mission.level*90,interactable:false,color:0xb9b0ff});
    this.wave=1;this.spawnWave(5);this.nextWave=16;
  }
  start_escort(){
    const p=this.sim.world.point(this.index,Math.PI*.65,.6);
    this.transport=makeCivilian(p,{name:'Warden evacuation transport',short:'Transport',objectType:'transport',maxHp:3600+this.mission.level*100,hp:3600+this.mission.level*100,speed:2.3,scale:1.6,radius:1.2,label:'Repair transport · 25 Focus',interactable:true,stage:this.index});
    this.sim.civilians.push(this.transport);this.route=[this.sim.world.point(this.index,Math.PI*.9,.35),this.sim.world.point(this.index,Math.PI*1.35,.5),this.sim.world.point(this.index,Math.PI*1.8,.35),this.sim.world.exit(this.index)];
    this.goal=this.route.length;this.wave=1;this.spawnWave(5);this.nextWave=1;
  }
  start_sabotage(){
    this.goal=3;
    for(let i=0;i<3;i++)this.object('device',i*TAU/3+1,.48,{label:'Imperial siphon',hp:450+this.mission.level*28,color:0xff846a});
    this.wave=1;this.spawnWave(7,true);
  }
  start_collect(){this.goal=3;for(let i=0;i<3;i++)this.object('ledger',i*TAU/3+1.3,.53,{label:'Recover the record',color:0xe1c8a0});this.wave=1;this.spawnWave(5,true);}
  start_relay(){
    const n=this.mission.region>1?4:3;this.goal=n;this.sequence=shuffle([...Array(n).keys()],this.sim.rng);
    for(let i=0;i<n;i++)this.object('obelisk',i*TAU/n+.7,.52,{label:`Awaken seal ${GLYPHS[i]}`,glyph:GLYPHS[i],seal:i,color:0x9eabff});
    this.wave=1;this.spawnWave(4);this.sim.emit('toast',{text:`Seal order: ${this.sequence.map(i=>GLYPHS[i]).join(' → ')}. Use F beside each obelisk.`});
  }
  start_escape(){
    this.goal=4;this.timeLimit=76;this.route=[];
    for(let i=0;i<4;i++){const p=this.sim.world.point(this.index,1.2+i*1.75,i===3?.2:.59);this.route.push(p);const e=makeObject('escapeBeacon',p,{stage:this.index,roomId:this.index,label:`Escape beacon ${i+1}`,interactable:false,color:0xe9c57d,sequence:i});this.sim.objects.push(e);this.required.push(e);}
    this.spawnWave(6);this.nextWave=13;this.catastrophe=3;
  }
  start_boss(){
    const p=this.sim.world.point(this.index,Math.PI,.25);this.boss=this.sim.spawnBoss(this.stage.param,p);
    this.boss.encounter=this.index;this.boss.arena=this.index;this.goal=1;
    if(this.mission.id==='s01')for(const h of this.sim.party)h.judgment=100;
    this.sim.emit('bossIntro',{boss:this.boss});
  }
  start_oath(){this.object('fragment',0,0,{label:'Claim the memory',color:ELEMENTS[['storm','fire','frost','nature','void'][this.mission.region]].hex});}
  start_choice(){this.object('decision',0,0,{label:'Face the choice',color:0xddc69b});}
  start_anchors(){
    this.goal=11;const sim=this.sim;
    for(let i=0;i<HEROES.length;i++){
      const h=HEROES[i],e=this.object('oathAnchor',i*TAU/11,.65,{label:`Take ${h.short}’s place in the oath`,heroId:h.id,glyph:ELEMENTS[h.element].glyph,color:h.colorHex});
      const figure=makeHero(h.id,sim.profile,{x:e.x,z:e.z},-1);figure.kind='figure';figure.team='neutral';figure.angle=angleTo(figure,this.room);figure.anchorFigure=true;figure.heroAnchor=e.id;sim.figures.push(figure);
    }
    for(const h of sim.party){h.hp=h.maxHp;h.focus=h.maxFocus;h.judgment=100;}
    sim.emit('toast',{text:'Eleven people. Eleven choices to stay. Enter each sigil, press F, then Q to share the Crown.'});
    sim.emit('skyPhase',{phase:3});
  }
  start_trial(){
    this.goal=Math.min(12,4+Math.floor(this.mission.tier/3));this.wave=1;this.spawnWave(6+Math.min(10,this.mission.tier),true);this.trialBoon=false;
  }
  start_eleven(){
    this.echoes=HEROES.filter(h=>!this.sim.party.some(p=>p.heroId===h.id)).map(h=>h.id);this.goal=9;this.wave=1;this.spawnEcho();
  }
  spawnEcho(){
    const ids=this.wave===9?['rael','lucen']:[this.echoes[this.wave-1]];
    ids.forEach((id,i)=>{const p=this.sim.world.point(this.index,Math.PI+(i-.5)*.9,.4),e=makeEcho(id,p,this.mission.level,this.sim.difficulty);e.encounter=this.index;this.sim.enemies.push(e);this.sim.emit('spawn',{entity:e});this.sim.emit('bossIntro',{boss:e});});
  }
  update(dt){
    if(this.complete||this.sim.world.isHub)return;
    this.elapsed+=dt;
    if(!this.started){if(distance(this.sim.activeHero,this.room)<this.room.radius*.91)this.start();return;}
    if(this.waitingChoice)return;
    this.clock+=dt;
    this[`update_${this.stage.type}`]?.(dt);
    if(this.sim.state!=='running')return;
    if(this.mission.kind==='trial'||this.sim.profile.crownfall)this.updateModifier(dt);
  }
  update_fight(){if(!this.liveEnemies.length){if(this.wave>=this.goal)this.finishStage();else if(this.nextWave===0){this.nextWave=this.clock+2.4;this.sim.emit('toast',{text:'Reinforcements are approaching.'});}else if(this.clock>=this.nextWave){this.nextWave=0;this.wave++;this.spawnWave(6+Math.floor(this.mission.level/9),true);}}}
  update_rescue(dt){
    const sim=this.sim;this.progress=0;
    for(const c of sim.civilians.filter(e=>e.stage===this.index && !e.objectType)){
      if(c.dead){sim.fail('A captive fell before reaching safety.');return;}
      if(c.safe){this.progress++;continue;}
      if(distance(c,sim.activeHero)<13 && !this.liveEnemies.some(e=>distance(e,c)<2.7)){
        c.angle=angleTo(c,this.exitPoint);c.moving=sim.world.steer(c,this.exitPoint,dt,c.speed);
      }else c.moving=false;
      if(distance(c,this.exitPoint)<2){c.safe=true;c.interactable=false;this.progress++;sim.stats.rescues++;sim.rescueBonus+=sim.relics.rescuePower||0;sim.emit('label',{text:'SAFE',x:c.x,z:c.z,color:'#c9e6bf'});}
    }
    if(this.progress>=this.goal)this.finishStage();
  }
  update_defend(dt){
    if(this.anchor.dead){this.sim.fail('The ward shattered. The people behind it need another chance.');return;}
    const near=distance(this.sim.activeHero,this.anchor)<9,contested=this.liveEnemies.some(e=>distance(e,this.anchor)<3.5);
    if(near)this.progress+=dt*(contested?.35:1);
    if(this.clock>=this.nextWave && this.progress<this.goal){this.nextWave=this.clock+17;this.wave++;this.spawnWave(5+Math.min(3,this.wave),this.wave>2);}
    this.anchor.progress=this.progress/this.goal;
    if(this.progress>=this.goal)this.finishStage();
  }
  update_escort(dt){
    const c=this.transport;if(c.dead){this.sim.fail('The evacuation transport was lost.');return;}
    c.repairCooldown=Math.max(0,(c.repairCooldown||0)-dt);
    const target=this.route[Math.min(this.progress,this.goal-1)],clear=!this.liveEnemies.some(e=>distance(e,c)<4.5);
    if(distance(this.sim.activeHero,c)<10 && clear){c.angle=angleTo(c,target);c.moving=this.sim.world.steer(c,target,dt,c.speed);}else c.moving=false;
    if(distance(c,target)<2){this.progress++;if(this.progress>=this.goal){this.finishStage();return;}if(this.progress>=this.nextWave){this.nextWave++;this.wave++;this.spawnWave(5,true);}}
  }
  update_sabotage(){this.progress=this.required.filter(e=>e.dead||e.used).length;if(this.progress>=this.goal)this.finishStage();}
  update_collect(){this.progress=this.required.filter(e=>e.used).length;if(this.progress>=this.goal)this.finishStage();}
  update_relay(){
    if(this.clock>30 && this.required[this.sequence[this.sequenceProgress]])this.required[this.sequence[this.sequenceProgress]].hint=true;
    if(this.progress>=this.goal)this.finishStage();
  }
  update_escape(dt){
    const p=this.route[this.progress];if(p&&distance(this.sim.activeHero,p)<3){this.required[this.progress].used=true;this.progress++;this.sim.emit('audio',{type:'checkpoint'});}
    if(this.progress>=this.goal){this.finishStage();return;}
    if(this.clock>=this.timeLimit){this.sim.fail('The escape route vanished into the storm.');return;}
    this.catastrophe-=dt;if(this.catastrophe<=0){this.catastrophe=3.8;const hero=this.sim.activeHero,pos={x:hero.x,z:hero.z};this.sim.hazard(this.sim.environment,{...pos,shape:'circle',radius:3.5,warn:1.75,damage:hero.maxHp*.22,element:this.mission.region===1?'fire':'void',visual:this.mission.region===1?'eruption':'lightning',unblockable:true});}
    if(this.clock>this.nextWave){this.nextWave+=18;this.wave++;this.spawnWave(3);}
  }
  update_boss(){if(this.boss?.dead)this.finishStage();}
  update_oath(){}
  update_choice(){}
  update_anchors(){if(this.progress>=this.goal && !this.finishing){this.finishing=true;this.sim.emit('oathComplete',{});this.sim.schedule(4,()=>this.finishStage(),0,true);}}
  update_trial(){
    if(this.liveEnemies.length||this.trialBoon)return;
    if(this.wave>=this.goal){this.finishStage();return;}
    if(this.wave%2===0){this.offerBoon(()=>this.advanceTrial());return;}
    this.advanceTrial();
  }
  advanceTrial(){
    this.wave++;this.trialBoon=false;
    if(this.wave===this.goal){const types=['colossus','ashking','saint','rootless','malthren'];const e=this.sim.spawnBoss(types[this.mission.region],this.sim.world.point(this.index,Math.PI,.42),.75+this.mission.tier*.025);e.encounter=this.index;this.sim.emit('bossIntro',{boss:e});this.spawnWave(4,true);}
    else this.spawnWave(7+Math.min(11,this.mission.tier),true);
    this.sim.emit('toast',{text:`Wave ${this.wave} · ${this.mission.modifier?.name || 'The storm deepens'}`});
  }
  update_eleven(){
    if(this.liveEnemies.length||this.trialBoon)return;
    if(this.wave>=9){this.finishStage();return;}
    this.offerBoon(()=>{this.wave++;this.trialBoon=false;this.spawnEcho();});
  }
  offerBoon(next){this.trialBoon=true;this.waitingChoice=true;this.sim.emit('boon',{options:BOONS,choose:id=>{if(!this.waitingChoice)return;const sim=this.sim;for(const h of sim.party){if(h.dead)sim.revive(h,.5);if(id==='edge')h.damage*=1.12;if(id==='shelter'){h.hp=h.maxHp;h.shield=h.maxHp*.2;h.shieldTime=999;}if(id==='storm'){h.judgment=100;h.stats.focusRegen*=1.15;}}if(id==='shelter')sim.remedies=Math.min(5,sim.remedies+1);this.waitingChoice=false;next();}});}
  updateModifier(dt){
    this.modifierTimer-=dt;if(this.modifierTimer>0)return;
    this.modifierTimer=10;const sim=this.sim,h=sim.activeHero,mod=sim.modifier;
    if(mod==='lava'||sim.profile.crownfall){for(let i=0;i<3;i++){const p=i===0?h:sim.world.point(this.index,sim.rng()*TAU,.65);sim.hazard(sim.environment,{x:p.x,z:p.z,shape:'circle',radius:3,warn:1.65+i*.2,damage:h.maxHp*.18,element:'fire',visual:'eruption',unblockable:true});}}
    if(mod==='frost'){for(const e of [...sim.party,...this.liveEnemies])e.statuses.frost=3;sim.emit('effect',{type:'blizzard',x:this.room.x,z:this.room.z,radius:this.room.radius,color:0xbdefff,life:3});}
    if(mod==='priests'&&!this.liveEnemies.some(e=>e.enemyType==='priest')){const e=sim.spawnEnemy('priest',sim.world.point(this.index,sim.rng()*TAU,.7));if(e)e.encounter=this.index;}
    if(mod==='walls'){const p=sim.world.point(this.index,Math.PI/2,.7);sim.hazard(sim.environment,{...p,shape:'rect',width:2.2,length:this.room.radius*1.5,angle:0,warn:1.8,activeFor:8,interval:.8,vx:-3,damage:h.maxHp*.16,element:'storm',visual:'stormwall',unblockable:true});}
  }
  canInteract(e){return e&&!e.used&&!e.dead&&e.interactable&&(e.stage===undefined||e.stage===this.index||e.optional);}
  nearestInteraction(){
    const sim=this.sim;return [...sim.objects,...sim.figures,...sim.civilians].filter(e=>this.canInteract(e)&&distance(e,sim.activeHero)<(e.objectType==='transport'?4:3.3)).sort((a,b)=>distance(a,sim.activeHero)-distance(b,sim.activeHero))[0] || null;
  }
  interact(target=this.nearestInteraction()){
    const sim=this.sim;if(!this.canInteract(target)||distance(target,sim.activeHero)>4.2)return false;
    const kind=target.objectType;
    if(target.kind==='figure'){sim.emit('talk',{heroId:target.heroId});return true;}
    if(['board','forge','codex','training'].includes(kind)){sim.emit('hubAction',{action:kind});return true;}
    if(target.optional){
      target.used=true;this.optional.add(target.key);sim.stats.optional++;
      if(kind==='cache'){sim.remedies=Math.min(5,sim.remedies+1);for(const h of sim.party)sim.combat.heal(h,h,h.maxHp*.25);sim.emit('toast',{text:'Warden cache · +1 remedy, party restored, bonus Aether on mission completion.'});}
      else {const lore=LORE.filter(l=>l.at<=storyCount(sim.profile)+2).find(l=>!sim.profile.lore.includes(l.id));if(lore)sim.profile.lore.push(lore.id);sim.emit('memory',{lore});}
      sim.emit('effect',{type:'claim',x:target.x,z:target.z,color:target.color,radius:3});return true;
    }
    if(kind==='transport'){
      if(target.repairCooldown>0){sim.emit('toast',{text:'Repairs need a moment to settle.'});return false;}
      if(sim.activeHero.focus<25){sim.emit('toast',{text:'Repairing the transport costs 25 Focus.'});return false;}
      sim.activeHero.focus-=25;target.repairCooldown=10;sim.combat.heal(sim.activeHero,target,target.maxHp*.22);return true;
    }
    if(['cage','ledger','device'].includes(kind) && this.liveEnemies.some(e=>distance(e,target)<4.3)){
      sim.emit('toast',{text:kind==='device'?'The device is guarded. Break it with attacks, or defeat its defenders.':'Defeat the guards close to this objective first.'});return false;
    }
    if(kind==='cage'){
      target.used=true;const c=makeCivilian({x:target.x,z:target.z},{name:'Freed captive',following:true,interactable:false,stage:this.index});sim.civilians.push(c);sim.emit('spawn',{entity:c});
      sim.emit('toast',{text:'Captive freed. Stay close and lead them to the gold beacon.'});return true;
    }
    if(kind==='ledger'){target.used=true;sim.emit('label',{text:'RECORD RECOVERED',x:target.x,z:target.z,color:'#efd7a6'});return true;}
    if(kind==='device'){sim.combat.damage(sim.activeHero,target,target.maxHp*3,{element:sim.activeHero.element,heavy:true});return true;}
    if(kind==='obelisk'){
      if(target.seal===this.sequence[this.sequenceProgress]){target.used=true;target.hint=false;this.sequenceProgress++;this.progress=this.sequenceProgress;sim.emit('effect',{type:'claim',x:target.x,z:target.z,color:0xb6baff,radius:4});sim.emit('audio',{type:'rune',note:this.sequenceProgress});}
      else{this.sequenceProgress=0;this.progress=0;for(const seal of this.required){seal.used=false;seal.hint=false;}this.wave++;this.spawnWave(2);sim.emit('toast',{text:'The seals reject the sequence. Read the order beneath the objective.'});}
      return true;
    }
    if(kind==='fragment'){target.used=true;sim.emit('effect',{type:'claim',x:target.x,z:target.z,color:target.color,radius:8});this.finishStage();return true;}
    if(kind==='decision'){
      if(this.waitingChoice)return false;
      this.waitingChoice=true;const key=this.stage.param||'cathedral';
      sim.emit('choice',{...CHOICES[key],kind:key,options:choiceOptions(key,sim.profile),choose:id=>this.choose(id)});return true;
    }
    if(kind==='oathAnchor'){
      if(!this.started)return false;
      sim.assumeAnchor(target.heroId,{x:target.x,z:target.z});this.attuned=target.id;
      sim.emit('toast',{text:`${HERO_BY_ID[target.heroId].short} · cast ${HERO_BY_ID[target.heroId].skills[0].name} [Q] to share the burden.`});return true;
    }
    return false;
  }
  choose(id){
    if(this.stage?.type!=='choice'||!this.waitingChoice)return false;
    const key=this.stage.param||'cathedral',option=choiceOptions(key,this.sim.profile).find(o=>o.id===id&&!o.locked);if(!option)return false;
    recordChoice(this.sim.profile,key,id);if(id==='take')this.sim.profile.shards+=12;
    this.waitingChoice=false;for(const e of this.required)e.used=true;
    this.sim.emit('dialogue',{lines:[option.line],after:()=>this.finishStage()});return true;
  }
  abilityUsed(e,slot,castOrigin=e){
    if(this.stage?.type!=='anchors'||slot!==0||e.id!==this.sim.activeHero.id)return;
    const anchor=this.required.find(o=>o.heroId===e.heroId&&!o.used&&distance(o,castOrigin)<4);
    if(!anchor||this.attuned!==anchor.id)return;
    anchor.used=true;anchor.bound=true;this.progress++;
    this.sim.emit('anchorBound',{heroId:e.heroId,anchor,count:this.progress});
    this.sim.emit('effect',{type:'skybolt',x:anchor.x,z:anchor.z,color:anchor.color,radius:4,width:.18,height:48});
    this.sim.emit('label',{text:`${HERO_BY_ID[e.heroId].short.toUpperCase()} · ${this.progress}/11`,x:e.x,z:e.z,color:HERO_BY_ID[e.heroId].color,large:true});
  }
  finishStage(){
    if(this.complete||!this.started)return;
    const sim=this.sim,index=this.index;
    for(const e of this.liveEnemies){e.dead=true;e.deathAge=10;}
    for(const e of sim.objects.filter(o=>o.stage===index)){e.used=true;e.interactable=false;}
    for(const c of sim.civilians.filter(c=>c.stage===index)){c.interactable=false;c.damageable=false;if(!c.dead)c.safe=true;}
    sim.hazards=[];sim.zones=[];sim.projectiles=[];sim.tasks=sim.tasks.filter(t=>t.persist);
    sim.world.holes=[];
    for(const h of sim.party){if(h.dead)sim.revive(h,.45);else sim.combat.heal(h,h,h.maxHp*.22);h.focus=h.maxFocus;h.stamina=100;h.lastStandUsed=false;h.cooldowns=h.cooldowns.map(v=>Math.min(v,2));}
    sim.emit('stageComplete',{stage:this.stage,index});sim.emit('audio',{type:'checkpoint'});
    if(index===this.mission.stages.length-1){
      this.complete=true;sim.state='victory';sim.stats.time=this.elapsed;sim.stats.maxHealth=sim.party.reduce((a,h)=>a+h.maxHp,0);
      sim.emit('missionComplete',{mission:this.mission,result:{...sim.stats,time:this.elapsed}});return;
    }
    this.index++;this.room=sim.world.rooms[this.index];this.started=false;this.stage=null;this.required=[];this.clock=0;
    sim.remedies=Math.min(5,sim.remedies+(index%2===1?1:0));
    sim.emit('checkpoint',{checkpoint:this.checkpoint()});
    sim.emit('toast',{text:'Oathstone secured · checkpoint saved. Follow the gold path.'});
  }
  checkpoint(){
    const sim=this.sim;
    return {mission:this.mission.id,stage:this.index,seed:sim.seed,party:sim.party.map(h=>h.heroId),active:sim.activeIndex,
      resources:sim.party.map(h=>({hp:h.dead?.45:clamp(h.hp/h.maxHp,.2,1),focus:h.focus,judgment:h.judgment})),
      remedies:sim.remedies,elapsed:this.elapsed,optional:[...this.optional],crownfall:sim.profile.crownfall,stats:{...sim.stats}};
  }
}
