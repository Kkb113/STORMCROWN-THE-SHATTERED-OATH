import { Events } from './events.js';
import { EMPTY_INPUT } from '../game/simulation.js';

const ACTION_KEYS = {
  KeyQ:'skill1',KeyE:'skill2',KeyR:'ultimate',KeyT:'bond',KeyH:'remedy',KeyF:'interact',
  Space:'dodge',Digit1:'party0',Digit2:'party1',Digit3:'party2',
};
const SYSTEM_KEYS = { Escape:'pause',KeyM:'map',KeyI:'roster',Tab:'roster',KeyL:'codex',F1:'controls',Enter:'confirm' };
const GAME_KEYS = new Set([...Object.keys(ACTION_KEYS),...Object.keys(SYSTEM_KEYS),'KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyJ','KeyK','ShiftLeft','ShiftRight']);
const editable = el => el && (['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable);
const axis = v => Math.abs(v)<.16?0:Math.sign(v)*Math.min(1,(Math.abs(v)-.16)/.84);

/** Device-agnostic held state and edge-triggered commands. Input is drained only
 * on simulation ticks: a short key press survives low rendering frame rates. */
export class Input extends Events {
  constructor(canvas, renderer) {
    super();this.canvas=canvas;this.renderer=renderer;this.keys=new Set();this.edges=new Set();this.held=new Set();
    this.pointer={x:0,y:0,valid:false};this.virtual={x:0,y:0};this.lastDevice='keyboard';this.enabled=true;this.padPrevious=[];this.pad=null;this.padAim=null;this.gamepadEnabled=true;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    addEventListener('keydown',e=>{
      if(editable(e.target)){if(e.code==='Escape')e.target.blur();return;}
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      if(!this.enabled&&e.code==='Tab')return;
      if(GAME_KEYS.has(e.code))e.preventDefault();this.lastDevice='keyboard';
      if(!e.repeat){if(SYSTEM_KEYS[e.code])this.emit('system',{action:SYSTEM_KEYS[e.code]});if(ACTION_KEYS[e.code])this.edges.add(ACTION_KEYS[e.code]);if(e.code==='ShiftLeft'||e.code==='ShiftRight')this.edges.add('guardPressed');}
      this.keys.add(e.code);
    },options);
    addEventListener('keyup',e=>this.keys.delete(e.code),options);
    addEventListener('blur',()=>this.clear(),options);
    addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();},options);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
    canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;this.pointer={x:e.clientX,y:e.clientY,valid:true};this.lastDevice='mouse';},options);
    canvas.addEventListener('pointerdown',e=>{
      this.emit('gesture',{});if(e.pointerType==='touch')return;
      this.lastDevice='mouse';this.pointer={x:e.clientX,y:e.clientY,valid:true};
      if(e.button===0)this.held.add('attack');if(e.button===2)this.held.add('heavy');
      if(e.button===1){e.preventDefault();this.edges.add('dodge');}
    },options);
    addEventListener('pointerup',e=>{if(e.button===0)this.held.delete('attack');if(e.button===2)this.held.delete('heavy');},options);
    canvas.addEventListener('wheel',e=>{if(this.enabled){e.preventDefault();this.renderer.zoom(e.deltaY);}}, {...options,passive:false});
    addEventListener('gamepadconnected',e=>this.emit('device',{text:`${e.gamepad.id.split('(')[0].trim()} connected`}),options);
    addEventListener('gamepaddisconnected',()=>{this.pad=null;this.padPrevious=[];this.emit('device',{text:'Controller disconnected · keyboard and mouse remain available'});},options);
    document.addEventListener('pointerdown',()=>this.emit('gesture',{}),{...options,passive:true});
  }
  setEnabled(enabled){if(this.enabled!==enabled)this.clear();this.enabled=enabled;}
  press(action){this.edges.add(action);this.emit('gesture',{});}
  hold(action,down){down?this.held.add(action):this.held.delete(action);this.emit('gesture',{});}
  setStick(x,y){this.virtual={x,y};this.lastDevice='touch';this.pointer.valid=false;}
  clear(){this.keys.clear();this.edges.clear();this.held.clear();this.virtual={x:0,y:0};this.padAim=null;}
  pollGamepad(){
    if(!this.gamepadEnabled||!navigator.getGamepads)return;
    const pad=Array.from(navigator.getGamepads()).find(Boolean);this.pad=pad;if(!pad)return;
    const pressed=pad.buttons.map(b=>b.pressed||b.value>.55),edge=n=>pressed[n]&&!this.padPrevious[n];
    if(pressed.some(Boolean)||pad.axes.some(v=>Math.abs(v)>.2)){this.lastDevice='gamepad';this.emit('gesture',{});}
    if(edge(9))this.emit('system',{action:'pause'});
    if(edge(8))this.emit('system',{action:'map'});
    if(!this.enabled){
      if(edge(0))this.emit('system',{action:'confirm'});if(edge(1))this.emit('system',{action:'pause'});
      if(edge(12)||edge(14))this.emit('system',{action:'focusPrevious'});if(edge(13)||edge(15))this.emit('system',{action:'focusNext'});
    }else{
      const bind={0:'dodge',1:'interact',2:'skill1',3:'skill2',7:'',10:'bond',11:'ultimate',12:'party0',14:'party1',15:'party2',13:'remedy'};
      for(const [i,a] of Object.entries(bind))if(a&&edge(+i))this.edges.add(a);
      if(edge(4))this.edges.add('guardPressed');
      const x=axis(pad.axes[2]||0),y=axis(pad.axes[3]||0),p=this.renderer.sim?.activeHero;
      if(p&&Math.hypot(x,y)>.2){const yaw=.64;this.padAim={x:p.x+(x*Math.cos(yaw)+y*Math.sin(yaw))*14,z:p.z+(-x*Math.sin(yaw)+y*Math.cos(yaw))*14};}else this.padAim=null;
    }
    this.padPrevious=pressed;
  }
  consume(){
    if(!this.enabled)return EMPTY_INPUT;
    const k=this.keys,down=(...codes)=>codes.some(c=>k.has(c));
    let x=(down('KeyD','ArrowRight')?1:0)-(down('KeyA','ArrowLeft')?1:0)+this.virtual.x;
    let y=(down('KeyS','ArrowDown')?1:0)-(down('KeyW','ArrowUp')?1:0)+this.virtual.y;
    const pad=this.gamepadEnabled?this.pad:null;
    if(pad){x+=axis(pad.axes[0]||0);y+=axis(pad.axes[1]||0);}
    const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;
    const edge=a=>this.edges.has(a);
    const out={...EMPTY_INPUT,moveX:x,moveY:y,
      attack:this.held.has('attack')||down('KeyJ')||!!pad?.buttons[7]?.pressed,
      heavy:this.held.has('heavy')||down('KeyK')||!!pad?.buttons[6]?.pressed,
      guard:this.held.has('guard')||down('ShiftLeft','ShiftRight')||!!pad?.buttons[4]?.pressed,
      guardPressed:edge('guardPressed'),dodge:edge('dodge'),skill1:edge('skill1'),skill2:edge('skill2'),ultimate:edge('ultimate'),bond:edge('bond'),remedy:edge('remedy'),interact:edge('interact'),
      switchTo:edge('party0')?0:edge('party1')?1:edge('party2')?2:null,
      aim:this.lastDevice==='gamepad'?this.padAim:this.pointer.valid&&!down('KeyJ','KeyK')?this.renderer.groundFromScreen(this.pointer.x,this.pointer.y):null,
    };
    this.edges.clear();return out;
  }
  dispose(){this.abort.abort();this.clear();super.clear();}
}
