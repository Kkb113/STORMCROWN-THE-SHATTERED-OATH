import { clearSegment } from './clearance.js';
import { NavigationGrid } from './navigation.js';
import { random, hashString, distance, segmentDistanceSq, clamp, normalize2, TAU } from '../core/math.js';

const LAYOUTS = {
  procession: [[0,0],[0,-54],[28,-105],[16,-158],[-18,-208],[0,-260]],
  switchback: [[0,0],[45,-35],[4,-81],[48,-129],[6,-174],[50,-225]],
  crossroads: [[0,0],[0,-57],[-56,-65],[-55,-124],[5,-133],[10,-190]],
  cloister: [[0,0],[-51,-31],[-40,-89],[20,-108],[63,-66],[76,-124]],
  descent: [[0,0],[43,-42],[1,-91],[43,-139],[1,-188],[42,-240]],
  citadel: [[0,0],[0,-60],[-46,-105],[0,-152],[0,-210],[40,-252]],
  arena: [[0,0],[0,-54],[0,-109],[42,-152],[0,-198],[0,-249]],
  finale: [[0,0],[-42,-48],[0,-105],[0,-168],[45,-214],[0,-258]],
  stormglass: [[0,0],[43,-43],[-10,-94],[20,-152]],
  spillway: [[0,0],[0,-55],[0,-130],[0,-225],[0,-300]],
};
const SPACES = { boss:23, fight:18.5, defend:19, rescue:18, escort:21, sabotage:19, collect:18, relay:18, escape:24, choice:16, oath:16, anchors:24, trial:25, eleven:25, hub:25 };

// The same convex outline is used for the visible deck and its collision edge.
// Coordinates are world x/z: the prow points toward negative z.
export const SHIP_HULL = Object.freeze([
  [-9,-22],[-8.4,-25],[-6,-27.8],[-3.3,-30],[0,-32],
  [3.3,-30],[6,-27.8],[8.4,-25],[9,-22],[10,20],
  [8.7,24],[5.5,27],[0,29],[-5.5,27],[-8.7,24],[-10,20],
].map(([x,z]) => Object.freeze({x,z})));
const SHIP_PLANES = SHIP_HULL.map((a,i) => {
  const b=SHIP_HULL[(i+1)%SHIP_HULL.length],length=distance(a,b);
  const nx=(b.z-a.z)/length,nz=(a.x-b.x)/length;
  return {nx,nz,limit:nx*a.x+nz*a.z};
});
function shipContains(p,margin=0) {
  return SHIP_PLANES.every(({nx,nz,limit}) => p.x*nx+p.z*nz <= limit-margin+1e-8);
}

/** Distance from a platform's center to its actual edge along a direction. */
export function roomEdgeDistance(room,dx,dz) {
  const length=Math.hypot(dx,dz);
  if(length<1e-8)return 0;
  const x=Math.abs(dx/length),z=Math.abs(dz/length);
  if(room.shape==='rect')return Math.min(x?room.width/(2*x):Infinity,z?room.depth/(2*z):Infinity);
  if(room.shape==='octagon')return Math.min(x?room.radius/x:Infinity,z?room.radius/z:Infinity,room.radius*1.4142/(x+z));
  return room.radius;
}

export function roomContains(room, p, margin = 0) {
  const x = p.x-room.x, z = p.z-room.z;
  if (room.shape === 'rect') return Math.abs(x) <= room.width/2-margin && Math.abs(z) <= room.depth/2-margin;
  if (room.shape === 'octagon') {
    const r = room.radius-margin;
    return Math.abs(x) <= r && Math.abs(z) <= r && Math.abs(x)+Math.abs(z) <= r*1.4142;
  }
  return x*x+z*z <= (room.radius-margin)**2;
}

