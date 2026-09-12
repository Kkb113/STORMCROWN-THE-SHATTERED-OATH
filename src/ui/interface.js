import { HUD } from './hud.js';
import { mainMenu,newJourney,pauseMenu,settingsPanel,savesPanel,controlsPanel,creditsPanel,confirmPanel,defeatPanel,rewardPanel,choicePanel } from './panels.js';
import { boardPanel } from './board.js';
import { rosterPanel } from './roster.js';
import { journalPanel,tacticalMapPanel } from './journal.js';
import { trainingPanel } from './training.js';
import { HEROES,HERO_BY_ID } from '../data/heroes.js';
import { icon } from './icons.js';
import { esc,button,splitLine,focusable } from './util.js';

const VIEWS={menu:mainMenu,new:newJourney,pause:pauseMenu,settings:settingsPanel,saves:savesPanel,controls:controlsPanel,credits:creditsPanel,confirm:confirmPanel,defeat:defeatPanel,rewards:rewardPanel,choice:choicePanel,boon:choicePanel,board:boardPanel,roster:rosterPanel,codex:journalPanel,map:tacticalMapPanel,training:trainingPanel};
const PROTECTED=new Set(['menu','defeat','rewards','choice','boon','ending','newHero']);

/** Accessible DOM interface, deliberately independent of WebGL gameplay state.
 * Modal history is explicit. Every listener belongs to this instance or its
 * current view; rebuilding a panel never accumulates event handlers. */
