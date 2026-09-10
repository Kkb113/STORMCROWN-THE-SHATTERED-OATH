import { MissionDirector } from './director.js';
import { makeObject } from './entities.js';
import { BOSSES } from '../data/enemies.js';
import { CAMPAIGN } from '../data/campaign.js';
import { levelForXP } from './progression.js';

export function knownBosses(profile){
  const ids=new Set();for(const m of CAMPAIGN)if(profile.completed.includes(m.id))for(const s of m.stages)if(s.type==='boss')ids.add(s.param);
  return [...ids].filter(id=>BOSSES[id]);
}
export function trainingMission(profile,mode='free',boss='warengine'){
  const names={free:'The Signature Range',parry:'The Unbroken Moment',reactions:'The Elemental Workshop',boss:'A Memory of Battle'};
  return{id:`training-${mode}`,title:names[mode]||names.free,region:0,theme:'training',layout:'arena',kind:'training',level:levelForXP(profile.xp),reward:0,trainingMode:mode,practiceBoss:boss,
    stages:[{type:'fight',title:names[mode]||names.free}],intro:[],outro:[],brief:'The Warden’s practice projection. Learn without risking your journey.'};
}
/** Practice uses the real combat system. Only failure and resource costs are
 * relaxed; no training rewards enter progression or the mission checkpoint. */
export class TrainingDirector extends MissionDirector {
  constructor(sim){super(sim);this.practiceMode=sim.mission.trainingMode;this.spawnAt=0;this.windowDamage=0;this.samples=[];this.bestDPS=0;this.completedDrill=false;sim.on('damage',e=>{if(!e.hostile)this.samples.push({time:sim.elapsed,amount:e.amount});});}
  get objective(){
    const stats=this.sim.stats,descriptions={free:'Strike the projection targets. Focus, Judgment, and health refill. Press Esc to leave.',parry:'Face the legionary. Tap Shift just before the red strike lands. Land five perfect parries.',reactions:'Combine your crew’s elements. These targets stand in conductive rain. Trigger five reactions.',boss:'A memory cannot take your life. Study the telegraphs, phases, and counters. Press Esc to leave.'};
    const progress=this.practiceMode==='parry'?stats.parries:this.practiceMode==='reactions'?stats.reactions:0;
    return{title:this.mission.title,text:descriptions[this.practiceMode],progress,goal:this.practiceMode==='parry'||this.practiceMode==='reactions'?5:0,type:'training',remaining:0,training:true,dps:this.bestDPS};
  }
  start(){
    if(this.started)return;this.started=true;this.stage=this.mission.stages[0];this.room=this.sim.world.rooms[0];this.goal=5;
    this.sim.objects.push(makeObject('board',{x:0,z:12},{label:'Return to the Warden',color:0xe5c68d}));
    this.spawnTargets();this.sim.emit('toast',{text:'Practice projection active. Progression and story checkpoints are not changed.'});
  }
  spawnTargets(){
    const sim=this.sim,mode=this.practiceMode;this.spawnAt=0;
    if(mode==='boss')sim.spawnBoss(sim.mission.practiceBoss,{x:0,z:-5},.8);
    else if(mode==='parry'){const e=sim.spawnEnemy('legionary',{x:0,z:-4});e.maxHp=e.hp=100000;e.attackInterval=2;e.windup=.95;e.trainingTarget=true;}
    else for(let i=0;i<4;i++){const e=sim.spawnEnemy(i===3?'shield':'legionary',{x:-7+i*4.5,z:-4+(i%2)*2});e.maxHp=e.hp=100000;e.speed=0;e.trainingTarget=true;e.stationary=true;e.attackTimer=1e9;e.statuses.wet=999;}
    sim.enemies.forEach(e=>{e.encounter=0;});
  }
  update(dt){
    if(!this.started)this.start();const sim=this.sim;this.clock+=dt;
    for(const h of sim.party){h.hp=h.maxHp;h.focus=h.maxFocus;h.judgment=100;if(h.dead)sim.revive(h,1);}
    sim.remedies=5;sim.unity=100;
    for(const e of sim.enemies)if(e.trainingTarget){e.hp=e.maxHp;e.statuses.wet=1;if(this.practiceMode!=='parry'){e.attackTimer=1e9;e.moving=false;}}
    if(this.practiceMode==='boss'&&!sim.enemies.some(e=>!e.dead)){if(!this.spawnAt)this.spawnAt=this.clock+4;if(this.clock>this.spawnAt){sim.enemies=[];this.spawnTargets();}}
    this.samples=this.samples.filter(s=>sim.elapsed-s.time<5);const dps=this.samples.reduce((n,s)=>n+s.amount,0)/5;this.bestDPS=Math.round(Math.max(this.bestDPS,dps));
    const count=this.practiceMode==='parry'?sim.stats.parries:this.practiceMode==='reactions'?sim.stats.reactions:0;
    if(!this.completedDrill&&count>=5){this.completedDrill=true;sim.emit('toast',{text:'Drill complete. Keep practicing, or return to the Warden whenever you are ready.'});sim.emit('audio',{type:'checkpoint'});}
  }
  interact(target=this.nearestInteraction()){if(target?.objectType==='board'){this.sim.emit('practiceExit',{});return true;}return false;}
  checkpoint(){return null;}
}
