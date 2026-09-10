import { HERO_BY_ID, ELEMENTS } from '../data/heroes.js';
import { REGIONS } from '../data/regions.js';
import { currentBonds, levelForXP, xpForLevel } from '../game/progression.js';
import { distance, clamp } from '../core/math.js';
import { icon, skillIcon } from './icons.js';
import { esc, number, clock, meter } from './util.js';
import { drawMap } from './map.js';

const hints={
  attack:['Read the opening','Hold the left mouse button or J to chain attacks. Aim with the cursor.'],
  defense:['An oath is not a shield','Space dodges through danger. Tap Shift just before a strike for a perfect parry; hold it to guard.'],
  party:['Three anchors. One battle.','Press 1, 2, or 3 to switch instantly. Your companions keep fighting beside you.'],
  skills:['Let the world react','Q and E spend Focus. Attacking restores it. R unleashes your ultimate when Judgment reaches 100%.'],
  blue:['The storm knows your name','Red marks danger. Blue storm strikes can be absorbed by Rael for healing and Judgment.'],
  healing:['Keep each other standing','H uses a remedy to heal the party and revive fallen companions. Checkpoints also restore your crew.'],
};

export class HUD {
  constructor(root,renderer,input,app){
    this.root=root;this.renderer=renderer;this.input=input;this.app=app;this.sim=null;this.unsub=[];this.labels=[];this.healthNodes=new Map();this.clock=0;this.uiClock=0;this.mapClock=0;this.heroKey='';this.bossKey='';this.hintIndex=0;this.hintTimer=0;this.hintKeys=Object.keys(hints);this.hintVisible=false;this.flash=0;
    this.root.addEventListener('click',e=>{const control=e.target.closest('[data-control]');if(control){this.input.press(control.dataset.control);e.stopPropagation();return;}const action=e.target.closest('[data-hud]')?.dataset.hud;if(action==='hidehint'){this.hideHint();return;}if(action)this.app.openPanel(action);});
    this.root.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-held]');if(!b)return;e.preventDefault();this.input.hold(b.dataset.held,true);if(b.dataset.held==='guard')this.input.press('guardPressed');b.setPointerCapture(e.pointerId);});
    const up=e=>{const b=e.target.closest('[data-held]');if(b)this.input.hold(b.dataset.held,false);};this.root.addEventListener('pointerup',up);this.root.addEventListener('pointercancel',up);
  }
  bind(sim){
    for(const off of this.unsub)off();this.unsub=[];this.sim=sim;this.heroKey='';this.bossKey='';this.clock=0;this.labels=[];this.healthNodes.clear();this.hintIndex=0;this.hintTimer=4;this.hintVisible=false;
    this.root.innerHTML=`<section class="hud-party" aria-label="Your party"></section>
      <section class="hud-quest"><p class="eyebrow" id="quest-chapter"></p><h2 id="quest-title"></h2><p id="quest-objective"></p><div id="quest-progress"></div><div class="quest-travel" id="quest-travel"></div></section>
      <section class="hud-map"><button class="minimap-frame" data-hud="map" aria-label="Open the tactical map"><canvas id="minimap" width="224" height="224"></canvas><span class="minimap-crosshair"></span></button><div class="region-label"><span id="region-name"></span><small id="region-subtitle"></small></div></section>
      <section class="hud-bosses" aria-label="Boss health"></section>
      <section class="hud-abilities" aria-label="Combat abilities"></section>
      <div class="hud-xp"><i></i></div>
      <div class="hud-footer"><span class="hud-status">${icon('crown')}<span id="hud-status-text">The storm favors the bold.</span></span><nav><button data-hud="roster"><kbd>I</kbd> Crew</button><button data-hud="map"><kbd>M</kbd> Map</button><button data-hud="codex"><kbd>L</kbd> Journal</button><button data-hud="pause"><kbd>Esc</kbd> Menu</button></nav></div>
      <div class="hud-interact hidden" role="status"><kbd>F</kbd><span></span></div>
      <div class="hud-hint hidden"><div><p class="eyebrow">FIELD NOTES</p><h3></h3><p class="hint-copy"></p></div><button data-hud="hidehint" aria-label="Dismiss field note">${icon('close')}</button></div>
      <div class="world-labels" aria-hidden="true"></div><div class="world-health" aria-hidden="true"></div><div class="world-waypoint hidden" aria-hidden="true">${icon('arrow')}<span></span></div>
      <div class="hud-ultimate hidden" aria-live="polite"><p></p><h2></h2><span></span></div>
      <div class="hud-banner hidden" aria-live="polite"><p></p><h2></h2><span></span></div>
      <div class="hud-save hidden">${icon('save')}<span>Oath recorded</span></div><div id="performance" class="hidden"></div>
      <div class="touch-controls"><div class="touch-stick" aria-label="Movement joystick"><i></i></div><div class="touch-actions"><button data-held="guard" aria-label="Guard">${icon('shield')}</button><button data-held="attack" aria-label="Attack">${icon('sword')}</button><button data-held="heavy" aria-label="Heavy attack">${icon('heavy')}</button><button data-control="dodge" aria-label="Dodge">${icon('dodge')}</button></div></div>`;
    this.nodes={party:this.root.querySelector('.hud-party'),questChapter:this.root.querySelector('#quest-chapter'),questTitle:this.root.querySelector('#quest-title'),questText:this.root.querySelector('#quest-objective'),questProgress:this.root.querySelector('#quest-progress'),travel:this.root.querySelector('#quest-travel'),bosses:this.root.querySelector('.hud-bosses'),abilities:this.root.querySelector('.hud-abilities'),map:this.root.querySelector('#minimap'),interact:this.root.querySelector('.hud-interact'),hint:this.root.querySelector('.hud-hint'),labels:this.root.querySelector('.world-labels'),health:this.root.querySelector('.world-health'),waypoint:this.root.querySelector('.world-waypoint'),ultimate:this.root.querySelector('.hud-ultimate'),banner:this.root.querySelector('.hud-banner'),save:this.root.querySelector('.hud-save'),fps:this.root.querySelector('#performance'),xp:this.root.querySelector('.hud-xp i'),status:this.root.querySelector('#hud-status-text')};
    const region=REGIONS[sim.mission.region];this.root.querySelector('#region-name').textContent=sim.world.isHub?'The Warden':region.name;this.root.querySelector('#region-subtitle').textContent=sim.world.isHub?'A home between the storms':sim.mission.theme.replaceAll('_',' ');
    this.bindStick();this.buildParty();this.buildAbilities();this.nodes.questChapter.textContent=sim.world.isHub?'THE WARDEN':`ACT ${region.act} · ${sim.mission.title}`;
    const on=(type,fn)=>this.unsub.push(sim.on(type,fn));
    on('switch',()=>{this.buildParty();this.buildAbilities();});
    on('anchorBound',()=>{this.buildParty();this.buildAbilities();});
    on('damage',e=>{if(this.app.settings.damageNumbers&&!e.dot)this.addLabel({...e,text:Math.round(e.amount).toString(),color:e.hostile?'#f6aca2':e.critical?'#ffe4a2':'#ebe4dc',large:e.critical,damage:true});});
    on('heal',e=>{if(this.app.settings.damageNumbers&&e.amount>8)this.addLabel({...e,text:`+${Math.round(e.amount)}`,color:'#b1edc4',heal:true});});
    on('label',e=>{if(e.text)this.addLabel(e);});
    on('hurt',e=>{this.flash=Math.min(.55,this.flash+e.amount*1.2);});
    on('ultimate',e=>this.ultimate(e));
    on('stage',e=>{this.banner(`ENCOUNTER ${e.index+1} / ${e.total}`,e.stage.title,sim.mission.title,3);});
    on('stageComplete',()=>{this.saved();});
    on('bossIntro',e=>this.banner(e.boss.definition?.title||'CROWNBOUND',e.boss.name,'The battlefield will not remain still.',4));
    on('reinforcements',e=>{this.nodes.status.textContent=`Reinforcements · wave ${e.wave}`;});
    on('revive',e=>{this.addLabel({text:`${e.hero.short} returns`,x:e.hero.x,z:e.hero.z,color:'#b4e7c2'});});
    this.update(0,true);
  }
  bindStick(){
    const stick=this.root.querySelector('.touch-stick'),knob=stick.querySelector('i');let pointer=null;
    const move=e=>{if(e.pointerId!==pointer)return;const box=stick.getBoundingClientRect(),r=box.width*.38;let x=(e.clientX-box.left-box.width*.5)/r,y=(e.clientY-box.top-box.height*.5)/r;const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;knob.style.transform=`translate(${x*r*.65}px,${y*r*.65}px)`;this.input.setStick(x,y);};
    stick.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);move(e);});stick.addEventListener('pointermove',move);
    const up=e=>{if(e.pointerId!==pointer)return;pointer=null;knob.style.transform='';this.input.setStick(0,0);};stick.addEventListener('pointerup',up);stick.addEventListener('pointercancel',up);
  }
  portrait(id){return this.renderer.portrait(id);}
  buildParty(){
    const sim=this.sim,level=levelForXP(sim.profile.xp);this.heroKey=sim.party.map(h=>h.heroId).join(':');
    this.nodes.party.innerHTML=sim.party.map((h,i)=>`<button type="button" class="party-card ${i===sim.activeIndex?'active':''}" data-control="party${i}" data-hero="${h.heroId}" style="--element:${h.definition.color}" title="${esc(h.name)} · ${esc(h.definition.role)}"><span class="portrait-frame"><img src="${this.portrait(h.heroId)}" alt="${esc(h.name)}"><span class="party-slot">${sim.world.isHub?level:i+1}</span></span><span class="party-info"><span class="party-name">${esc(h.short)}<small>${sim.world.isHub?'THE ANCHOR':`LV ${level}`}</small></span><span class="party-hp-text"></span>${meter(1,'hp')}${meter(1,'focus')}${meter(1,'stamina')}<span class="party-judgment">${icon(h.element)}<i></i></span></span><span class="party-down">FALLEN</span></button>`).join('');
    this.partyNodes=[...this.nodes.party.querySelectorAll('.party-card')].map(n=>({root:n,hp:n.querySelector('.hp i'),focus:n.querySelector('.focus i'),stamina:n.querySelector('.stamina i'),text:n.querySelector('.party-hp-text'),judgment:n.querySelector('.party-judgment i')}));
  }
  buildAbilities(){
    const h=this.sim.activeHero,d=h.definition,bonds=currentBonds(this.sim.profile,this.sim.party.map(e=>e.heroId));
    this.activeKey=h.heroId;this.nodes.abilities.style.setProperty('--element',d.color);
    if(this.sim.world.isHub){this.nodes.abilities.innerHTML=`<div class="hub-shortcuts"><button data-hud="board">${icon('map')}<span>Chart a course</span><kbd>M</kbd></button><button data-hud="roster">${icon('forge')}<span>Forge & crew</span><kbd>I</kbd></button><button data-hud="codex">${icon('book')}<span>The archive</span><kbd>L</kbd></button></div>`;this.skillNodes=[];return;}
    const controls=['skill1','skill2','ultimate'],keys=['Q','E','R'];
    this.nodes.abilities.innerHTML=`<div class="combat-basics"><span><kbd>LMB</kbd> Attack</span><span><kbd>RMB</kbd> Heavy</span><span><kbd>Space</kbd> Dodge</span><span><kbd>Shift</kbd> Guard / parry</span></div><div class="ability-row">${d.skills.map((s,i)=>`<button class="ability ${i===2?'ultimate-ability':''}" data-control="${controls[i]}" aria-label="${esc(s.name)} (${keys[i]})"><span class="ability-frame">${skillIcon(s.type,i)}<span class="cooldown-fill"></span><strong class="cooldown-text"></strong><span class="ability-key">${keys[i]}</span></span><span class="ability-name">${esc(s.name)}</span><span class="ability-tooltip"><strong>${esc(s.name)}</strong>${esc(s.description||s.desc)}<small>${i===2?'100 Judgment':`${s.cost} Focus · ${s.cooldown}s recovery`}</small></span></button>`).join('')}
      <span class="ability-divider"></span><button class="ability bond-ability" data-control="bond" aria-label="Relationship attack (T)"><span class="ability-frame">${icon('bond')}<span class="bond-charge"></span><strong class="bond-value"></strong><span class="ability-key">T</span></span><span class="ability-name">${bonds.length?esc(bonds[0].name):'Unity'}</span><span class="ability-tooltip"><strong>${bonds.length?esc(bonds[0].name):'A bond not yet repaired'}</strong>${bonds.length?esc(bonds[0].text):'Relationships unlock combination attacks. Complete companion missions and bring both heroes.'}<small>100 Unity · attacks, parries, reactions</small></span></button>
      <button class="ability remedy-ability" data-control="remedy" aria-label="Heal and revive the party (H)"><span class="ability-frame">${icon('heal')}<strong class="remedy-count"></strong><span class="ability-key">H</span></span><span class="ability-name">Remedy</span><span class="ability-tooltip"><strong>Warden’s remedy</strong>Heal the crew and revive fallen companions. Restocked at the Warden and selected checkpoints.</span></button></div>`;
    this.skillNodes=[...this.nodes.abilities.querySelectorAll('[data-control="skill1"],[data-control="skill2"],[data-control="ultimate"]')].map(n=>({root:n,fill:n.querySelector('.cooldown-fill'),text:n.querySelector('.cooldown-text')}));
    this.bondNode=this.nodes.abilities.querySelector('.bond-ability');this.remedyNode=this.nodes.abilities.querySelector('.remedy-ability');
  }
  addLabel(e){
    if(this.labels.length>=64){const old=this.labels.shift();old.node.remove();}
    const node=document.createElement('span');node.className=`floating-label ${e.large?'large':''} ${e.damage?'damage':''} ${e.heal?'heal':''}`;node.textContent=e.text;node.style.color=e.color||'#e0c9a3';this.nodes.labels.append(node);
    const offset=e.damage?(Math.random()-.5)*28:0;this.labels.push({node,x:e.x,z:e.z,y:e.y||1.5,age:0,life:e.large?1.6:e.damage?.8:1.25,offset,large:e.large});
  }
  ultimate(e){const n=this.nodes.ultimate,h=HERO_BY_ID[e.heroId];n.style.setProperty('--element',h?.color||'#bfb0ff');n.querySelector('p').textContent=e.bond?'THE OATH BETWEEN US':h?.role.toUpperCase()||'CROWNBOUND';n.querySelector('h2').textContent=e.name;n.querySelector('span').textContent=e.bond?'RELATIONSHIP ATTACK':h?.name||'';n.classList.remove('hidden');n.classList.remove('enter');void n.offsetWidth;n.classList.add('enter');this.ultimateTime=3.4;}
  banner(eyebrow,title,text='',duration=3){const n=this.nodes.banner;n.querySelector('p').textContent=eyebrow;n.querySelector('h2').textContent=title;n.querySelector('span').textContent=text;n.classList.remove('hidden');this.bannerTime=duration;}
  saved(){if(!this.nodes)return;this.nodes.save.classList.remove('hidden');this.saveTime=2.4;}
  hideHint(){this.nodes.hint.classList.add('hidden');this.hintVisible=false;this.hintTimer=18;this.hintIndex++;if(this.hintIndex>=this.hintKeys.length&&!this.sim.profile.tutorialSeen.includes('field-notes'))this.sim.profile.tutorialSeen.push('field-notes');}
  updateHints(dt){
    if(!this.app.settings.tutorial||this.sim.mission.id!=='s01'||this.sim.profile.tutorialSeen.includes('field-notes')||this.hintIndex>=this.hintKeys.length){this.nodes.hint.classList.add('hidden');return;}
    this.hintTimer-=dt;if(this.hintTimer>0)return;
    if(this.hintVisible){this.hideHint();return;}
    const [title,text]=hints[this.hintKeys[this.hintIndex]];this.nodes.hint.querySelector('h3').textContent=title;this.nodes.hint.querySelector('.hint-copy').textContent=text;this.nodes.hint.classList.remove('hidden');this.hintVisible=true;this.hintTimer=22;
  }
  updateBosses(){
    const bosses=this.sim.enemies.filter(e=>e.kind==='boss'&&!e.dead),key=bosses.map(b=>b.id).join(':');
    if(key!==this.bossKey){this.bossKey=key;this.nodes.bosses.innerHTML=bosses.map(b=>`<div class="boss-bar" data-boss="${b.id}"><div class="boss-name">${icon('crown')}<span>${esc(b.name)}</span><small></small></div><div class="boss-health-track"><i></i>${[1,2].map(n=>`<b style="left:${n*33.333}%"></b>`).join('')}</div><div class="boss-phase"></div></div>`).join('');}
    for(const b of bosses){const n=this.nodes.bosses.querySelector(`[data-boss="${b.id}"]`);n.querySelector('.boss-health-track i').style.transform=`scaleX(${b.hp/b.maxHp})`;n.querySelector('small').textContent=`${Math.ceil(b.hp/b.maxHp*100)}%`;const phase=b.definition.phases?.[b.phase];n.querySelector('.boss-phase').textContent=typeof phase==='string'?phase:phase?.name||`PHASE ${b.phase+1}`;}
  }
  updateVitals(){
    const sim=this.sim;
    if(this.heroKey!==sim.party.map(h=>h.heroId).join(':'))this.buildParty();if(this.activeKey!==sim.activeHero.heroId)this.buildAbilities();
    for(let i=0;i<sim.party.length;i++){
      const h=sim.party[i],n=this.partyNodes[i];n.root.classList.toggle('active',i===sim.activeIndex);n.root.classList.toggle('down',h.dead);n.root.classList.toggle('low-health',!h.dead&&h.hp/h.maxHp<.3);
      n.hp.style.transform=`scaleX(${Math.max(0,h.hp/h.maxHp)})`;n.focus.style.transform=`scaleX(${h.focus/h.maxFocus})`;n.stamina.style.transform=`scaleX(${h.stamina/100})`;
      n.text.textContent=`${number(h.hp)} / ${number(h.maxHp)}`;n.judgment.style.width=`${h.judgment}%`;
    }
    const h=sim.activeHero;
    if(!sim.world.isHub){
      h.definition.skills.forEach((s,i)=>{const n=this.skillNodes[i],cooldown=h.cooldowns[i],ultimate=i===2,ultimateCost=100*(1+(sim.relics.ultimateCost||0)),ready=ultimate?h.judgment>=ultimateCost:cooldown<=0&&h.focus>=s.cost;
        n.root.classList.toggle('ready',ready);n.root.classList.toggle('unavailable',!ready);n.fill.style.setProperty('--cooldown',`${ultimate?Math.max(0,100-h.judgment/ultimateCost*100):Math.min(100,cooldown/s.cooldown*100)}%`);n.text.textContent=ultimate?h.judgment>=ultimateCost?'':Math.floor(h.judgment)+'%':cooldown>.1?cooldown.toFixed(cooldown<10?1:0):h.focus<s.cost?'LOW':'';
      });
      this.bondNode.classList.toggle('ready',sim.unity>=100*(1+(sim.relics.bondCost||0))&&currentBonds(sim.profile,sim.party.map(h=>h.heroId)).length>0);this.bondNode.querySelector('.bond-value').textContent=sim.unity>=100?'':`${Math.floor(sim.unity)}%`;this.bondNode.querySelector('.bond-charge').style.height=`${sim.unity}%`;
      this.remedyNode.querySelector('.remedy-count').textContent=sim.remedies;this.remedyNode.classList.toggle('unavailable',sim.remedies<=0);
    }
    const level=levelForXP(sim.profile.xp),from=xpForLevel(level),to=xpForLevel(Math.min(45,level+1));this.nodes.xp.style.transform=`scaleX(${level>=45?1:clamp((sim.profile.xp-from)/(to-from),0,1)})`;
    const obj=sim.director.objective;this.nodes.questTitle.textContent=obj.title;this.nodes.questText.textContent=obj.text;
    const percent=obj.charge!=null?obj.charge:obj.goal>1&&!['fight','trial','eleven'].includes(obj.type)?obj.progress/obj.goal:null;
    this.nodes.questProgress.innerHTML=obj.timer!=null?`<span class="quest-timer ${obj.timer<20?'urgent':''}">${icon('clock')} ${clock(obj.timer)}</span>`:percent!=null?`${meter(percent,'objective-meter')}<small>${Math.floor(obj.progress)} / ${obj.goal}</small>`:obj.remaining>0?`<small>${obj.remaining} ${obj.type==='boss'?'Crownbound':'hostiles'} remaining</small>`:'';
    this.nodes.travel.textContent=obj.travel?`Encounter ${sim.director.index+1} / ${sim.mission.stages.length} · ${Math.round(distance(h,sim.director.room))} m`:'';
    const nearby=sim.director.nearestInteraction();this.nodes.interact.classList.toggle('hidden',!nearby);if(nearby)this.nodes.interact.querySelector('span').textContent=nearby.label;
    this.updateBosses();
  }
  updateWorldHealth(){
    const active=new Set(),sim=this.sim;
    const entities=[...sim.enemies.filter(e=>e.kind!=='boss'),...sim.civilians.filter(c=>!c.safe),...sim.objects.filter(o=>o.damageable)];
    for(const e of entities){
      if(e.dead||distance(e,sim.activeHero)>33||e.invisible>.3)continue;
      const p=this.renderer.project(e,2.7*(e.scale||1));if(!p?.visible)continue;active.add(e.id);
      let node=this.healthNodes.get(e.id);if(!node){node=document.createElement('div');node.className=`world-health-bar ${e.team==='friendly'?'friendly':''} ${e.elite?'elite':''}`;node.innerHTML='<span></span><i><b></b></i><small></small>';this.nodes.health.append(node);this.healthNodes.set(e.id,node);}
      node.style.transform=`translate(${p.x}px,${p.y}px)`;node.querySelector('b').style.transform=`scaleX(${Math.max(0,e.hp/e.maxHp)})`;
      node.querySelector('span').textContent=e.team==='friendly'||e.objectType?e.short||e.label:e.elite?'VETERAN':'';
      node.querySelector('small').textContent=e.frozen>0?'FROZEN':e.stun>0?'STAGGERED':e.statuses.fire?'BURNING':e.blocking?'GUARDING':'';
    }
    for(const [id,node] of this.healthNodes)if(!active.has(id)){node.remove();this.healthNodes.delete(id);}
  }
  updateWaypoint(){
    const sim=this.sim,n=this.nodes.waypoint;if(sim.world.isHub||sim.director.complete){n.classList.add('hidden');return;}
    let destination=null;
    if(!sim.director.started)destination=sim.director.room;
    else if(sim.director.stage?.type==='escape')destination=sim.director.route[sim.director.progress];
    else if(sim.director.stage?.type==='rescue'&&sim.civilians.some(c=>c.following&&!c.safe))destination=sim.director.exitPoint;
    if(!destination||distance(destination,sim.activeHero)<6){n.classList.add('hidden');return;}
    const p=this.renderer.project(destination,.4);if(!p){n.classList.add('hidden');return;}
    const x=clamp(p.x,innerWidth*.19,innerWidth*.81),y=clamp(p.y,innerHeight*.22,innerHeight*.72);n.style.transform=`translate(${x}px,${y}px)`;const angle=Math.atan2(p.y-innerHeight*.5,p.x-innerWidth*.5);n.querySelector('svg').style.transform=`rotate(${angle}rad)`;n.querySelector('span').textContent=`${Math.round(distance(destination,sim.activeHero))} m`;n.classList.remove('hidden');
  }
  update(dt,force=false){
    if(!this.sim||!this.nodes)return;this.clock+=dt;this.uiClock+=dt;this.mapClock+=dt;
    if(this.uiClock>.085||force){this.uiClock=0;this.updateVitals();this.updateWorldHealth();this.updateWaypoint();}
    if(this.mapClock>.2||force){this.mapClock=0;drawMap(this.nodes.map,this.sim);}
    for(const label of this.labels){label.age+=dt;const p=this.renderer.project(label,0);if(p){label.node.style.transform=`translate(${p.x+label.offset}px,${p.y-label.age*(label.large?26:42)}px)`;label.node.style.opacity=String(Math.max(0,Math.min(1,(label.life-label.age)*3)));}else label.node.style.opacity='0';}
    this.labels=this.labels.filter(l=>{if(l.age>l.life){l.node.remove();return false;}return true;});
    for(const [key,node] of [['ultimateTime',this.nodes.ultimate],['bannerTime',this.nodes.banner],['saveTime',this.nodes.save]]){if(this[key]>0){this[key]-=dt;if(this[key]<=0)node.classList.add('hidden');}}
    this.flash=Math.max(0,this.flash-dt*1.2);const flash=document.getElementById('damage-flash');if(flash)flash.style.opacity=String(this.flash*this.app.settings.flashes);
    this.nodes.fps.classList.toggle('hidden',!this.app.settings.fps);if(this.app.settings.fps){const s=this.renderer.stats;this.nodes.fps.textContent=`${s.fps} FPS · ${s.calls} draws · ${Math.round(s.triangles/1000)}k triangles · ${Math.round(s.resolution*100)}%`;}
    if(!this.app.paused)this.updateHints(dt);
  }
  setVisible(visible){this.root.classList.toggle('hidden',!visible);}
  dispose(){for(const off of this.unsub)off();this.root.innerHTML='';}
}
