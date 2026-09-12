import { Pilot } from './pilot.mjs';

const pilots=new WeakMap();
/** Run real commands and age the production presentation while GPU submission
 * is deferred. A screenshot must not contain minutes of unexpired effects. */
export function drive(app,{until=()=>false,maxSeconds=600}={}){
  const sim=app.sim,step=1/60;
  let pilot=pilots.get(sim);
  if(!pilot){pilot=new Pilot(sim);pilots.set(sim,pilot);}
  let result=null,reason=null;
  const offComplete=sim.on('missionComplete',e=>{result=e.result;});
  const offDefeat=sim.on('defeat',e=>{reason=e.reason;});
  try{
    for(let i=0;i<maxSeconds/step&&sim.state==='running'&&!until(sim);i++){
      sim.update(step,pilot.input());app.profile.elapsed+=step;
      app.renderer.update(step);app.ui.update(step);app.audio.update(step);
    }
    app.renderer.render(0);app.ui.hud.update(0,true);
    return {state:sim.state,stage:sim.director.index,clock:sim.director.clock,
      hazards:sim.hazards.map(h=>h.visual),result,reason,elapsed:sim.elapsed};
  }finally{offComplete();offDefeat();}
}
