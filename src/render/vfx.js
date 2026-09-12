import * as THREE from 'three';
import { ELEMENTS } from '../data/heroes.js';
import { distance, random, TAU, clamp } from '../core/math.js';
import { flatRing, shardGeometry, disposeGroup } from './geometry.js';
import { QUALITY } from '../core/config.js';

const colorOf=e=>ELEMENTS[e]?.hex||0xd3bd9c;
const UP=new THREE.Vector3(0,1,0),V=new THREE.Vector3(),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),ROT=new THREE.Euler(),DIR=new THREE.Vector3(),COLOR=new THREE.Color();
const hashNoise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
function uploadRange(attribute,count){if(count){attribute.clearUpdateRanges();attribute.addUpdateRange(0,count);attribute.needsUpdate=true;}}

function ribbonGeometry(paths,width,camera){
  const pos=[],uv=[],a=new THREE.Vector3(),b=new THREE.Vector3(),dir=new THREE.Vector3(),view=new THREE.Vector3(),side=new THREE.Vector3();
  for(const path of paths)for(let i=0;i<path.length-1;i++){
    a.copy(path[i]);b.copy(path[i+1]);dir.subVectors(b,a).normalize();view.subVectors(camera.position,a).normalize();side.crossVectors(dir,view).normalize().multiplyScalar(width*(.95-i/path.length*.5));
    const a0=a.clone().sub(side),a1=a.clone().add(side),b0=b.clone().sub(side),b1=b.clone().add(side);
    pos.push(...a0,...b0,...a1,...a1,...b0,...b1);uv.push(0,0,0,1,1,0,1,0,0,1,1,1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}

export class VFX {
  constructor(scene,materials,camera,settings){
    this.scene=scene;this.materials=materials;this.camera=camera;this.settings=settings;this.group=new THREE.Group();scene.add(this.group);this.effects=[];this.off=[];this.flash=0;this.shake=0;this.clock=0;this.particleCursor=0;this.debrisCursor=0;
    this.boltMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(0xb49bff)},alpha:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 color;uniform float alpha;void main(){float d=abs(vUv.x-.5)*2.;float glow=pow(max(0.,1.-d),2.5),core=exp(-d*d*230.);gl_FragColor=vec4(color*glow*2.5+vec3(core*3.),(glow*.7+core)*alpha);}'});
    this.basicGlow=new THREE.MeshBasicMaterial({color:0xb7a4ff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.maxParticles=2200;this.particles=Array.from({length:this.maxParticles},()=>({life:0,color:new THREE.Color()}));this.trailCredit=0;this.torchCredit=0;
    this.particlePositions=new Float32Array(this.maxParticles*3);this.particleColors=new Float32Array(this.maxParticles*3);this.particleInfo=new Float32Array(this.maxParticles*3);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('pColor',new THREE.BufferAttribute(this.particleColors,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('pInfo',new THREE.BufferAttribute(this.particleInfo,3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{scale:{value:540}},vertexShader:`attribute vec3 pColor;attribute vec3 pInfo;varying vec3 vColor;varying vec3 vInfo;uniform float scale;void main(){vColor=pColor;vInfo=pInfo;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(pInfo.x*scale/max(1.,-p.z),0.,90.);}`,fragmentShader:`varying vec3 vColor;varying vec3 vInfo;void main(){vec2 p=gl_PointCoord-.5;float d=dot(p,p)*4.;if(d>1.)discard;float a=pow(1.-d,vInfo.z>.5?3.:1.5)*vInfo.y;gl_FragColor=vec4(vColor*(vInfo.z>.5?.65:1.8),a);}`});
    this.points=new THREE.Points(g,mat);this.points.frustumCulled=false;this.group.add(this.points);
    this.maxDebris=180;this.debris=Array.from({length:this.maxDebris},()=>({life:0}));this.debrisMesh=new THREE.InstancedMesh(shardGeometry(337,0),materials.plain(0x8c8599,.88,.08),this.maxDebris);this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.debrisMesh.castShadow=false;this.debrisMesh.frustumCulled=false;this.group.add(this.debrisMesh);
    this.debrisMesh.count=0;
    this.telegraphs=new Map();this.zoneMeshes=new Map();this.makeFire();
    this.projectileMesh=new THREE.InstancedMesh(new THREE.ConeGeometry(.14,.9,6),materials.glow(0xffffff,1.35),120);this.projectileMesh.frustumCulled=false;this.projectileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.projectileMesh.count=0;this.group.add(this.projectileMesh);
    this.focusMarker=new THREE.Mesh(flatRing(.74,.80,40),new THREE.MeshBasicMaterial({color:0xc6c5ff,transparent:true,opacity:.65,depthWrite:false}));this.focusMarker.visible=false;this.group.add(this.focusMarker);
    this.flashLight=new THREE.PointLight(0xb69fff,0,65,2);scene.add(this.flashLight);
  }
  bind(sim){
    this.clear();this.sim=sim;
    this.off.push(sim.on('effect',e=>this.effect(e)),sim.on('shake',e=>{this.shake=Math.min(1.5,this.shake+e.amount);}),sim.on('ultimate',e=>{this.flash=Math.max(this.flash,.55);this.flashLight.color.set(colorOf(e.element));}),sim.on('spawn',({entity})=>this.burst(entity.x,entity.z,12,entity.color||0xa99fff,.35,.8)),sim.on('anchorBound',({anchor})=>this.skyBolt({...anchor,height:55,major:true,color:anchor.color})));
  }
  clear(){
    this.off.forEach(fn=>fn());this.off=[];
    for(const e of this.effects){e.mesh?.removeFromParent();e.mesh?.geometry.dispose();e.mesh?.material.dispose();}
    this.effects=[];for(const p of this.particles)p.life=0;for(const d of this.debris)d.life=0;
    for(const h of this.telegraphs.values()){h.removeFromParent();disposeGroup(h,true);}this.telegraphs.clear();
    for(const m of this.zoneMeshes.values()){m.removeFromParent();m.geometry.dispose();m.material.dispose();}this.zoneMeshes.clear();this.flash=this.shake=0;this.trailCredit=this.torchCredit=0;
    this.points.geometry.setDrawRange(0,0);this.debrisMesh.count=this.projectileMesh.count=this.fire.count=0;this.focusMarker.visible=false;
  }
  floor(p){return this.sim?.world.heightAt(p)||0;}
  particleDensity(){return Math.min(1.4,this.settings.particles*(QUALITY[this.settings.quality]||QUALITY.high).particles);}
  emitParticle(x,y,z,vx,vy,vz,color,size=.25,life=.6,gravity=5,smoke=false){
    const p=this.particles[this.particleCursor++%this.maxParticles];p.color.set(color);Object.assign(p,{x,y,z,vx,vy,vz,size,life,total:life,gravity,smoke});
  }
  burst(x,z,count,color,radius=1,speed=7,y=1){
    count=Math.ceil(count*this.particleDensity());const ground=this.floor({x,z});
    for(let i=0;i<count;i++){const a=Math.random()*TAU,r=Math.random()*radius;this.emitParticle(x+Math.sin(a)*r,ground+y+Math.random()*.2,z+Math.cos(a)*r,Math.sin(a)*speed*(.2+Math.random()),2+Math.random()*speed,Math.cos(a)*speed*(.2+Math.random()),color,.09+Math.random()*.22,.3+Math.random()*.7,10);}
  }
  debrisBurst(x,z,count=18,radius=3,color=0x8b8098){
    const ground=this.floor({x,z});for(let i=0;i<count*this.particleDensity();i++){
      const d=this.debris[this.debrisCursor++%this.maxDebris],a=Math.random()*TAU,r=Math.random()*radius;Object.assign(d,{x:x+Math.sin(a)*r,z:z+Math.cos(a)*r,y:ground+.2,vx:Math.sin(a)*(2+Math.random()*6),vz:Math.cos(a)*(2+Math.random()*6),vy:5+Math.random()*9,life:1.7+Math.random(),total:2.7,size:.08+Math.random()*.30,rx:Math.random()*6,rz:Math.random()*6,ground});
    }
  }
  lightning(from,to,color=0xac99ff,width=.28,branches=2,life=.24){
    const ground=this.floor(to),a=new THREE.Vector3(from.x,(from.y||0)+(from.absolute?0:this.floor(from)),from.z),b=new THREE.Vector3(to.x,(to.y||0)+(to.absolute?0:ground),to.z);
    const d=a.distanceTo(b),steps=Math.max(5,Math.floor(d/1.15)),points=[];
    for(let i=0;i<=steps;i++){const t=i/steps,p=a.clone().lerp(b,t),noise=Math.sin(t*Math.PI)*Math.min(d*.095,1.7);if(i&&i<steps){p.x+=(Math.random()-.5)*noise*2;p.z+=(Math.random()-.5)*noise*2;p.y+=(Math.random()-.5)*noise*.6;}points.push(p);}
    const paths=[points];for(let j=0;j<branches;j++){
      const idx=Math.floor(steps*(.25+Math.random()*.5)),p=points[idx],branchEnd=p.clone().add(new THREE.Vector3((Math.random()-.5)*d*.28,-d*.15,(Math.random()-.5)*d*.28)),branch=[p.clone()];
      for(let k=1;k<=4;k++){const v=p.clone().lerp(branchEnd,k/4);v.x+=(Math.random()-.5)*.7;v.z+=(Math.random()-.5)*.7;branch.push(v);}paths.push(branch);
    }
    const g=ribbonGeometry(paths,width,this.camera),mat=this.boltMaterial.clone();mat.uniforms.color.value.set(color);const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;this.group.add(mesh);this.effects.push({mesh,kind:'bolt',age:0,life});
  }
  skyBolt(e){
    const x=e.x||0,z=e.z||0,height=e.height||27,major=e.major;
    this.lightning({x:x+(Math.random()-.5)*4,y:height,z:z+(Math.random()-.5)*4},{x,y:.15,z},e.color||0xbba5ff,major?.7:.36,major?6:3,major?.55:.30);
    this.flash=Math.max(this.flash,major?1:.38);this.flashLight.position.set(x,this.floor(e)+4,z);this.flashLight.color.set(e.color||0xbfa4ff);
    this.burst(x,z,major?110:30,e.color||0xbba4ff,major?5:2,major?11:7,.15);this.debrisBurst(x,z,major?28:9,major?5:2);
    const branches=major?12:4,r=e.radius||4;
    for(let i=0;i<branches;i++){const a=i*TAU/branches;this.lightning({x,y:.10,z},{x:x+Math.sin(a)*r,y:.10,z:z+Math.cos(a)*r},e.color||0xb79eff,major?.20:.09,1,.24+Math.random()*.3);}
    this.ring({x,z,radius:major?r:3.5,color:e.color||0xbca3ff,life:.55},'shockwave');
  }
  ring(e,kind='ring'){
    const radius=e.radius||4,material=this.basicGlow.clone();material.color.set(e.color||0xb3a1ff);material.opacity=e.opacity??.5;
    let g;if(kind==='sigil'){g=new THREE.PlaneGeometry(radius*2,radius*2);g.rotateX(-Math.PI/2);material.map=this.materials.runeTexture();material.opacity=.75;}
    else g=flatRing(.91,1,80);
    const mesh=new THREE.Mesh(g,material);mesh.position.set(e.x,this.floor(e)+.075,e.z);if(kind!=='sigil')mesh.scale.setScalar(radius);this.group.add(mesh);
    this.effects.push({mesh,kind,age:0,life:e.life||.65,radius,opacity:material.opacity});
  }
  slash(e){
    const radius=e.radius||3,points=[],angle=e.angle||0;
    for(let i=0;i<=20;i++){const a=angle-1.3+i/20*2.6;points.push(new THREE.Vector3(e.x+Math.sin(a)*radius,this.floor(e)+(e.y||1)+Math.sin(i/20*Math.PI)*.15,e.z+Math.cos(a)*radius));}
    const g=ribbonGeometry([points],e.heavy?.30:.14,this.camera),mat=this.boltMaterial.clone();mat.uniforms.color.value.set(e.color||0xbfaaff);const mesh=new THREE.Mesh(g,mat);this.group.add(mesh);this.effects.push({mesh,kind:'bolt',age:0,life:.22});
  }
  effect(e){
    if(!this.sim || (e.x!==undefined&&distance(e,this.sim.activeHero)>95))return;
    const type=e.type;
    if(['lightning','skybolt'].includes(type)){this.skyBolt(e);return;}
    if(type==='bolt'){this.lightning(e.from,e.to,e.color,e.width?e.width*4:.25,e.branches||1,e.life||.24);return;}
    if(['beam','lightBeam','chain','soul','aim'].includes(type)&&e.from&&e.to){this.lightning(e.from,e.to,e.color||0xb9acff,type==='aim'?.018:type==='beam'?.55:.1,type==='beam'?2:0,e.life||.5);return;}
    if(type==='slash'||type==='cleave'){this.slash(e);return;}
    if(['sigil','castRing','shield','bulwark','solarSigil','ward'].includes(type)){this.ring({...e,life:e.life||1.8},'sigil');return;}
    if(['shockwave','ring','heal','claim','absorb','parry','shieldHit'].includes(type)){
      this.ring({...e,radius:e.radius||(type==='parry'?3:4),life:e.life||.8},type==='claim'?'sigil':'shockwave');this.burst(e.x,e.z,type==='parry'?28:20,e.color||0xffdfad,1.3,4);return;
    }
    if(['dash','rift','faultline','tether','beam'].includes(type)&&e.from&&e.to){
      const steps=Math.max(3,Math.ceil(distance(e.from,e.to)/1.1));
      for(let i=0;i<steps;i++){const p={x:e.from.x+(e.to.x-e.from.x)*i/steps,z:e.from.z+(e.to.z-e.from.z)*i/steps};this.burst(p.x,p.z,6,e.color||0xa9a3ff,.7,2,.45);if(type==='faultline')this.debrisBurst(p.x,p.z,3,1);}
      this.lightning({...e.from,y:.8},{...e.to,y:.8},e.color||0xa9a3ff,type==='tether'?.1:.2,0,.25);return;
    }
    if(['darkness','implosion','blackout'].includes(type)){this.ring({...e,color:e.color||0xad83ec,life:e.life||1.2},'implosion');this.burst(e.x,e.z,45,e.color||0xb085fb,e.radius||5,-4);return;}
    if(type==='freeze'||type==='shatter'){this.burst(e.x,e.z,type==='shatter'?60:18,e.color||0xbcecff,type==='shatter'?3:1,8);if(type==='shatter')this.debrisBurst(e.x,e.z,20,3);return;}
    if(['phoenix','firespin','wings','fireRing','arrowRain','arrowstorm','hurricane','blizzard','roots'].includes(type)){
      this.ring({...e,life:e.life||1.2},type==='blizzard'?'sigil':'shockwave');this.burst(e.x,e.z,65,e.color||0xebba83,e.radius||7,type==='arrowRain'?2:6,type==='arrowRain'?10:.5);return;
    }
    if(type==='wall'){
      if(this.sim.hazards.some(h=>h.visual==='stormwall'&&h.x===e.x&&h.z===e.z))return;
      this.lightning({x:e.x-4,y:0,z:e.z},{x:e.x+4,y:8,z:e.z},e.color,.2,4,e.life||1);return;
    }
    if(type==='hit'){this.burst(e.x,e.z,e.heavy?14:6,e.color||0xbcb5c5,.3,e.heavy?5:3,e.y||1);return;}
    if(type==='dust'||type==='death'){this.burst(e.x,e.z,9,e.color||0x777382,.4,1,.1);return;}
    this.ring({...e,life:.6},'shockwave');this.burst(e.x,e.z,type==='bossDeath'?120:32,e.color||0xceac87,e.radius||2,7);if(['break','impact','bossDeath','burst','runeExplosion'].includes(type))this.debrisBurst(e.x,e.z,16,e.radius||2);
  }
  makeFire(){
    const g=new THREE.PlaneGeometry(1.05,1.75);g.translate(0,.78,0);
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},tint:{value:new THREE.Color(0xffad54)}},vertexShader:`varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vSeed=instanceMatrix[3].x+instanceMatrix[3].z;vec4 origin=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);origin.xy+=position.xy;gl_Position=projectionMatrix*origin;}`,fragmentShader:`varying vec2 vUv;varying float vSeed;uniform float time;uniform vec3 tint;${hashNoise}void main(){vec2 p=vUv;float n=noise(vec2(p.x*5.+vSeed,p.y*7.-time*4.));float w=(1.-p.y)*.5;float flame=1.-smoothstep(w-.15,w+.10,abs(p.x-.5)+(n-.5)*.20);flame*=smoothstep(0.,.13,p.y)*(1.-smoothstep(.2,1.,p.y));float hot=pow(flame,3.)*(1.-p.y);vec3 col=tint*flame*1.15+vec3(.85,.38,.08)*hot;gl_FragColor=vec4(col,flame*.72);}`});
    this.fire=new THREE.InstancedMesh(g,m,32);this.fire.count=0;this.fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.fire.frustumCulled=false;this.group.add(this.fire);
  }
  lavaMaterial(){
    return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{time:{value:0},progress:{value:0},lavaActive:{value:0},dimensions:{value:new THREE.Vector2(1,1)}},
      vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float time;uniform float lavaActive;uniform vec2 dimensions;${hashNoise}
        void main(){
          vec2 p=vWorld.xz*.34;float flow=noise(p+vec2(time*.09,-time*.12));
          float vein=1.-smoothstep(.035,.16,abs(noise(p*3.1+flow)-.5));float heat=.83+.17*sin(time*1.8+flow*7.);
          vec3 crust=mix(vec3(.055,.013,.019),vec3(.22,.037,.009),flow);
          vec3 molten=mix(vec3(1.1,.13,.009),vec3(1.65,.56,.035),vein);
          vec3 col=mix(crust,molten,vein*vein*.8)*heat;
          float border=1.-smoothstep(.05,.22,min(min(vUv.x,1.-vUv.x)*dimensions.x,min(vUv.y,1.-vUv.y)*dimensions.y));
          float front=1.-smoothstep(.08,.3,(1.-vUv.y)*dimensions.y);
          col+=vec3(1.25,.34,.025)*border*.5+vec3(1.2,.55,.10)*front;col*=mix(.45,1.,lavaActive);
          gl_FragColor=vec4(col,mix(.48,.97,lavaActive)+border*.025);
        }`});
  }
  stormWall(groundMaterial){
    // Ground XY transforms into world XZ; local Z provides wall height.
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,-.5,0,0,.5,0,0,-.5,3.6,0,.5,3.6],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.setIndex([0,1,2,2,1,3]);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{time:groundMaterial.uniforms.time,progress:groundMaterial.uniforms.progress},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float time;uniform float progress;${hashNoise}
        void main(){
          float n=noise(vec2(vUv.y*9.,floor(time*11.)+floor(vUv.x*8.)))-.5;
          float lane=abs(fract(vUv.x*8.+n*.22)-.5);float bolt=1.-smoothstep(.009,.045,lane);
          float fade=smoothstep(0.,.04,vUv.y)*(1.-smoothstep(.65,1.,vUv.y));float veil=(1.-vUv.y)*.09;
          vec3 col=vec3(.42,.30,.9)*veil+vec3(.72,.86,1.35)*bolt;
          gl_FragColor=vec4(col,(veil+bolt*.62)*fade*(.22+.78*progress));
        }`});
    const wall=new THREE.Mesh(g,material);wall.renderOrder=3;return wall;
  }
  createTelegraph(h){
    const material=h.visual==='lava'?this.lavaMaterial():new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(h.absorb?0x8d9fff:h.element==='frost'?0xe896bf:h.visual==='stormwall'?0xa999ff:0xff705a)},progress:{value:0},shape:{value:h.shape==='rect'?2:h.shape==='ring'?1:h.shape==='cone'?3:0},inner:{value:h.inner?(h.inner/(h.radius||1)):0},arc:{value:h.arc||2},time:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform vec3 color;uniform float progress;uniform int shape;uniform float inner;uniform float arc;uniform float time;void main(){vec2 p=(vUv-.5)*2.;float d=length(p),bound=shape==2?max(abs(p.x),abs(p.y)):d;if(bound>1.)discard;if(shape==1&&d<inner)discard;if(shape==3&&abs(atan(p.x,-p.y))>arc*.5)discard;float border=smoothstep(.94,.985,bound),charge=1.-smoothstep(progress-.035,progress+.035,bound);float a=.13+.17*charge+border*.6;float ticks=step(.90,fract(atan(p.y,p.x)*9.));a+=ticks*border*.2;gl_FragColor=vec4(color*(.8+border*.8),a*(.8+sin(time*9.)*.12));}`});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.rotation.x=-Math.PI/2;mesh.renderOrder=h.visual==='lava'?1:2;
    if(h.visual==='stormwall')mesh.add(this.stormWall(material));
    this.group.add(mesh);this.telegraphs.set(h.id,mesh);return mesh;
  }
  updateTelegraphs(time){
    const ids=new Set();for(const h of this.sim.hazards){
      const width=h.shape==='rect'?(h.width||1):(h.radius||4)*2,length=h.shape==='rect'?(h.length||1):(h.radius||4)*2;
      if(h.dead||distance(h,this.sim.activeHero)>55+Math.max(width,length)/2)continue;
      ids.add(h.id);let m=this.telegraphs.get(h.id);if(!m)m=this.createTelegraph(h);
      m.position.set(h.x,this.floor(h)+.08,h.z);m.rotation.set(-Math.PI/2,0,-(h.angle||0));m.scale.set(width,length,1);
      const uniforms=m.material.uniforms;uniforms.progress.value=h.warn>0?clamp(1-h.warn/Math.max(.001,h.totalWarn),0,1):1;uniforms.time.value=time;
      if(uniforms.dimensions)uniforms.dimensions.value.set(width,length);if(uniforms.lavaActive)uniforms.lavaActive.value=h.warn>0?0:1;
    }
    for(const [id,m] of this.telegraphs)if(!ids.has(id)){m.removeFromParent();disposeGroup(m,true);this.telegraphs.delete(id);}
  }
  updateZones(time,dt){
    const ids=new Set();for(const z of this.sim.zones){if(distance(z,this.sim.activeHero)>60)continue;ids.add(z.id);let mesh=this.zoneMeshes.get(z.id);
      if(!mesh){const mat=this.basicGlow.clone();mat.color.set(colorOf(z.element));mat.opacity=.22;mat.map=this.materials.runeTexture();const g=new THREE.PlaneGeometry(z.radius*2,z.radius*2);g.rotateX(-Math.PI/2);mesh=new THREE.Mesh(g,mat);this.group.add(mesh);this.zoneMeshes.set(z.id,mesh);}
      mesh.position.set(z.x,this.floor(z)+.07,z.z);mesh.rotation.y=time*.09;mesh.material.color.set(colorOf(z.element));mesh.material.opacity=Math.min(.3,z.life*.3)*(z.kind==='mine'?1.7:1);
      mesh.userData.emission=(mesh.userData.emission||0)+dt*(['cyclone','vortex','hurricane'].includes(z.kind)?70:35)*this.particleDensity();
      const count=Math.floor(mesh.userData.emission);mesh.userData.emission-=count;
      for(let i=0;i<count;i++){
        const a=time*4+i*TAU/count+Math.random(),r=(.2+Math.random()*.8)*z.radius,spin=['cyclone','vortex','hurricane','firestorm'].includes(z.kind),x=z.x+Math.sin(a)*r,zz=z.z+Math.cos(a)*r;
        this.emitParticle(x,this.floor(z)+.15,zz,spin?Math.cos(a)*4:0,spin?3.4:1.1,spin?-Math.sin(a)*4:0,colorOf(z.element),z.kind==='mine'?.08:.15+Math.random()*.25,.65+Math.random(),spin?-1:.2);
      }
    }
    for(const [id,m] of this.zoneMeshes)if(!ids.has(id)){m.removeFromParent();m.geometry.dispose();m.material.dispose();this.zoneMeshes.delete(id);}
  }
  update(time,dt,environment){
    if(!this.sim)return;this.clock++;this.flash*=Math.exp(-dt*8);this.shake*=Math.exp(-dt*9);
    this.flashLight.intensity=this.flash*650*(this.settings.flashes||0);
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.age+=dt;const t=clamp(e.age/e.life,0,1);
      if(t>=1){e.mesh.removeFromParent();e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(i,1);continue;}
      if(e.kind==='bolt')e.mesh.material.uniforms.alpha.value=(1-t)*(Math.sin(e.age*95)>.4?.55:1);
      else {e.mesh.material.opacity=e.opacity*(1-t);if(e.kind==='shockwave')e.mesh.scale.setScalar(e.radius*(.15+Math.sqrt(t)*.9));if(e.kind==='implosion')e.mesh.scale.setScalar(e.radius*(1-t));if(e.kind==='sigil')e.mesh.rotation.y+=dt*.12;}
    }
    const positions=this.particlePositions,colors=this.particleColors,info=this.particleInfo;let liveParticles=0;
    for(let i=0;i<this.maxParticles;i++){
      const p=this.particles[i];if(p.life<=0)continue;p.life-=dt;if(p.life<=0)continue;
      p.vy-=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;const j=liveParticles++*3;
      positions[j]=p.x;positions[j+1]=p.y;positions[j+2]=p.z;p.color.toArray(colors,j);info[j]=p.size;info[j+1]=p.life/p.total;info[j+2]=p.smoke?1:0;
    }
    this.points.geometry.setDrawRange(0,liveParticles);this.points.visible=liveParticles>0;
    for(const attribute of Object.values(this.points.geometry.attributes))uploadRange(attribute,liveParticles*3);
    this.points.material.uniforms.scale.value=(globalThis.innerHeight||720)*.62*(this.pixelRatio||1);
    let liveDebris=0;
    for(let i=0;i<this.maxDebris;i++){
      const d=this.debris[i];if(d.life<=0)continue;d.life-=dt;if(d.life<=0)continue;
      d.vy-=dt*18;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
      if(d.y<d.ground+.07){d.y=d.ground+.07;d.vy=Math.abs(d.vy)*.18;d.vx*=.85;d.vz*=.85;}
      d.rx+=dt*3;d.rz+=dt*4;Q.setFromEuler(ROT.set(d.rx,0,d.rz));S.setScalar(d.size*Math.min(1,d.life*2));M.compose(V.set(d.x,d.y,d.z),Q,S);this.debrisMesh.setMatrixAt(liveDebris++,M);
    }
    this.debrisMesh.count=liveDebris;uploadRange(this.debrisMesh.instanceMatrix,liveDebris*16);
    this.trailCredit+=dt*20*this.particleDensity();const trailCount=Math.floor(this.trailCredit);this.trailCredit-=trailCount;
    const projectiles=this.sim.projectiles,projectileCount=Math.min(120,projectiles.length);this.projectileMesh.count=projectileCount;
    for(let i=0;i<projectileCount;i++){
      const p=projectiles[i],y=p.y+this.floor(p);Q.setFromUnitVectors(UP,DIR.set(Math.sin(p.angle),0,Math.cos(p.angle)));S.setScalar(p.visual==='spear'?1.5:p.visual==='arrow'?.8:1);M.compose(V.set(p.x,y,p.z),Q,S);this.projectileMesh.setMatrixAt(i,M);this.projectileMesh.setColorAt(i,COLOR.set(colorOf(p.element)));
      for(let j=0;j<trailCount;j++)this.emitParticle(p.x,y,p.z,0,0,0,colorOf(p.element),.12,.2,0);
    }
    uploadRange(this.projectileMesh.instanceMatrix,projectileCount*16);if(this.projectileMesh.instanceColor){this.projectileMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);uploadRange(this.projectileMesh.instanceColor,projectileCount*3);}
    this.updateTelegraphs(time);this.updateZones(time,dt);
    const fires=environment.torches.filter(t=>distance(t,this.sim.activeHero)<55).slice(0,32);this.fire.count=fires.length;this.fire.material.uniforms.time.value=time;this.fire.material.uniforms.tint.value.set(this.sim.mission.region===2?0x8bcaff:0xffa448);
    this.torchCredit+=dt*7*this.particleDensity();const embers=Math.floor(this.torchCredit);this.torchCredit-=embers;
    fires.forEach((t,i)=>{M.makeTranslation(t.x,t.y,t.z);this.fire.setMatrixAt(i,M);for(let j=0;j<embers;j++)this.emitParticle(t.x,t.y+.5,t.z,(Math.random()-.5)*.3,1.4+Math.random(),(Math.random()-.5)*.3,0xffb869,.065,1.3,-.2);});uploadRange(this.fire.instanceMatrix,fires.length*16);
    const hero=this.sim.activeHero;this.focusMarker.position.set(hero.x,this.floor(hero)+.065,hero.z);this.focusMarker.scale.setScalar(Math.max(.9,hero.radius*1.7));this.focusMarker.material.color.set(hero.color||0xc6c5ff);this.focusMarker.visible=!hero.dead;
  }
  dispose(){this.clear();this.group.removeFromParent();for(const m of [this.points,this.debrisMesh,this.fire,this.projectileMesh,this.focusMarker]){if(m.isInstancedMesh)m.dispose();m.geometry.dispose();if(m===this.points||m===this.fire||m===this.focusMarker)m.material.dispose();}this.group.clear();this.flashLight.removeFromParent();this.boltMaterial.dispose();this.basicGlow.dispose();this.sim=null;}
}