export class Interface {
  constructor(root,app){
    this.root=root;this.app=app;this.stack=[];this.current=null;this.view=null;this.notifications=[];this.toastHistory=new Map();this.overlayClock=0;
    root.innerHTML='<div id="hud" class="hidden"></div><div id="overlay" class="hidden" role="dialog" aria-modal="true" aria-label="Game menu"></div>';
    this.overlay=root.querySelector('#overlay');this.hud=new HUD(root.querySelector('#hud'),app.renderer,app.input,app);this.toastRoot=document.getElementById('notifications');
    this.overlay.addEventListener('click',e=>{
      const b=e.target.closest('[data-act]');if(!b||b.disabled||b.getAttribute('aria-disabled')==='true')return;
      const action=this.view?.actions?.[b.dataset.act];if(!action)return;
      app.audio.sound({type:'ui'});
      try{const result=action(b,e);if(result?.catch)result.catch(error=>this.report(error));}catch(error){this.report(error);}
    });
    this.overlay.addEventListener('change',e=>{try{const result=this.view?.change?.(e.target,e);if(result?.catch)result.catch(error=>this.report(error));}catch(error){this.report(error);}});
    this.overlay.addEventListener('input',e=>this.view?.input?.(e.target,e));
    this.overlay.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;const all=focusable(this.overlay);if(!all.length)return;
      if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}
    });
  }
  report(error){console.error(error);this.toast(error.message||'The interface could not complete that action.','error',9);}
  bind(sim){this.hud.bind(sim);this.hud.setVisible(this.app.context!=='menu');}
  open(name,options={}, {replace=false,clear=false}={}){
    if(clear)this.stack=[];else if(this.current&&!replace)this.stack.push(this.current);
    this.current={name,options};this.render();this.app.syncPause();
  }
  render(){
    if(!this.current)return;
    const {name,options}=this.current;
    const focused=document.activeElement?.dataset,focusKey=focused?.act?{act:focused.act,id:focused.id,tab:focused.tab}:null;
    this.view?.dispose?.();this.view=name==='dialogue'?this.dialogueView(options):name==='ending'?this.endingView(options):name==='newHero'?this.newHeroView(options):VIEWS[name]?.(this,options);
    if(!this.view)throw new Error(`Unknown interface view: ${name}`);
    this.overlay.className=`overlay view-${name}`;this.overlay.innerHTML=this.view.html;this.overlay.scrollTop=0;this.overlay.setAttribute('aria-label',this.overlay.querySelector('h1,h2')?.textContent||'Game menu');
    this.hud.setVisible(this.app.context!=='menu'&&!['dialogue','ending','rewards','newHero'].includes(name));
    this.overlayClock=0;this.view.mount?.();
    let first=null;
    if(focusKey)first=[...this.overlay.querySelectorAll('[data-act]')].find(n=>n.dataset.act===focusKey.act&&(!focusKey.id||n.dataset.id===focusKey.id)&&(!focusKey.tab||n.dataset.tab===focusKey.tab)&&!n.disabled);
    first||=this.overlay.querySelector('.button.primary:not(:disabled),.choice-option:not(:disabled),button:not(:disabled),input,select');
    first?.focus({preventScroll:true});
    this.app.audio.cinematic=['dialogue','ending'].includes(name);
  }
  close(force=false){
    if(!this.current)return;
    if(!force&&PROTECTED.has(this.current.name))return;
    if(this.current.name==='dialogue'&&!force){this.skipDialogue();return;}
    this.view?.dispose?.();const previous=this.stack.pop();this.current=previous||null;
    if(this.current)this.render();else{this.overlay.innerHTML='';this.overlay.className='overlay hidden';this.view=null;this.hud.setVisible(this.app.context!=='menu');this.app.audio.cinematic=false;}
    this.app.syncPause();
  }
  clear(){
    this.view?.dispose?.();this.stack=[];this.current=null;this.view=null;this.overlay.innerHTML='';this.overlay.className='overlay hidden';this.hud.setVisible(this.app.context!=='menu');this.app.audio.cinematic=false;this.app.syncPause();
  }
  confirm(title,text,yes,extra={}){this.open('confirm',{title,text,yes,...extra});}
  toast(text,kind='info',duration=5){
    if(!text)return;const now=performance.now(),previous=this.toastHistory.get(text)||0;if(now-previous<1500)return;this.toastHistory.set(text,now);
    if(this.toastHistory.size>200)this.toastHistory.delete(this.toastHistory.keys().next().value);
    while(this.notifications.length>=4){this.notifications.shift().node.remove();}
    const node=document.createElement('div');node.className=`toast ${kind}`;node.setAttribute('role',kind==='error'?'alert':'status');node.innerHTML=`${icon(kind==='error'?'shield':'crown')}<span>${esc(text)}</span>`;this.toastRoot.append(node);this.notifications.push({node,left:duration});
  }
  showDialogue(lines,{after=()=>{},title='',skippable=true}={}){
    if(!lines?.length){after();return;}
    this.open('dialogue',{lines:lines.map(splitLine),index:0,revealed:0,after,title,skippable},{clear:true});
  }
  dialogueView(options){
    const line=options.lines[options.index],hero=HEROES.find(h=>h.short.toLowerCase()===line.speaker.toLowerCase()||h.name.toLowerCase()===line.speaker.toLowerCase());
    const text=line.text||'',count=Math.floor(options.revealed||0),complete=count>=text.length;
    return {html:`<section class="dialogue-view" style="--element:${hero?.color||'#d7bc89'}"><div class="cinema-top"></div><div class="dialogue-chapter"><p class="eyebrow">${esc(options.title||this.app.sim?.mission.title||'THE WARDEN')}</p><span>${options.index+1} / ${options.lines.length}</span></div><div class="dialogue-box"><div class="speaker-portrait">${hero?`<img src="${this.app.renderer.portrait(hero.id,320)}" alt="${esc(hero.name)}">`:`<div>${icon('crown')}</div>`}</div><div class="dialogue-words"><p class="eyebrow">${hero?esc(hero.role).toUpperCase():'AETHERra'}</p><h2>${esc(line.speaker||'The storm remembers')}</h2><p class="dialogue-text"><span>${esc(text.slice(0,count))}</span><i class="typing-caret ${complete?'hidden':''}"></i></p><div class="dialogue-controls">${options.skippable?button('Skip conversation','skip',{kind:'quiet'}):'<span></span>'}${button(complete?(options.index===options.lines.length-1?'Continue':'Next'):'Reveal line','next',{kind:'primary',glyph:'arrow',key:'↵'})}</div></div></div><div class="cinema-bottom"></div></section>`,actions:{next:()=>this.advanceDialogue(),skip:()=>this.skipDialogue()},update:dt=>{if(options.revealed<text.length){options.revealed=Math.min(text.length,(options.revealed||0)+dt*42);const el=this.overlay.querySelector('.dialogue-text span');if(el)el.textContent=text.slice(0,Math.floor(options.revealed));if(options.revealed>=text.length){this.overlay.querySelector('.typing-caret')?.classList.add('hidden');const b=this.overlay.querySelector('[data-act="next"]>span');if(b)b.textContent=options.index===options.lines.length-1?'Continue':'Next';}}}};
  }
  advanceDialogue(){
    if(this.current?.name!=='dialogue')return;
    const o=this.current.options,line=o.lines[o.index];
    if(o.revealed<line.text.length){o.revealed=line.text.length;this.render();return;}
    if(o.index<o.lines.length-1){o.index++;o.revealed=0;this.render();}else{const after=o.after;this.clear();after();}
  }
  skipDialogue(){
    if(this.current?.name!=='dialogue')return;const o=this.current.options;if(!o.skippable)return;const after=o.after;this.clear();after();
  }
  showEnding(lines,after){this.open('ending',{lines,index:0,after},{clear:true});}
  endingView(options){
    const [title,text]=options.lines[options.index],last=options.index===options.lines.length-1;
    return {html:`<section class="ending-view"><div class="ending-sigil">${icon('crown')}</div><p class="eyebrow">EPILOGUE · ${options.index+1} / ${options.lines.length}</p><h1>${esc(title)}</h1><div class="ornament"><i></i><span>◆</span><i></i></div><p class="ending-copy">${esc(text).replaceAll('\n','<br>')}</p>${last?'<p class="ending-unlocks">CROWNFALL MODE · SECRET CROWN ECHOES · THE ELEVEN<br><small>The main story is complete. The Warden’s work is not.</small></p>':''}${button(last?'Return to the people beside you':'The world, after','next',{kind:'primary',glyph:'arrow',key:'↵'})}</section>`,actions:{next:()=>{if(last){const after=options.after;this.clear();after();}else{options.index++;this.render();}}}};
  }
  newHeroView(options){const h=HERO_BY_ID[options.id];return{html:`<section class="new-hero-view" style="--element:${h.color}"><div class="new-hero-portrait"><img src="${this.app.renderer.portrait(h.id,480)}" alt="${h.name}"><span>${icon(h.element)}</span></div><div><p class="eyebrow">ANOTHER ANCHOR · ANOTHER REASON TO STAY</p><h1>${h.name}</h1><h2>${h.role}</h2><blockquote>“${h.quote}”</blockquote><h3>${h.passive}</h3><p>${h.passiveText}</p><p class="fine-print">Choose ${h.short} in the Warden’s formation menu. Their signature weapon, three disciplines, and personal oaths are now part of your journey.</p>${button('Welcome aboard','continue',{kind:'primary',glyph:'crew'})}</div></section>`,actions:{continue:()=>{this.clear();options.after?.();}}};}
  system(action){
    if(!this.current)return false;
    if(action==='confirm'){if(this.current.name==='dialogue')this.advanceDialogue();else{const active=document.activeElement;if(active&&this.overlay.contains(active)&&active.tagName==='BUTTON')active.click();else this.overlay.querySelector('.button.primary:not(:disabled),.choice-option:not(:disabled),button:not(:disabled)')?.click();}return true;}
    if(action==='focusNext'||action==='focusPrevious'){const nodes=focusable(this.overlay);if(nodes.length){const i=nodes.indexOf(document.activeElement),dir=action==='focusNext'?1:-1;nodes[(i+dir+nodes.length)%nodes.length].focus();}return true;}
    if(action==='pause'){this.close();return true;}
    return true;
  }
  update(dt){
    this.overlayClock+=dt;this.hud.update(dt);this.view?.update?.(dt);
    for(const n of this.notifications){n.left-=dt;n.node.style.opacity=String(Math.min(1,Math.max(0,n.left*2)));}
    this.notifications=this.notifications.filter(n=>{if(n.left<=0){n.node.remove();return false;}return true;});
  }
  dispose(){this.hud.dispose();this.view?.dispose?.();this.root.innerHTML='';}
}
