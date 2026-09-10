import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/core/input.js';

/** Small event-target harness. No browser globals leak into other tests. */
function device(run) {
  const window = new EventTarget(), document = new EventTarget(), canvas = new EventTarget();
  let pads=[];
  const definitions={addEventListener:window.addEventListener.bind(window),document,navigator:{getGamepads:()=>pads}};
  const before=new Map(Object.keys(definitions).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [k,v] of Object.entries(definitions))Object.defineProperty(globalThis,k,{value:v,configurable:true});
  const input=new Input(canvas,{groundFromScreen:(x,z)=>({x,z}),zoom:()=>{},sim:{activeHero:{x:0,z:0}}});
  const fire=(target,type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,props);target.dispatchEvent(event);return event;};
  try {run({input,canvas,window,fire,setPads:p=>{pads=p;}});}
  finally {
    input.dispose();
    for(const [k,d] of before){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
  }
}

test('a complete keyboard tap between fixed ticks is delivered exactly once',()=>device(({input,window,fire})=>{
  fire(window,'keydown',{code:'KeyJ',repeat:false});fire(window,'keyup',{code:'KeyJ'});
  assert.equal(input.consume().attack,true);assert.equal(input.consume().attack,false);
  fire(window,'keydown',{code:'KeyK',repeat:false});fire(window,'keyup',{code:'KeyK'});
  assert.equal(input.consume().heavy,true);assert.equal(input.consume().heavy,false);
}));
test('mouse and touch attack taps survive a low rendering frame rate',()=>device(({input,canvas,window,fire})=>{
  fire(canvas,'pointerdown',{pointerType:'mouse',button:0,clientX:20,clientY:30});
  fire(window,'pointerup',{button:0});assert.equal(input.consume().attack,true);assert.equal(input.consume().attack,false);
  input.hold('heavy',true);input.hold('heavy',false);
  assert.equal(input.consume().heavy,true);assert.equal(input.consume().heavy,false);
}));
test('release after sustained input does not produce an endless attack',()=>device(({input,window,fire})=>{
  fire(window,'keydown',{code:'KeyJ',repeat:false});assert.equal(input.consume().attack,true);assert.equal(input.consume().attack,true);
  fire(window,'keyup',{code:'KeyJ'});assert.equal(input.consume().attack,false);
}));
test('disconnecting or disabling a gamepad clears stale movement and aim',()=>device(({input,setPads})=>{
  const buttons=Array.from({length:16},()=>({pressed:false,value:0}));buttons[7]={pressed:true,value:1};
  setPads([{axes:[1,0,1,0],buttons}]);input.pollGamepad();const a=input.consume();assert.equal(a.attack,true);assert.equal(a.moveX,1);assert.ok(a.aim);
  setPads([]);input.pollGamepad();const b=input.consume();assert.equal(b.attack,false);assert.equal(b.moveX,0);assert.equal(b.aim,null);
  setPads([{axes:[1,0,1,0],buttons}]);input.gamepadEnabled=false;input.pollGamepad();assert.equal(input.consume().moveX,0);
}));
test('blur and pause discard queued gameplay commands',()=>device(({input,window,fire})=>{
  input.press('skill1');fire(window,'blur');assert.equal(input.consume().skill1,false);
  input.hold('attack',true);input.setEnabled(false);assert.equal(input.consume().attack,false);
  input.press('skill2');input.consume();input.setEnabled(true);assert.equal(input.consume().skill2,false);
}));
test('keyboard and analogue stick diagonals are bounded to unit length',()=>device(({input,window,fire})=>{
  fire(window,'keydown',{code:'KeyD',repeat:false});fire(window,'keydown',{code:'KeyS',repeat:false});input.setStick(1,1);
  const a=input.consume();assert.ok(Math.abs(Math.hypot(a.moveX,a.moveY)-1)<1e-9);
}));
