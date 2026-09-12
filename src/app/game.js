import { GameRenderer } from '../render/renderer.js';
import { Input } from '../core/input.js';
import { AudioSystem } from '../audio/audio.js';
import { Interface } from '../ui/interface.js';
import { SaveStore } from '../core/save.js';
import { loadSettings, sanitizeSettings, storeSettings, DIFFICULTY } from '../core/config.js';
import { Simulation } from '../game/simulation.js';
import { createProfile, finishMission, investPoint, resetPoints, upgradeWeapon, setParty, equipRelic, recordConversation, storyCount } from '../game/progression.js';
import { trainingMission, knownBosses } from '../game/training.js';
import { CAMPAIGN, getMission, availableMissions } from '../data/campaign.js';
import { companionTalk, endingLines } from '../data/dialogue.js';
import { LORE_BY_ID } from '../data/lore.js';
import { icon } from '../ui/icons.js';

export const WARDEN = Object.freeze({id:'warden',title:'The Warden',region:0,theme:'ship',layout:'ship',kind:'hub',level:1,reward:0,stages:[{type:'hub',title:'A home between the storms'}],intro:[],outro:[]});
const STEP=1/60;

/** Owns scene transitions, persistence, and the fixed-step clock. The simulation
 * is also runnable without a browser. Neither a menu nor a renderer can grant
 * mission rewards directly: the mission director must emit missionComplete. */
