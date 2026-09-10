import * as THREE from 'three';
import { REGIONS } from '../data/regions.js';
import { random, TAU, distance, hashString, normalize2 } from '../core/math.js';
import { GeometryBatch, bevelBox, shardGeometry, tube, flatRing, archGeometry, cylinderBetween, planeUV, disposeGroup } from './geometry.js';

const CUBE=bevelBox(1,1,1,.045),CYLINDER=new THREE.CylinderGeometry(1,1,1,12),ROCK=shardGeometry(182,1);
const NOISE=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.07+vec2(9.2,4.7);a*=.48;}return v;}`;

function cliffGeometry(room,seed){
  const rng=random(seed),segments=64,rings=6,p=[],uv=[],idx=[];
  const phases=Array.from({length:segments},()=>rng());
  for(let y=0;y<rings;y++)for(let i=0;i<=segments;i++){
    const a=(i%segments)*TAU/segments,edge=phases[i%segments],scale=[1.018,1.025,.94,.79,.56,.12][y],rr=room.radius*(scale+(edge-.5)*(.07+y*.025));
    let x=Math.sin(a)*rr,z=Math.cos(a)*rr;
    if(room.shape==='rect'){const factor=1/Math.max(Math.abs(Math.sin(a)),Math.abs(Math.cos(a)));x*=factor*.90;z*=factor*.90;}
    p.push(x,-.28-y*(2.3+edge*.75),z);uv.push(i/segments*12,y*.75);
  }
  for(let y=0;y<rings-1;y++)for(let i=0;i<segments;i++){const a=y*(segments+1)+i,b=a+segments+1;idx.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function makeFloor(room){
  let g;if(room.shape==='rect'){g=new THREE.PlaneGeometry(room.width,room.depth,1,1);g.rotateX(-Math.PI/2);}
  else {g=new THREE.CircleGeometry(room.radius,room.shape==='octagon'?8:96);g.rotateX(-Math.PI/2);if(room.shape==='octagon'){g.rotateY(Math.PI/8);g.scale(1.06,1,1.06);}}
  return planeUV(g,'xz',.15);
}

export class Environment {
  constructor(scene,materials){
    this.scene=scene;this.materials=materials;this.group=new THREE.Group();this.scene.add(this.group);this.rooms=new Map();this.bridgeGroup=new THREE.Group();this.group.add(this.bridgeGroup);
    this.torches=[];this.banners=[];this.special=[];this.dynamicObjects=new Map();this.farGroup=new THREE.Group();this.group.add(this.farGroup);this.streamClock=0;
    this.flagUniform={value:0};this.flagMaterial=null;this.waterfallMaterial=null;this.lavaMaterial=null;
    this.torchLights=Array.from({length:3},()=>{const l=new THREE.PointLight(0xffa057,0,20,2);scene.add(l);return l;});
    this.sky=this.makeSky();scene.add(this.sky);this.pooledMaterials=[];
  }
  makeSky(){
    const m=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:{value:0},top:{value:new THREE.Color(0x111824)},bottom:{value:new THREE.Color(0x435372)},flash:{value:0}},vertexShader:`varying vec3 vDirection; void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection; uniform vec3 top; uniform vec3 bottom; uniform float time; uniform float flash; ${NOISE} void main(){vec3 d=normalize(vDirection);float h=clamp(d.y*.65+.25,0.,1.);vec2 p=d.xz/max(.15,abs(d.y))*.8;float cloud=fbm(p+vec2(time*.008,time*.003));float filaments=fbm(p*2.5+cloud*2.);vec3 col=mix(bottom,top,smoothstep(-.3,.65,d.y));col+=vec3(.12,.14,.22)*(cloud-.4)*(.4+filaments)*smoothstep(.6,-.5,d.y);col+=flash*vec3(.4,.3,.9)*pow(cloud,3.);gl_FragColor=vec4(col,1.);}`});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(550,32,20),m);mesh.frustumCulled=false;mesh.renderOrder=-10;return mesh;
  }
  setWorld(sim){
    this.sim=sim;this.clearWorld();this.world=sim.world;this.region=sim.mission.region;this.palette=this.materials.region(this.region);this.r=REGIONS[this.region];
    this.sky.material.uniforms.top.value.set(this.r.sky);this.sky.material.uniforms.bottom.value.set(this.r.fog).multiplyScalar(1.9);
    this.makeFlags();this.makeFlowMaterials();
    if(this.world.isHub)this.buildShip();else{this.buildBridges();this.buildDistant();this.stream(sim.activeHero,true);}
    this.updateObjects(0);
  }
  makeFlags(){
    this.flagMaterial=this.palette.cloth.clone();this.pooledMaterials.push(this.flagMaterial);
    this.flagMaterial.onBeforeCompile=shader=>{shader.uniforms.uWindTime=this.flagUniform;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWindTime;').replace('#include <begin_vertex>','#include <begin_vertex>\nfloat windStrength=1.0-uv.y;transformed.z += (sin(position.y*2.4+uWindTime*2.1+position.x*.7)*.16+sin(position.y*4.+uWindTime*3.)*.07)*windStrength; transformed.x += sin(uWindTime+position.y)*.09*windStrength;');};
    this.flagMaterial.customProgramCacheKey=()=> 'stormcrown-banners-v2';
  }
  makeFlowMaterials(){
    const uniforms={time:{value:0},color:{value:new THREE.Color(this.region===1?0xff6522:0x8dadcb)}};
    this.waterfallMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 color;${NOISE}void main(){float stream=fbm(vec2(vUv.x*18.,vUv.y*5.+time*1.4));float ribs=noise(vec2(vUv.x*75.,vUv.y*3.+time*3.));float edge=smoothstep(0.,.16,vUv.x)*smoothstep(1.,.84,vUv.x);float mist=smoothstep(0.,.15,vUv.y);gl_FragColor=vec4(color*(.65+stream*.65+ribs*.25),edge*mist*(.24+stream*.45));}`});
    this.lavaMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;${NOISE}void main(){vec2 p=vUv*15.;float n=fbm(p+vec2(time*.024,-time*.031));float crack=pow(1.-abs(n-.5)*2.,14.);vec3 col=mix(vec3(.025,.007,.012),vec3(1.5,.21,.025),crack);col+=pow(crack,3.)*vec3(1.8,.66,.075);gl_FragColor=vec4(col,1.);}`});
    this.pooledMaterials.push(this.waterfallMaterial,this.lavaMaterial);
  }
  clearWorld(){
    for(const room of this.rooms.values())disposeGroup(room.group);this.rooms.clear();
    for(const obj of this.dynamicObjects.values())disposeGroup(obj.group);this.dynamicObjects.clear();
    disposeGroup(this.bridgeGroup);disposeGroup(this.farGroup);
    for(const child of [...this.group.children])if(child!==this.bridgeGroup&&child!==this.farGroup){disposeGroup(child);this.group.remove(child);}
    for(const m of this.pooledMaterials||[])m.dispose();this.pooledMaterials=[];this.torches=[];this.banners=[];this.special=[];
  }
  buildRoom(room){
    const rng=random(room.seed),group=new THREE.Group();group.position.set(room.x,room.y,room.z);this.group.add(group);
    const batch=new GeometryBatch(),p=this.palette,r=room.radius,segmentCount=room.shape==='rect'?32:40;
    const floor=makeFloor(room);batch.add(floor,p.stone);floor.dispose();
    const cliff=cliffGeometry(room,room.seed);batch.add(cliff,p.rock);cliff.dispose();
    // Radial ashlar masonry with carved, weathered edges and broken crenellations.
    for(let i=0;i<segmentCount;i++){
      const a=i*TAU/segmentCount,pos=this.perimeter(room,a,r-.2),gap=this.isBridgeOpening(room,pos);
      const blockWidth=TAU*r/segmentCount*.93;
      batch.add(CUBE,p.brick,[pos.x,-.15,pos.z],[0,a,0],[blockWidth,.52,1.05]);
      batch.add(CUBE,p.trim,[pos.x,.13,pos.z],[0,a,0],[blockWidth,.075,.16]);
      if(!gap && i%3!==1){batch.add(CUBE,p.brick,[pos.x,.62,pos.z],[0,a,0],[blockWidth*.8,.8,1]);batch.add(CUBE,p.dark,[pos.x,1.1,pos.z],[0,a,0],[blockWidth*.88,.2,1.13]);}
      if(!gap && i%6===0){this.tower(batch,group,pos.x,pos.z,2.2+rng()*1.4,a,room);}
    }
    // Inlaid circles echo the reference, but processional streets also carry broken linear routes.
    if(room.shape!=='rect'){
      for(const rr of [r*.9,r*.84]){const ring=flatRing(rr-.03,rr+.03,96);batch.add(ring,p.trim,[0,.022,0]);ring.dispose();}
      for(let i=0;i<8;i++){const a=i*TAU/8,g=flatRing(r*.34,r*.35,32);batch.add(g,p.trim,[0,.025,0]);g.dispose();break;}
    }else{
      for(const side of [-1,1])batch.add(CUBE,p.trim,[side*room.width*.41,.025,0],[0,0,0],[.08,.04,room.depth*.92]);
    }
    const rune=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(26,r*1.1),Math.min(26,r*1.1)),this.materials.runeMaterial(this.r.trim,this.region===0?.14:.08));rune.rotation.x=-Math.PI/2;rune.position.y=.037;group.add(rune);
    for(let i=0;i<18;i++){
      const a=rng()*TAU,d=r*(.73+rng()*.18),pos=this.perimeter(room,a,d);if(this.isBridgeOpening(room,pos))continue;
      batch.add(ROCK,p.rock,[pos.x,.13,pos.z],[rng()*.2,rng()*TAU,rng()*.2],[.2+rng()*.55,.10+rng()*.38,.2+rng()*.7]);
      if(i%4===0)batch.add(CUBE,p.dark,[pos.x,-2-rng()*5,pos.z],[rng(),a,rng()],[1.5+rng()*2.5,2+rng()*4,1+rng()*2]);
    }
    for(const obstacle of this.world.obstacles.filter(o=>o.room===room.id)){
      const x=obstacle.x-room.x,z=obstacle.z-room.z;
      if(obstacle.kind==='pillar'){this.column(batch,x,z,obstacle.height,obstacle.radius*.63);}
      else {batch.add(CUBE,p.brick,[x,.52,z],[.14,obstacle.seed*.4,-.35],[2.4,1.25,1.3]);batch.add(ROCK,p.rock,[x+.7,.2,z+.8],[.3,.4,.2],[.65,.35,.7]);}
    }
    // Hero architecture is authored by region, with composition kept outside the readable combat core.
    if(room.kind!=='sanctuary'){
      if(this.region===0)this.stormArchitecture(batch,group,room);
      if(this.region===1)this.furnaceArchitecture(batch,group,room);
      if(this.region===2)this.cathedralArchitecture(batch,group,room);
      if(this.region===3)this.forestArchitecture(batch,group,room);
      if(this.region===4)this.crownArchitecture(batch,group,room);
    }
    if(this.r.wet){for(let i=0;i<4;i++){
      const puddle=new THREE.Mesh(new THREE.CircleGeometry(1,32),this.materials.plain(0x47566d,.08,.53,{transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
      puddle.rotation.x=-Math.PI/2;puddle.scale.set(2+rng()*3,1.2+rng()*2.5,1);puddle.position.set((rng()-.5)*r,0.045,(rng()-.5)*r);group.add(puddle);
    }}
    batch.build(group,true);
    if(this.region===1){const lava=new THREE.Mesh(new THREE.CircleGeometry(r*.92,72),this.lavaMaterial);lava.rotation.x=-Math.PI/2;lava.position.y=-13;group.add(lava);}
    this.rooms.set(room.id,{group,room});return group;
  }
  perimeter(room,a,r){
    const sin=Math.sin(a),cos=Math.cos(a);let f=1;
    if(room.shape==='rect')f=.9/Math.max(Math.abs(sin),Math.abs(cos));
    else if(room.shape==='octagon')f=Math.min(1/Math.max(Math.abs(sin),Math.abs(cos)),1.4142/(Math.abs(sin)+Math.abs(cos)));
    return {x:sin*r*f,z:cos*r*f};
  }
  isBridgeOpening(room,p){
    return this.world.bridges.some(br=>{
      if(br.from!==room.id&&br.to!==room.id)return false;
      const other=this.world.rooms[br.from===room.id?br.to:br.from],a=Math.atan2(other.x-room.x,other.z-room.z),b=Math.atan2(p.x,p.z);return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<.26;
    });
  }
  column(batch,x,z,height=5,r=.65){
    const p=this.palette;
    batch.add(CUBE,p.dark,[x,.18,z],[0,0,0],[r*2.9,.36,r*2.9]);batch.add(CUBE,p.brick,[x,.48,z],[0,Math.PI/4,0],[r*2.15,.3,r*2.15]);
    batch.add(CYLINDER,p.brick,[x,height*.5+.55,z],[0,0,0],[r*.8,height,r*.8]);
    for(const y of [.65,height+.35]){batch.add(CYLINDER,p.trim,[x,y,z],[0,0,0],[r,.13,r]);batch.add(CUBE,p.brick,[x,y+.17,z],[0,0,0],[r*2.25,.22,r*2.25]);}
    for(let i=0;i<6;i++){const a=i*TAU/6;batch.add(CYLINDER,p.dark,[x+Math.sin(a)*r*.73,height*.5+.55,z+Math.cos(a)*r*.73],[0,0,0],[.036,height*.92,.036]);}
  }
  tower(batch,group,x,z,height,angle,room){
    const p=this.palette;
    batch.add(CUBE,p.brick,[x,height*.5,z],[0,angle,0],[1.55,height,1.55]);
    for(const y of [.35,height-.25,height+.02])batch.add(CUBE,p.dark,[x,y,z],[0,angle,0],[1.84,.23,1.84]);
    for(let side of [-1,1])batch.add(CUBE,p.trim,[x+Math.cos(angle)*side*.77,height*.5,z-Math.sin(angle)*side*.77],[0,angle,0],[.07,height*.8,.95]);
    const bowl=new THREE.CylinderGeometry(.73,.40,.37,12,1,true);batch.add(bowl,p.trim,[x,height+.32,z]);bowl.dispose();
    batch.add(CYLINDER,p.dark,[x,height+.2,z],[0,0,0],[.72,.12,.72]);
    for(let i=0;i<4;i++){const a=i*TAU/4;batch.add(CUBE,p.dark,[x+Math.sin(a)*.65,height+.62,z+Math.cos(a)*.65],[0,a,0],[.12,.5,.12]);}
    this.torches.push({x:x+room.x,y:height+.6+room.y,z:z+room.z,room:room.id,group});
  }
  banner(group,x,y,z,angle=0,scale=1){
    const root=new THREE.Group();root.position.set(x,y,z);root.rotation.y=angle;root.scale.setScalar(scale);
    const geo=new THREE.PlaneGeometry(1.75,3.8,8,18),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const v=(1-geo.attributes.uv.getY(i));pos.setX(i,pos.getX(i)*(1-.10*v));if(v>.93)pos.setY(i,pos.getY(i)+Math.abs(pos.getX(i))*.4);}geo.computeVertexNormals();
    const cloth=new THREE.Mesh(geo,this.flagMaterial);cloth.castShadow=true;root.add(cloth);
    const crest=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.25),this.materials.runeMaterial(0xb6b6c3,.04));crest.position.set(0,.45,.028);root.add(crest);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,2.1,8),this.palette.trim);rod.rotation.z=Math.PI/2;rod.position.y=1.97;root.add(rod);group.add(root);return root;
  }
  stormArchitecture(batch,group,room){
    const p=this.palette,r=room.radius;
    for(const s of [-1,1]){
      const x=s*r*.67,z=-r*.68;
      this.column(batch,x,z,7.2,.9);
      const cap=new THREE.ConeGeometry(.75,2.2,6);batch.add(cap,p.dark,[x,9.1,z]);cap.dispose();
      batch.add(CYLINDER,p.trim,[x,9.0,z],[0,0,0],[.15,3.4,.15]);
      const gem=new THREE.OctahedronGeometry(.35);batch.add(gem,p.glow,[x,10.75,z]);gem.dispose();
      const a=archGeometry(4.8,6,.38,.68,12);batch.add(a,p.brick,[x-s*2.4,.2,z],[0,s*.12,0]);a.dispose();
      this.banner(group,x-s*.6,4,z+.68,s*.12,1.1);
    }
    if(room.kind==='boss'){
      for(let i=0;i<3;i++){const a=Math.PI+(i-1)*.26,x=Math.sin(a)*r*.96,z=Math.cos(a)*r*.96;this.column(batch,x,z,9+i%2*3,.65);}
    }
  }
  furnaceArchitecture(batch,group,room){
    const p=this.palette,r=room.radius;
    for(const s of [-1,1]){
      const x=s*r*.68,z=-r*.53;batch.add(CUBE,p.dark,[x,2.25,z],[0,.1*s,0],[3.6,4.5,3]);
      const arch=archGeometry(2.1,3.6,.48,.55,12);batch.add(arch,p.trim,[x,.2,z+1.6]);arch.dispose();
      const fire=new THREE.Mesh(new THREE.PlaneGeometry(1.9,3.1),this.lavaMaterial);fire.position.set(x,1.75,z+1.53);group.add(fire);
      this.column(batch,x+s*2.1,z,8.5,.7);
      for(let i=0;i<12;i++){const a=i*.2,link=new THREE.TorusGeometry(.22,.07,5,10);batch.add(link,p.dark,[x+s*(2.6+Math.sin(a)*.45),7.7-i*.57,z+Math.cos(a)*.3],[i%2?Math.PI/2:0,0,.16*s]);link.dispose();}
      this.banner(group,x+s*2.1,4.6,z+.8,0,.85);
    }
  }
  cathedralArchitecture(batch,group,room){
    const p=this.palette,r=room.radius,ice=this.materials.plain(0xb6dbe7,.15,.23,{transparent:true,opacity:.76});
    for(const s of [-1,1])for(let i=0;i<3;i++){
      const x=s*r*.79,z=(i-1)*r*.51;this.column(batch,x,z,8.5, .75);
      const a=archGeometry(6,9,.26,.48,16);batch.add(a,p.brick,[x-s*3.05,.1,z],[0,Math.PI/2,0]);a.dispose();
      const pin=new THREE.ConeGeometry(.7,3.3,6);batch.add(pin,ice,[x,11,z]);pin.dispose();
      if(i===0)this.banner(group,x-s*.4,5,z,Math.PI/2*s,.8);
    }
    for(let i=0;i<10;i++){const a=i*2.399,x=Math.sin(a)*r*.82,z=Math.cos(a)*r*.82;const g=shardGeometry(i,0);batch.add(g,ice,[x,.9,z],[0,a,.2],[.3,.9+i%3*.35,.37]);g.dispose();}
    // Frozen citizens are embedded silhouettes in the time-fractured crystal, not collectible clutter.
    for(let i=0;i<4;i++){const x=(i%2?1:-1)*r*.71,z=(i-1.5)*3.5;batch.add(CYLINDER,p.bone,[x,.9,z],[0,0,0],[.24,1.55,.23]);const head=new THREE.SphereGeometry(.22,8,6);batch.add(head,p.bone,[x,1.9,z]);head.dispose();const crystal=new THREE.OctahedronGeometry(1);batch.add(crystal,ice,[x,1.35,z],[0,.4,0],[.7,1.65,.65]);crystal.dispose();}
  }
  forestArchitecture(batch,group,room){
    const p=this.palette,rng=random(room.seed+717),r=room.radius,foliage=this.materials.plain(0x385c40,.9,.01,{side:THREE.DoubleSide});
    const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.26,.42,.04,0,.95,0,0,0,0,0,.95,0,.26,.42,.04],3));leafGeo.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.45,.5,1,.5,0,.5,1,1,.45],2));leafGeo.computeVertexNormals();
    const leaves=new THREE.InstancedMesh(leafGeo,foliage,480);let leafIndex=0,mat=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),scale=new THREE.Vector3();
    for(let i=0;i<5;i++){
      const a=i*TAU/5+.7,x=Math.sin(a)*r*.87,z=Math.cos(a)*r*.87,h=6+rng()*4;
      const g=tube([[x,0,z],[x+.3,h*.3,z+.2],[x-.2,h*.65,z-.4],[x+.8,h,z]],.5+rng()*.22,7);batch.add(g,p.wood);g.dispose();
      for(let b=0;b<4;b++){
        const ba=a+b*1.7,end=[x+Math.sin(ba)*3.5,h*.65+rng()*2,z+Math.cos(ba)*3.5];
        const branch=tube([[x,h*.42,z],[x+Math.sin(ba),h*.62,z+Math.cos(ba)],end],.14,5);batch.add(branch,p.wood);branch.dispose();
        const root=tube([[x,.9,z],[x-Math.sin(ba)*2,.22,z-Math.cos(ba)*2],[x-Math.sin(ba)*4,.02,z-Math.cos(ba)*4]],.17,5);batch.add(root,p.wood);root.dispose();
        for(let l=0;l<24;l++){
          v.set(end[0]+(rng()-.5)*3,end[1]+(rng()-.5)*2,end[2]+(rng()-.5)*3);q.setFromEuler(new THREE.Euler(-.3-rng()*1.8,rng()*TAU,rng()*TAU));scale.setScalar(.7+rng()*.8);mat.compose(v,q,scale);leaves.setMatrixAt(leafIndex,mat);leaves.setColorAt(leafIndex,new THREE.Color().setHSL(.25+rng()*.12,.2+rng()*.3,.16+rng()*.13));leafIndex++;
        }
      }
      if(i%2===0){this.column(batch,x*.86,z*.86,3+rng()*3,.6);}
    }
    leaves.instanceMatrix.needsUpdate=true;if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;leaves.castShadow=false;group.add(leaves);
    for(let i=0;i<6;i++){const a=i*1.57,x=Math.sin(a)*r*.4,z=Math.cos(a)*r*.4;const root=tube([[x,.035,z],[x+2,.08,z-1],[x+4,.06,z-2],[x+5,0,z-3]],.055,5);batch.add(root,p.wood);root.dispose();}
  }
  crownArchitecture(batch,group,room){
    const p=this.palette,r=room.radius;
    for(const s of [-1,1]){
      const x=s*r*.72,z=-r*.61;this.column(batch,x,z,10.5,.85);
      const a=archGeometry(5.5,9,.55,.8,16);batch.add(a,p.dark,[x-s*2.8,.1,z]);a.dispose();
      const b=archGeometry(5.5,9,.08,.1,16);batch.add(b,p.trim,[x-s*2.8,.2,z+.48]);b.dispose();
      this.banner(group,x-s*.2,5.8,z+.8,0,1.3);
      for(let i=0;i<4;i++){const gem=new THREE.OctahedronGeometry(.24);batch.add(gem,p.glow,[x,2+i*1.7,z+.85]);gem.dispose();}
    }
    if(room.kind==='boss'||room.kind==='anchors'){
      for(let i=0;i<5;i++){const a=(i-2)*.23+Math.PI,x=Math.sin(a)*r*.98,z=Math.cos(a)*r*.98;const g=new THREE.ConeGeometry(.6,6+(i===2?3:0),4);batch.add(g,p.trim,[x,8,z],[0,a,0]);g.dispose();this.column(batch,x,z,5,.6);}
    }
  }
  buildBridges(){
    const batch=new GeometryBatch(),p=this.palette;
    for(const b of this.world.bridges){
      const a=this.world.rooms[b.from],z=this.world.rooms[b.to],dir=normalize2(z.x-a.x,z.z-a.z),len=distance(a,z),angle=Math.atan2(dir.x,dir.z),start=a.radius*.81,end=len-z.radius*.81;
      const real=Math.max(1,end-start),steps=Math.ceil(real/2.1);
      for(let i=0;i<steps;i++){
        const t=start+(i+.5)*real/steps,x=a.x+dir.x*t,zz=a.z+dir.z*t,y=a.y+(z.y-a.y)*t/len;
        batch.add(CUBE,p.brick,[x,y-.28,zz],[Math.atan2(z.y-a.y,len),angle,0],[b.width,.55,real/steps*.985]);
        if(i%2===0){for(let s of [-1,1]){const px=x+Math.cos(angle)*s*(b.width/2-.2),pz=zz-Math.sin(angle)*s*(b.width/2-.2);batch.add(CUBE,p.dark,[px,y+.3,pz],[0,angle,0],[.45,1.05,.5]);batch.add(CUBE,p.trim,[px,y+.88,pz],[0,angle,0],[.57,.1,.6]);}}
        for(const s of [-1,1])batch.add(CUBE,p.trim,[x+Math.cos(angle)*s*b.width*.41,y+.025,zz-Math.sin(angle)*s*b.width*.41],[0,angle,0],[.065,.055,real/steps]);
      }
    }
    batch.build(this.bridgeGroup,true);
  }
  buildDistant(){
    const rng=random(hashString(this.sim.mission.id+'sky')),batch=new GeometryBatch(),p=this.palette;
    for(let i=0;i<22;i++){
      const side=i%2?1:-1,x=side*(58+rng()*140),z=50-i*20+rng()*20,y=-15-rng()*28,r=6+rng()*12;
      const room={radius:r,shape:'circle'},cliff=cliffGeometry(room,999+i);batch.add(cliff,p.rock,[x,y,z]);cliff.dispose();
      batch.add(CUBE,p.brick,[x,y+1.5,z],[0,rng()*.4,0],[r*1.3,3,r*.9]);
      for(let n=0;n<3;n++){
        const xx=x+(n-1)*r*.5,h=8+rng()*17;batch.add(CUBE,p.dark,[xx,y+h/2,z],[0,.12,0],[2.3,h,2.3]);
        const spire=new THREE.ConeGeometry(1.7,5,4);batch.add(spire,p.dark,[xx,y+h+2,z],[0,Math.PI/4,0]);spire.dispose();
      }
      if(this.region!==1&&i%3===0){const flow=new THREE.Mesh(new THREE.PlaneGeometry(6+rng()*4,45),this.waterfallMaterial);flow.position.set(x+r*.5,y-22,z+4);flow.rotation.y=-.35;this.farGroup.add(flow);}
    }
    batch.build(this.farGroup,false);
    if(this.region===4){const crown=new THREE.Group();crown.position.set(0,34,-320);const g=new THREE.TorusGeometry(20,.35,6,72);const ring=new THREE.Mesh(g,p.trim);ring.rotation.x=Math.PI/2;crown.add(ring);for(let i=0;i<7;i++){const a=i*TAU/7,spire=new THREE.Mesh(new THREE.ConeGeometry(1.7,13,5),p.trim);spire.position.set(Math.sin(a)*20,5,Math.cos(a)*20);crown.add(spire);}this.farGroup.add(crown);}
  }
  buildShip(){
    const group=new THREE.Group();this.group.add(group);const batch=new GeometryBatch(),p=this.palette;
    // A shaped hull, inset deck planks, gilded rails and a suspended rune engine establish a real mobile home.
    const shape=new THREE.Shape();shape.moveTo(-9,-22);shape.quadraticCurveTo(-10.5,-25,0,-32);shape.quadraticCurveTo(10.5,-25,9,-22);shape.lineTo(10,20);shape.quadraticCurveTo(8,27,0,29);shape.quadraticCurveTo(-8,27,-10,20);shape.closePath();
    const deck=new THREE.ShapeGeometry(shape,24);deck.rotateX(-Math.PI/2);planeUV(deck,'xz',.18);batch.add(deck,p.wood,[0,1,0]);deck.dispose();
    for(let level=0;level<5;level++){
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:true,bevelSize:.18,bevelThickness:.15,bevelSegments:1,curveSegments:12});geo.rotateX(-Math.PI/2);batch.add(geo,level%2?p.wood:p.dark,[0,.05-level*.73,0],[0,0,0],[1-level*.06,1,1-level*.035]);geo.dispose();
    }
    for(let s of [-1,1]){
      for(let i=0;i<16;i++){const z=-22+i*3;batch.add(CUBE,p.dark,[s*9.4,1.6,z],[0,0,0],[.25,1.2,.3]);batch.add(CUBE,p.trim,[s*9.4,2.25,z+1.2],[0,0,0],[.28,.16,2.8]);}
      const rib=tube([[s*8.7,-1,20],[s*9.5,-.5,0],[s*9.4,0,-21],[s*4.5,.3,-28],[0,1.2,-32]],.15,6);batch.add(rib,p.trim);rib.dispose();
      for(let i=0;i<4;i++){const z=-14+i*8;batch.add(CUBE,p.dark,[s*8,1.55,z],[0,0,0],[1.2,1,1.6]);const cannon=new THREE.CylinderGeometry(.27,.38,2.3,10);batch.add(cannon,p.dark,[s*9,2,z],[0,0,s*Math.PI/2]);cannon.dispose();}
    }
    for(const z of [-7,13]){
      batch.add(CYLINDER,p.wood,[0,8.7,z],[0,0,0],[.25,15.5,.25]);
      batch.add(CYLINDER,p.trim,[0,6,z],[0,0,0],[.33,.23,.33]);
      batch.add(CYLINDER,p.wood,[0,13,z],[0,0,Math.PI/2],[.14,14,.14]);
      for(const s of [-1,1]){const rope=tube([[0,16,z],[s*4.8,8,z+3],[s*9,2,z+6]],.037,4);batch.add(rope,p.trim);rope.dispose();}
      const sail=new THREE.Mesh(new THREE.PlaneGeometry(12,6.6,18,18),this.flagMaterial);sail.position.set(0,9.5,z);sail.rotation.y=.16;group.add(sail);
      const crest=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),this.materials.runeMaterial(0xbcbacd,.08));crest.position.set(0,9.4,z+.1);group.add(crest);
    }
    // A table, charts, barrels, benches and a sheltered forge are visible beside the crew.
    batch.add(CUBE,p.wood,[0,1.8,-12],[0,0,0],[4,.25,2.5]);for(const s of [-1,1])for(const z of [-12.9,-11.1])batch.add(CUBE,p.trim,[s*1.5,1.4,z],[0,0,0],[.18,.9,.18]);
    batch.add(CUBE,this.materials.plain(0xb1a082,.9,.02),[0,1.948,-12],[0,.07,0],[3,.014,1.9]);
    batch.add(CUBE,p.dark,[-6,1.55,-3],[0,0,0],[2.3,1.2,2]);batch.add(CUBE,p.trim,[-6,2.28,-3],[0,0,0],[1.3,.25,.7]);
    for(let i=0;i<5;i++){const x=i%2?7:-7,z=19-i*1.2;batch.add(CYLINDER,p.wood,[x,1.55,z],[0,0,0],[.5,1.1,.5]);for(const y of [1.13,1.91]){const ring=new THREE.TorusGeometry(.48,.045,5,12);batch.add(ring,p.dark,[x,y,z],[Math.PI/2,0,0]);ring.dispose();}}
    for(const x of [-5,5]){batch.add(CUBE,p.wood,[x,1.4,11],[0,0,0],[2.3,.3,.75]);for(const xx of [-.8,.8])batch.add(CUBE,p.trim,[x+xx,1.14,11],[0,0,0],[.15,.6,.55]);}
    for(const s of [-1,1]){
      const g=new THREE.TorusGeometry(2.2,.16,6,36);batch.add(g,p.trim,[s*7,-3,-18],[0,0,.25*s]);g.dispose();
      const core=new THREE.OctahedronGeometry(1.1);batch.add(core,p.glow,[s*7,-3,-18]);core.dispose();
      this.torches.push({x:s*8,y:2.5,z:-21,room:0,group});
    }
    batch.build(group,true);this.buildDistant();
  }
  stream(point,force=false){
    if(this.world.isHub)return;
    const desired=this.world.rooms.filter(room=>distance(room,point)<room.radius+66 || room.id===this.sim.director?.index).map(r=>r.id);
    for(const id of desired)if(!this.rooms.has(id))this.buildRoom(this.world.rooms[id]);
    for(const [id,obj] of this.rooms)if(!desired.includes(id)&&distance(obj.room,point)>obj.room.radius+85){disposeGroup(obj.group);obj.group.removeFromParent();this.rooms.delete(id);this.torches=this.torches.filter(t=>t.room!==id);}
  }
  createObject(e){
    const group=new THREE.Group(),batch=new GeometryBatch(),p=this.palette,type=e.objectType;
    const ownMats=[],glow=new THREE.MeshStandardMaterial({color:e.color||0xd1bb8e,emissive:e.color||0xd1bb8e,emissiveIntensity:1.6,roughness:.22,metalness:.25});ownMats.push(glow);
    let crystal=null;
    const put=(geo,mat,pos,rot=[0,0,0],scale=[1,1,1])=>batch.add(geo,mat,pos,rot,scale);
    if(type==='cage'){
      put(CUBE,p.dark,[0,.07,0],[0,0,0],[2.05,.14,1.8]);put(CUBE,p.trim,[0,2.2,0],[0,0,0],[2.05,.17,1.8]);
      for(let i=0;i<7;i++)for(const s of [-1,1]){put(CYLINDER,p.dark,[-.9+i*.3,1.12,s*.8],[0,0,0],[.027,2.2,.027]);put(CYLINDER,p.dark,[s*.95,1.12,-.75+i*.25],[0,0,0],[.027,2.2,.027]);}
      put(CUBE,p.trim,[0,1.05,.83],[0,0,0],[.21,.26,.1]);
      put(CYLINDER,p.cloth,[0,.6,0],[0,0,0],[.23,1.1,.22]);const head=new THREE.SphereGeometry(.19,10,8);put(head,p.bone,[0,1.32,0]);head.dispose();
    }else if(type==='device'){
      put(CYLINDER,p.dark,[0,.2,0],[0,0,0],[1.15,.4,1.15]);put(CYLINDER,p.trim,[0,.46,0],[0,0,0],[.82,.16,.82]);
      for(let i=0;i<4;i++){const a=i*TAU/4;const g=tube([[Math.sin(a)*.8,.4,Math.cos(a)*.8],[Math.sin(a)*.6,1.5,Math.cos(a)*.6],[Math.sin(a)*.25,2.3,Math.cos(a)*.25]],.11,5);put(g,p.dark,[0,0,0]);g.dispose();}
      crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.45),glow);crystal.position.y=1.4;group.add(crystal);
    }else if(['obelisk','oathAnchor','fragment','anchor','decision'].includes(type)){
      if(type!=='oathAnchor'){put(CYLINDER,p.dark,[0,.18,0],[0,0,0],[.83,.35,.83]);put(CYLINDER,p.trim,[0,.4,0],[0,0,0],[.66,.12,.66]);
        if(type==='obelisk'){put(CUBE,p.brick,[0,1.1,0],[0,0,0],[.65,1.4,.5]);put(CUBE,glow,[0,1.2,.26],[0,0,0],[.07,.73,.025]);}
        else{crystal=new THREE.Mesh(new THREE.OctahedronGeometry(type==='anchor'?.6:.38),glow);crystal.position.y=1.3;group.add(crystal);}}
      const disc=new THREE.Mesh(new THREE.PlaneGeometry(type==='oathAnchor'?5:3.5,type==='oathAnchor'?5:3.5),this.materials.runeMaterial(e.color,.65));disc.rotation.x=-Math.PI/2;disc.position.y=.06;group.add(disc);disc.userData.sharedMaterial=true;
    }else if(type==='ledger'||type==='memory'||type==='codex'){
      put(CUBE,p.brick,[0,.5,0],[0,0,0],[.9,1,.75]);put(CUBE,p.trim,[0,1.04,0],[.17,0,0],[1.02,.15,.85]);put(CUBE,this.materials.plain(0xc9b59a,.95,.02),[0,1.16,.02],[.17,0,0],[.73,.09,.6]);put(CUBE,p.dark,[0,1.215,.02],[.17,0,0],[.032,.025,.55]);
    }else if(type==='cache'){
      put(CUBE,p.wood,[0,.45,0],[0,0,0],[1.45,.9,.96]);put(CUBE,p.dark,[0,.92,0],[0,0,0],[1.5,.16,1]);
      for(const x of [-.5,.5])put(CUBE,p.trim,[x,.5,0],[0,0,0],[.09,1.03,1.02]);put(CUBE,p.trim,[0,.61,.51],[0,0,0],[.19,.23,.04]);
    }else if(['beacon','escapeBeacon'].includes(type)){
      const disk=new THREE.Mesh(new THREE.RingGeometry(.9,1.08,32),glow);disk.rotation.x=-Math.PI/2;disk.position.y=.05;group.add(disk);
      crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.16),glow);crystal.position.y=.8;group.add(crystal);
    }else if(type==='board'||type==='forge'||type==='training'){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.75,32),glow);ring.rotation.x=-Math.PI/2;ring.position.y=.03;group.add(ring);
      if(type==='training'){put(CYLINDER,p.wood,[0,1.1,0],[0,0,0],[.13,2.2,.13]);put(CYLINDER,p.wood,[0,1.5,0],[0,0,Math.PI/2],[.1,1.8,.1]);const head=new THREE.SphereGeometry(.26,12,8);put(head,p.bone,[0,2.4,0]);head.dispose();}
    }
    batch.build(group,true);this.group.add(group);const obj={group,crystal,type,ownMats};this.dynamicObjects.set(e.id,obj);return obj;
  }
  updateObjects(time){
    const ids=new Set();for(const e of this.sim.objects){ids.add(e.id);let obj=this.dynamicObjects.get(e.id);if(!obj)obj=this.createObject(e);
      obj.group.position.set(e.x,this.world.heightAt(e),e.z);obj.group.visible=distance(e,this.sim.activeHero)<80 && (!e.used||e.bound||['cage','obelisk','cache'].includes(e.objectType)) && !e.dead;
      if(obj.crystal){obj.crystal.rotation.y=time*.75;obj.crystal.position.y=(e.objectType==='device'?1.4:e.objectType==='beacon'||e.objectType==='escapeBeacon'?.8:1.3)+Math.sin(time*2+e.id)*.13;}
      if(e.used&&!e.bound)obj.group.scale.y=e.objectType==='cage'?.35:.85;else obj.group.scale.y=1;
      for(const m of obj.ownMats)m.emissiveIntensity=e.bound?3.5:e.used?.06:e.hint?2.8:1.4+Math.sin(time*2+e.id)*.4;
    }
    for(const [id,obj] of this.dynamicObjects)if(!ids.has(id)){disposeGroup(obj.group);obj.group.removeFromParent();for(const m of obj.ownMats)m.dispose();this.dynamicObjects.delete(id);}
  }
  update(time,dt,point,camera,flash=0){
    this.sky.position.copy(camera.position);this.sky.material.uniforms.time.value=time;this.sky.material.uniforms.flash.value=flash;
    this.flagUniform.value=time;if(this.waterfallMaterial)this.waterfallMaterial.uniforms.time.value=time;if(this.lavaMaterial)this.lavaMaterial.uniforms.time.value=time;
    this.streamClock-=dt;if(this.streamClock<=0){this.streamClock=.7;this.stream(point);}
    this.updateObjects(time);
    const near=this.torches.filter(t=>distance(t,point)<36).sort((a,b)=>distance(a,point)-distance(b,point));
    for(let i=0;i<this.torchLights.length;i++){const light=this.torchLights[i],t=near[i];if(t){light.position.set(t.x,t.y+1,t.z);light.intensity=(55+Math.sin(time*12+i)*7);light.color.set(this.region===2?0xa6daff:0xffa566);light.distance=18;}else light.intensity=0;}
  }
  dispose(){this.clearWorld();this.group.removeFromParent();this.sky.geometry.dispose();this.sky.material.dispose();this.sky.removeFromParent();for(const l of this.torchLights)l.removeFromParent();}
}
