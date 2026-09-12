import { makeFloor, cliffGeometry, shipHullGeometry } from '../../src/render/environment.js';
import { WorldMap, roomContains } from '../../src/game/world.js';
import { makeBoss, makeHero } from '../../src/game/entities.js';
import { CAMPAIGN, getMission } from '../../src/data/campaign.js';

const require=(condition,message)=>{if(!condition)throw new Error(message);};

export function geometryChecks(){
  let floors=0,cliffs=0;
  for(const id of ['s02','w02','x02']){
    const world=new WorldMap(getMission(id));
    for(const room of world.rooms){
      const floor=makeFloor(room),p=floor.attributes.position,n=floor.attributes.normal;
      for(let i=0;i<p.count;i++){
        require(roomContains(room,{x:room.x+p.getX(i),z:room.z+p.getZ(i)},-.001),`${id}: floor outside collision boundary`);
        require(n.getY(i)>.99,`${id}: floor faces away from the camera`);
      }
      floors++;floor.dispose();
      const cliff=cliffGeometry(room,room.seed),cp=cliff.attributes.position,cn=cliff.attributes.normal;
      let outward=0;
      for(let i=0;i<cp.count;i++)outward+=cp.getX(i)*cn.getX(i)+cp.getZ(i)*cn.getZ(i);
      require(outward>0,`${id}: cliff faces inward`);cliffs++;cliff.dispose();
    }
  }
  const hull=shipHullGeometry(),hp=hull.attributes.position,hn=hull.attributes.normal;
  let outward=0;
  for(let i=0;i<hp.count;i++)outward+=hp.getX(i)*hn.getX(i)+hp.getZ(i)*hn.getZ(i);
  require(outward>0,'ship hull faces inward');hull.dispose();
  return {floors,cliffs,shipHull:true};
}

export function creatureChecks(app){
  const factory=app.renderer.characters;
  const beasts=[makeBoss('worldbeast',{x:0,z:0},1),makeHero('torren',app.profile,{x:0,z:0})];
  beasts[1].buffs.beast=10;
  for(const beast of beasts){
    const actor=factory.create(beast),skin=actor.mesh.geometry.attributes.skinIndex;
    try{
      for(const name of ['frontL','frontR','rearL','rearR']){
        const index=actor.bones.indexOf(actor.map[name]);
        require(index>=0,`missing quadruped joint ${name}`);
        let bound=false;
        for(let i=0;i<skin.count&&!bound;i++)bound=skin.getX(i)===index;
        require(bound,`${name}: visible leg is not attached to its joint`);
      }
      beast.moving=true;beast.moveSpeed=6;
      const before=actor.map.frontL.quaternion.clone();
      for(let i=0;i<15;i++)factory.animate(actor,beast,i/60,1/60);
      require(before.angleTo(actor.map.frontL.quaternion)>.03,'beast glides without moving its legs');
      require(actor.map.frontL.rotation.x*actor.map.frontR.rotation.x<0,'front legs do not alternate');
      const pose=actor.map.frontL.quaternion.clone();factory.animate(actor,beast,15/60,0);
      require(pose.angleTo(actor.map.frontL.quaternion)<1e-7,'paused creature animation changes pose');
    }finally{factory.destroy(actor);}
  }
  return {animatedForms:beasts.length,jointsPerForm:12};
}

export function interpolationCheck(app){
  const s=app.sim,r=app.renderer,h=s.activeHero;
  const saved={x:h.x,y:h.y,z:h.z,prevX:h.prevX,prevY:h.prevY,prevZ:h.prevZ,angle:h.angle,prevAngle:h.prevAngle};
  try{
    Object.assign(h,{x:2,z:10,y:0,prevX:0,prevZ:10,prevY:0,angle:.4,prevAngle:0});
    r.updateActors(0,.5);
    const actor=r.actors.get(h.id);
    require(Math.abs(actor.group.position.x-1)<1e-8,'renderer ignores interpolation fraction');
    require(h.x===2&&h.prevX===0,'renderer mutated the simulation');
    return true;
  }finally{Object.assign(h,saved);r.updateActors(0);}
}

export function regionResourceChecks(app){
  const samples=[];
  // Explicit render fixtures; this does not claim to complete any chapter.
  for(let cycle=0;cycle<3;cycle++){
    for(const index of [0,8,16,24,32]){
      app.launchMission(CAMPAIGN[index]);app.ui.skipDialogue();
      app.sim.update(1/60);app.renderer.render(0);
    }
    app.returnHub();app.renderer.render(0);
    samples.push({geometries:app.renderer.stats.geometries,textures:app.renderer.stats.textures});
  }
  require(samples[2].geometries<=samples[1].geometries+1,'scene transitions accumulate GPU geometries');
  require(samples[2].textures<=samples[1].textures+1,'scene transitions accumulate GPU textures');
  app.applySettings({...app.settings,ao:true,quality:'high'},false);app.renderer.render(0);
  app.applySettings({...app.settings,ao:false},false);
  return {regions:5,cycles:3,hubResources:samples,ambientOcclusion:true};
}