/** Traversable geometry and rendering share this map; there are no invisible demo rooms. */
export class WorldMap {
  constructor(mission, seed = hashString(mission.id)) {
    this.mission = mission; this.seed = seed; this.rng = random(seed);
    this.rooms = []; this.bridges = []; this.obstacles = []; this.holes = []; this.nodes = []; this.edges = [];
    this.optional = []; this.isHub = mission.id === 'warden';
    if (this.isHub) this.buildShip(); else this.buildMission();
    this.buildNavigation();
    this.navigator=new NavigationGrid(this);
  }
  buildMission() {
    const positions = LAYOUTS[this.mission.layout] || LAYOUTS.procession;
    const region = this.mission.region, rng = this.rng;
    this.mission.stages.forEach((stage, index) => {
      const pos = positions[index % positions.length], radius = stage.lavaChase?36:SPACES[stage.type] || 18;
      const shape = stage.lavaChase?'rect':['boss','oath','anchors','trial','eleven'].includes(stage.type) ? 'circle' :
        (this.mission.layout === 'cloister' || region === 2 ? 'rect' : index % 3 === 1 ? 'octagon' : 'circle');
      const room = { id:index, stage:index, x:pos[0], z:pos[1], y:['descent','spillway'].includes(this.mission.layout) ? -index*3.5 : 0,
        radius, width:stage.lavaChase?26:radius*1.8, depth:stage.lavaChase?68:radius*1.8, shape, title:stage.title, kind:stage.type,
        theme:this.mission.theme, region, seed:hashString(this.mission.id+'-'+index), landmark:region };
      this.rooms.push(room);
      if (index > 0) this.connect(this.rooms[index-1],room, ['escape','escort'].includes(stage.type) ? 9 : 7.6);
      // Pillars and fallen blocks are placed outside the combat core and away from bridges.
      if (!['boss','anchors','trial','eleven','escape'].includes(stage.type)) for (let n=0;n<6;n++) {
        const angle = n*TAU/6 + .27, d = radius*.72;
        const p = { x:room.x+Math.sin(angle)*d, z:room.z+Math.cos(angle)*d };
        if (Math.abs(p.x-room.x) < 4.5) continue;
        this.obstacles.push({ ...p, y:room.y, radius: .9+rng()*.4, height:2+rng()*2, room:index, kind:n%2 ? 'pillar':'rubble', seed:rng.int(0,99999) });
      }
    });
    // Optional spaces reward navigation, not mandatory kill-count padding.
    if (this.mission.kind !== 'trial' && this.rooms.length > 1) {
      const anchor = this.rooms[0], sign = this.mission.layout === 'cloister' ? 1 : -1;
      const room = {id:this.rooms.length,stage:null,x:anchor.x+sign*43,z:anchor.z+8,y:anchor.y,radius:11,width:20,depth:20,shape:'circle',kind:'sanctuary',title:'A Quiet Place in the Storm',theme:'sanctuary',region,seed:seedFrom(this.seed,71)};
      this.rooms.push(room); this.connect(anchor,room,5.5);
      this.optional.push({id:'cache-0',room:room.id,x:room.x,z:room.z-2,kind:'cache',label:'Warden supply cache'});
      this.optional.push({id:'memory-0',room:room.id,x:room.x+4,z:room.z+3,kind:'memory',label:'A memory of this kingdom'});
      if (this.mission.stages.length >= 4) {
        const base = this.rooms[2], r = {id:this.rooms.length,stage:null,x:base.x+46,z:base.z+14,y:base.y,radius:10,width:18,depth:18,shape:'octagon',kind:'sanctuary',title:'The Forgotten Lookout',theme:'lookout',region,seed:seedFrom(this.seed,97)};
        // Do not create overlapping side islands in a tight layout.
        if (this.rooms.every(other => distance(r,other) > r.radius+other.radius+5)) {
          this.rooms.push(r); this.connect(base,r,5);
          this.optional.push({id:'cache-1',room:r.id,x:r.x,z:r.z,kind:'reliquary',label:'Forgotten reliquary'});
        }
      }
    }
    // Keep collision columns out of the approach and exit lanes.
    this.obstacles = this.obstacles.filter(o => !this.bridges.some(b => segmentDistanceSq(o,b.a,b.b) < (b.width*.65+o.radius)**2));
  }
  buildShip() {
    const base = {stage:null,y:1,theme:'ship',region:0,kind:'hub',seed:31};
    this.rooms = [
      {...base,id:0,x:0,z:0,radius:25,width:21,depth:46,shape:'rect',title:'The Warden • Main Deck'},
      {...base,id:1,x:0,z:-23,radius:9,width:18,depth:18,shape:'circle',title:'The Warden • The Prow'},
      {...base,id:2,x:0,z:22,radius:9,width:18,depth:18,shape:'circle',title:'The Warden • Quarterdeck'},
    ];
    this.connect(this.rooms[0],this.rooms[1],14); this.connect(this.rooms[0],this.rooms[2],14);
    this.obstacles = [-7,13].map(z=>({x:0,z,y:1,radius:.34,height:15.5,kind:'mast',room:0}));
  }
  connect(a,b,width) {
    const dx=b.x-a.x,dz=b.z-a.z,length=distance(a,b);
    this.bridges.push({ id:this.bridges.length,a:{x:a.x,y:a.y,z:a.z},b:{x:b.x,y:b.y,z:b.z},from:a.id,to:b.id,width,length,y:(a.y+b.y)/2,
      deckStart:roomEdgeDistance(a,dx,dz),deckEnd:length-roomEdgeDistance(b,-dx,-dz) });
  }
  buildNavigation() {
    this.nodes = this.rooms.map(r => ({id:r.id,x:r.x,z:r.z,y:r.y,room:r.id}));
    this.edges = this.nodes.map(() => []);
    for (const bridge of this.bridges) {
      const id = this.nodes.length;
      this.nodes.push({id,x:(bridge.a.x+bridge.b.x)/2,z:(bridge.a.z+bridge.b.z)/2,y:bridge.y,bridge:bridge.id});
      this.edges.push([bridge.from,bridge.to]);
      this.edges[bridge.from].push(id); this.edges[bridge.to].push(id);
    }
  }
  roomAt(p, margin = 0) { return this.rooms.find(r => roomContains(r,p,margin)) || null; }
  bridgeAt(p, margin = 0) { return this.bridges.find(b => segmentDistanceSq(p,b.a,b.b) <= Math.max(.5,b.width/2-margin)**2) || null; }
  heightAt(p) {
    if(this.isHub)return 1;
    const room = this.roomAt(p); if (room) return room.y;
    const b = this.bridgeAt(p);
    if (b) {
      const dx=b.b.x-b.a.x,dz=b.b.z-b.a.z,along=((p.x-b.a.x)*dx+(p.z-b.a.z)*dz)/(b.length||1);
      const t=clamp((along-b.deckStart)/Math.max(.001,b.deckEnd-b.deckStart),0,1);
      return b.a.y+(b.b.y-b.a.y)*t;
    }
    return this.rooms.reduce((a,b) => distance(p,a)<distance(p,b)?a:b).y;
  }
  isStaticWalkable(p, radius = .55, ignoreObstacles = false) {
    if(this.isHub ? !shipContains(p,radius) : !this.roomAt(p,radius) && !this.bridgeAt(p,radius)) return false;
    if (!ignoreObstacles)for(const o of this.obstacles)if((p.x-o.x)**2+(p.z-o.z)**2<(o.radius+radius)**2)return false;
    return true;
  }
  isWalkable(p, radius = .55, ignoreObstacles = false) {
    if(!this.isStaticWalkable(p,radius,ignoreObstacles))return false;
    for(const h of this.holes)if((p.x-h.x)**2+(p.z-h.z)**2<(h.radius+radius)**2)return false;
    return true;
  }
  /** Swept substeps prevent fast dashes tunnelling across gaps or through columns. */
  move(entity, dx, dz, ignoreObstacles = false) {
    const count = Math.max(1,Math.ceil(Math.hypot(dx,dz)/.45));
    const sx=dx/count,sz=dz/count,r=entity.radius || .55;
    for (let i=0;i<count;i++) {
      let next={x:entity.x+sx,z:entity.z+sz};
      if (this.isWalkable(next,r,ignoreObstacles)) {entity.x=next.x;entity.z=next.z;continue;}
      next={x:entity.x+sx,z:entity.z};
      if (this.isWalkable(next,r,ignoreObstacles)) entity.x=next.x;
      next={x:entity.x,z:entity.z+sz};
      if (this.isWalkable(next,r,ignoreObstacles)) entity.z=next.z;
    }
  }
  clearLine(a,b,radius = .55) {
    if(this.isHub){
      // Both endpoints inside a convex inset imply the entire segment is on deck.
      return shipContains(a,radius)&&shipContains(b,radius)&&
        [...this.obstacles,...this.holes].every(o=>segmentDistanceSq(o,a,b)>=(o.radius+radius)**2);
    }
    return clearSegment(this,a,b,radius);
  }
  nearestNode(p) {
    let best=0, score=Infinity;
    for (const node of this.nodes) {
      const d=distance(p,node)+(this.clearLine(p,node,.4)?0:1000);
      if (d<score) {score=d;best=node.id;}
    }
    return best;
  }
  path(from,to,radius=.55) {
    if(this.clearLine(from,to,radius))return [{x:to.x,z:to.z}];
    return this.navigator.find(from,to,radius);
  }
  steer(entity,target,dt,speed = entity.speed) {
    if (distance(entity,target)<.25) return false;
    if (!entity.nav || (entity.navTime || 0)<=0 || distance(entity.navTarget || entity,target)>3) {
      entity.nav=this.path(entity,target,entity.radius || .55); entity.navTime=.4; entity.navSightTime=0; entity.navTarget={x:target.x,z:target.z};
    }
    entity.navTime-=dt;
    while (entity.nav.length>1 && (distance(entity,entity.nav[0])<.18 || (distance(entity,entity.nav[0])<1.5 && this.clearLine(entity,entity.nav[1],entity.radius || .55)))) entity.nav.shift();
    entity.navSightTime=(entity.navSightTime || 0)-dt;
    if(entity.navSightTime<=0){entity.navDirect=this.clearLine(entity,target,entity.radius || .55);entity.navSightTime=.12;}
    const goal=entity.navDirect?target:(entity.nav[0] || target);
    const dir=normalize2(goal.x-entity.x,goal.z-entity.z),angle=Math.atan2(dir.x,dir.z);
    let bestAngle=angle;
    if (!this.isWalkable({x:entity.x+dir.x*1.1,z:entity.z+dir.z*1.1},entity.radius || .55)) {
      let best=Infinity;
      for (const off of [.55,-.55,1.1,-1.1,1.7,-1.7,2.4,-2.4]) {
        const a=angle+off,p={x:entity.x+Math.sin(a)*1.2,z:entity.z+Math.cos(a)*1.2};
        if (this.isWalkable(p,entity.radius || .55) && distance(p,goal)<best) {best=distance(p,goal);bestAngle=a;}
      }
    }
    const oldX=entity.x,oldZ=entity.z;
    this.move(entity,Math.sin(bestAngle)*speed*dt,Math.cos(bestAngle)*speed*dt);
    return Math.hypot(entity.x-oldX,entity.z-oldZ)>dt*.1;
  }
  point(roomIndex, angle = 0, proportion = .65, radius = .65) {
    const room=this.rooms[roomIndex],d=room.radius*proportion;
    const p={x:room.x+Math.sin(angle)*d,z:room.z+Math.cos(angle)*d};
    if (this.isWalkable(p,radius)) return p;
    for (let i=0;i<30;i++) {
      const a=angle+i*.23,q={x:room.x+Math.sin(a)*d*(1-i*.018),z:room.z+Math.cos(a)*d*(1-i*.018)};
      if (this.isWalkable(q,radius)) return q;
    }
    return {x:room.x,z:room.z};
  }
  entry(index) {
    const room=this.rooms[index];
    if (index===0) return {x:room.x,z:room.z+room.radius*.57};
    const prev=this.rooms[index-1],dir=normalize2(prev.x-room.x,prev.z-room.z);
    return {x:room.x+dir.x*room.radius*.7,z:room.z+dir.z*room.radius*.7};
  }
  exit(index) {
    const room=this.rooms[index],next=this.rooms[index+1];
    if (!next || next.stage===null) return {x:room.x,z:room.z-room.radius*.5};
    const dir=normalize2(next.x-room.x,next.z-room.z);
    return {x:room.x+dir.x*room.radius*.77,z:room.z+dir.z*room.radius*.77};
  }
  update(dt) { for (const h of this.holes) h.life-=dt; this.holes=this.holes.filter(h=>h.life>0); }
}
function seedFrom(seed,index) { return (seed+index*27183)>>>0; }
export function hubMap() { return new WorldMap({id:'warden',region:0,theme:'ship',layout:'ship',stages:[{type:'hub',title:'The Warden'}]}); }