export class GameApp {
  constructor(canvas,root){
    try{this.storage=globalThis.localStorage;}catch{this.storage=null;}
    this.settings=loadSettings(this.storage);this.saveStore=new SaveStore(this.storage);
    this.renderer=new GameRenderer(canvas,this.settings);this.input=new Input(canvas,this.renderer);this.audio=new AudioSystem(this.settings);
    this.profile=null;this.sim=null;this.context='menu';this.paused=true;this.accumulator=0;this.lastFrame=0;this.presentation=[];this.unsub=[];this.failed=false;this.frameCount=0;
    this.ui=new Interface(root,this);this.abort=new AbortController();
    this.input.on('system',({action})=>this.system(action));
    this.input.on('gesture',()=>{if(!this.audio.started&&this.audio.available&&!this.unlocking){this.unlocking=true;this.audio.unlock().finally(()=>{this.unlocking=false;});}});
    this.input.on('device',({text})=>this.ui.toast(text));
    this.renderer.onError=message=>this.fatal(new Error(message));
    const options={signal:this.abort.signal};
    addEventListener('blur',()=>{if(this.context!=='menu'&&!this.ui.current&&this.sim?.state==='running')this.openPanel('pause');},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.context!=='menu'&&!this.ui.current)this.openPanel('pause');},options);
    addEventListener('pagehide',()=>{if(this.profile&&this.context!=='menu')this.saveStore.save(this.profile,0);},options);
    this.frame=this.frame.bind(this);
  }
  async boot(){
    const loading=document.getElementById('loading');
    if(loading?.querySelector('.loading-emblem'))loading.querySelector('.loading-emblem').innerHTML=icon('crown');
    await this.renderer.load((fraction,label)=>{
      const bar=loading?.querySelector('.loading-bar i');if(bar)bar.style.width=`${Math.round(fraction*100)}%`;
      const text=loading?.querySelector('.loading-status');if(text)text.textContent=label||'Preparing the falling world…';
    });
    this.applySettings(this.settings,false);this.showTitle();
    loading?.classList.add('hidden');
    this.lastFrame=performance.now();this.raf=requestAnimationFrame(this.frame);
    globalThis.__ready=true;
  }
  setSimulation(sim,context){
    for(const off of this.unsub)off();this.unsub=[];this.presentation=[];
    const previous=this.sim;this.sim=sim;this.context=context;sim.autoAim=this.settings.autoAim;
    this.renderer.setSimulation(sim,{menu:context==='menu'});this.audio.bind(sim);this.ui.bind(sim);
    this.accumulator=0;this.rewardsSettled=false;
    if(context!=='menu')this.bindGameEvents(sim);
    previous?.dispose();this.syncPause();
  }
  bindGameEvents(sim){
    const on=(type,fn)=>this.unsub.push(sim.on(type,fn));
    on('toast',({text})=>this.ui.toast(text));
    on('feedback',({text})=>this.ui.toast(text));
    on('checkpoint',({checkpoint})=>{
      if(!checkpoint||this.context==='training')return;
      this.profile.checkpoint=checkpoint;this.autoSave();
    });
    on('missionComplete',({mission,result})=>{
      if(this.rewardsSettled||mission.kind==='training')return;
      this.rewardsSettled=true;
      const rewards=finishMission(this.profile,mission,result);this.autoSave();this.syncPause();
      this.presentation.push({left:1.35,run:()=>this.ui.open('rewards',{mission,result,rewards},{clear:true})});
    });
    on('defeat',({reason})=>{
      const checkpoint=this.profile.checkpoint;
      if(checkpoint?.mission===sim.mission.id)checkpoint.stats={...checkpoint.stats,deaths:sim.stats.deaths};
      this.autoSave();this.ui.open('defeat',{reason},{clear:true});
    });
    on('choice',options=>this.ui.open('choice',options,{clear:true}));
    on('boon',options=>this.ui.open('boon',{...options,kind:'boon'},{clear:true}));
    on('dialogue',({lines,after})=>this.ui.showDialogue(lines,{after,title:sim.mission.title}));
    on('talk',({heroId})=>{
      const rewarded=recordConversation(this.profile,heroId);this.autoSave();
      this.ui.showDialogue(companionTalk(this.profile,heroId),{title:'Aboard the Warden',after:()=>{if(rewarded)this.ui.toast('A conversation worth keeping · +80 Aether');}});
    });
    on('hubAction',({action})=>this.openPanel(action==='forge'?'roster':action));
    on('practiceExit',()=>this.returnHub());
    on('memory',({lore})=>{
      this.autoSave();const id=typeof lore==='string'?lore:lore?.id;
      if(id&&LORE_BY_ID[id])this.openPanel('codex',{entry:id});
    });
  }
  showTitle(){
    const preview=createProfile();const mission={...CAMPAIGN[0]};
    this.ui.clear();const sim=new Simulation(preview,mission);sim.director.start();
    sim.party.forEach((h,i)=>{h.x=-2+i*2.8;h.z=3+(i===1?2:0);h.angle=-.5;h.judgment=100;});
    this.setSimulation(sim,'menu');this.ui.open('menu',{}, {clear:true});
  }
  startNewJourney(difficulty='oathkeeper'){
    const start=()=>{this.profile=createProfile(difficulty);this.launchMission(CAMPAIGN[0]);};
    if(this.saveStore.load(0))this.ui.confirm('Begin a new oath?','The automatic slot will be replaced. Your three manual saves will not be changed.',start,{yesLabel:'Begin the new journey'});
    else start();
  }
  continueGame(){
    const profile=this.saveStore.load(0),warning=this.saveStore.error;
    if(!profile){this.ui.toast(warning||'There is no saved journey in this browser.','error');return;}
    this.loadProfile(profile);if(warning)this.ui.toast(warning,'error',10);
  }
  loadProfile(profile){
    this.profile=profile;this.ui.clear();
    const checkpoint=profile.checkpoint,mission=checkpoint?getMission(checkpoint.mission):null;
    if(mission){this.setSimulation(new Simulation(profile,mission,{checkpoint}),mission.kind==='training'?'training':'mission');this.ui.clear();this.ui.toast('The oath continues · encounter checkpoint restored.');}
    else this.returnHub();
    this.autoSave();
  }
  requestLoad(slot){
    const profile=this.saveStore.load(slot),warning=this.saveStore.error;
    if(!profile){this.ui.toast(warning||'This slot is empty.','error');return;}
    const load=()=>{this.loadProfile(profile);if(warning)this.ui.toast(warning,'error',9);};
    if(this.context==='menu')load();else this.ui.confirm('Continue this saved journey?','This restores the selected journey and replaces the automatic slot. Manual saves are not changed.',load,{yesLabel:'Load journey'});
  }
  saveToSlot(slot){if(!this.profile||this.context==='menu')return false;const ok=this.saveStore.save(this.profile,slot);this.ui.toast(ok?'Journey saved.':this.saveStore.error,ok?'info':'error',ok?4:10);return ok;}
  autoSave(){
    if(!this.profile)return;
    const ok=this.saveStore.save(this.profile,0);
    if(ok)this.ui.hud.saved();else this.ui.toast(this.saveStore.error,'error',10);
  }
  requestMission(mission){
    if(!this.profile||this.context!=='hub')return;
    const available=mission.kind==='trial'?(mission.eleven?this.profile.ended:storyCount(this.profile)>=8&&mission.tier<=this.profile.trialTier):availableMissions(this.profile).some(m=>m.id===mission.id);
    if(!available){this.ui.toast('This oath has not yet become available.');return;}
    if(mission.hero&&!this.profile.party.includes(mission.hero)){this.ui.toast('Bring the companion whose personal oath this is.');return;}
    this.launchMission(mission);
  }
  launchMission(mission,{checkpoint=null}={}){
    this.ui.clear();this.setSimulation(new Simulation(this.profile,mission,{checkpoint}),mission.kind==='training'?'training':'mission');
    if(mission.kind!=='training'){this.profile.checkpoint=this.sim.director.checkpoint();this.autoSave();}
    this.ui.clear();
    if(!checkpoint&&mission.intro?.length)this.ui.showDialogue(mission.intro,{title:mission.title});
    else this.syncPause();
  }
  retryCheckpoint(){
    const checkpoint=this.profile?.checkpoint,mission=checkpoint&&getMission(checkpoint.mission);
    if(!mission){this.returnHub();return;}
    this.launchMission(mission,{checkpoint});this.ui.toast('The last oathstone holds. Rise again.');
  }
  returnHub(){
    if(!this.profile)return;
    this.profile.checkpoint=null;this.ui.clear();this.setSimulation(new Simulation(this.profile,WARDEN),'hub');this.ui.clear();this.autoSave();
  }
  requestReturnHub(){
    if(this.context==='hub'||this.context==='training'){this.returnHub();return;}
    this.ui.confirm('Leave this mission?','Your crew progression and earlier completed missions are safe. The current mission checkpoint will be cleared; this mission will start from its beginning next time.',()=>this.returnHub(),{yesLabel:'Return to the Warden'});
  }
  requestTitle(){
    const leave=()=>{this.autoSave();this.showTitle();};
    this.ui.confirm('Return to the title screen?','Your last encounter checkpoint is saved. Continue the oath will return you there.',leave,{yesLabel:'Title screen'});
  }
  afterVictory(options){
    const {mission,rewards}=options;
    const finish=()=>mission.final?this.ui.showEnding(endingLines(this.profile),()=>this.returnHub()):this.returnHub();
    const crew=()=>{if(rewards.first&&rewards.unlocked)this.ui.open('newHero',{id:rewards.unlocked,after:finish},{clear:true});else finish();};
    this.ui.clear();this.ui.showDialogue(mission.outro,{after:crew,title:mission.title});
  }
  openPanel(name,options={}){
    if(!this.sim)return;
    if(this.context==='menu'&&!['new','saves','settings','controls','credits'].includes(name))return;
    if(name==='map'&&this.context==='hub')name='board';
    if(['board','training'].includes(name)&&this.context!=='hub'){this.ui.toast('Visit the Warden to chart a new course.');return;}
    if(name==='codex'&&!this.profile)return;
    this.ui.open(name,options);
  }
  system(action){
    if(this.failed)return;
    if(this.ui.system(action))return;
    const panels={pause:'pause',map:'map',roster:'roster',codex:'codex',controls:'controls'};
    if(panels[action])this.openPanel(panels[action]);
  }
  syncPause(){
    this.paused=this.context==='menu'||!!this.ui?.current||this.sim?.state!=='running';
    this.input.setEnabled(!this.paused);this.audio.setPaused(this.paused&&this.context!=='menu');
    this.renderer.presentationPaused=this.paused&&this.context!=='menu';
    if(this.paused){this.accumulator=0;this.sim?.player.reset();}
  }
  applySettings(settings,persist=true){
    this.settings=sanitizeSettings(settings);this.renderer.applySettings(this.settings);this.audio.applySettings(this.settings);
    this.input.gamepadEnabled=this.settings.gamepad;if(this.sim)this.sim.autoAim=this.settings.autoAim;
    document.documentElement.style.setProperty('--text-size',String(this.settings.textSize));
    document.documentElement.classList.toggle('low-flash',this.settings.flashes<.25);
    if(persist&&!storeSettings(this.settings,this.storage))this.ui.toast('Settings could not be saved in this browser.','error');
  }
  applyAudioSetting(name,value){
    this.settings=sanitizeSettings({...this.settings,[name]:value});this.audio.applySettings(this.settings);storeSettings(this.settings,this.storage);
  }
  setDifficulty(id){
    if(this.context!=='hub'||!DIFFICULTY[id]||id==='crownfall')return;
    this.profile.difficulty=id;this.settings.difficulty=id;storeSettings(this.settings,this.storage);this.rebuildHub();this.autoSave();
  }
  rebuildHub(){
    if(this.context!=='hub')return;
    const position={x:this.sim.activeHero.x,z:this.sim.activeHero.z,angle:this.sim.activeHero.angle};
    const sim=new Simulation(this.profile,WARDEN);Object.assign(sim.activeHero,position);this.setSimulation(sim,'hub');
    // Keep the explicit modal stack: buying a node never closes the build panel.
    this.syncPause();
  }
  changeParty(slot,id){if(this.context!=='hub')return false;const ok=setParty(this.profile,slot,id);if(ok){this.rebuildHub();this.autoSave();}return ok;}
  buildAction(fn){
    if(this.context!=='hub'){this.ui.toast('Change your build aboard the Warden.');return false;}
    const result=fn();if(result?.ok===false){this.ui.toast(result.reason);return false;}
    this.rebuildHub();this.autoSave();if(result?.name)this.ui.toast(`Signature awakened · ${result.name}`);return true;
  }
  invest(id,node){return this.buildAction(()=>investPoint(this.profile,id,node));}
  resetDisciplines(id){return this.buildAction(()=>resetPoints(this.profile,id));}
  upgrade(id){return this.buildAction(()=>upgradeWeapon(this.profile,id));}
  toggleRelic(id){return this.buildAction(()=>equipRelic(this.profile,id));}
  setCrownfall(enabled){if(!this.profile?.ended||this.context!=='hub')return;this.profile.crownfall=!!enabled;this.autoSave();}
  startTraining(mode='free',boss='warengine'){
    if(this.context!=='hub')return;
    if(!['free','parry','reactions','boss'].includes(mode))return;
    if(mode==='boss'&&!knownBosses(this.profile).includes(boss)){this.ui.toast('Defeat this foe in the campaign before recalling it.');return;}
    this.launchMission(trainingMission(this.profile,mode,boss));
  }
  frame(now){
    if(this.failed)return;
    const rawDt=Math.max(.001,(now-this.lastFrame)/1000);this.lastFrame=now;
    try{
      this.input.pollGamepad();
      if(!this.paused&&this.sim?.state==='running'){
        this.accumulator=Math.min(.15,this.accumulator+rawDt);
        let steps=0;while(this.accumulator>=STEP&&steps++<8&&!this.paused&&this.sim.state==='running'){
          this.accumulator-=STEP;this.sim.update(STEP,this.input.consume());this.profile.elapsed+=STEP;
        }
      }
      const dt=Math.min(.12,rawDt);
      const pending=this.presentation;this.presentation=[];
      for(const event of pending){event.left-=dt;if(event.left<=0)event.run();else this.presentation.push(event);}
      this.audio.update(dt);this.renderer.render(rawDt,this.paused?1:this.accumulator/STEP);this.ui.update(dt);this.frameCount++;
      this.raf=requestAnimationFrame(this.frame);
    }catch(error){this.fatal(error);}
  }
  fatal(error){
    if(this.failed)return;this.failed=true;this.input.setEnabled(false);this.audio.setPaused(true);console.error(error);
    if(this.profile&&this.context!=='menu')this.saveStore.save(this.profile,0);
    const box=document.createElement('section');box.className='fatal-error';const title=document.createElement('h1');title.textContent='The storm interrupted the journey.';
    const text=document.createElement('p');text.textContent=error.message||String(error);
    const note=document.createElement('p');note.textContent='Your last saved encounter can be resumed. Reload the page; try a lower graphics setting after reconnecting.';
    const reload=document.createElement('button');reload.className='button primary';reload.textContent='Reload the game';reload.onclick=()=>location.reload();box.append(title,text,note,reload);document.body.append(box);
    globalThis.__gameError=error.stack||String(error);
  }
  diagnostics(){return {context:this.context,paused:this.paused,state:this.sim?.state,mission:this.sim?.mission.id,stage:this.sim?.director.index,frameCount:this.frameCount,renderer:{...this.renderer.stats},audio:this.audio.diagnostics};}
  dispose(){cancelAnimationFrame(this.raf);for(const off of this.unsub)off();this.abort.abort();this.input.dispose();this.audio.dispose();this.ui.dispose();this.sim?.dispose();this.renderer.dispose();}
}
