import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Materials } from './materials.js';
import { Environment } from './environment.js';
import { CharacterFactory } from './characters.js';
import { Weather } from './weather.js';
import { VFX } from './vfx.js';
import { QUALITY } from '../core/config.js';
import { REGIONS } from '../data/regions.js';
import { clamp, distance } from '../core/math.js';
import { HERO_BY_ID } from '../data/heroes.js';
import { makeHero } from '../game/entities.js';
import { createProfile } from '../game/progression.js';
import { displayPose } from './motion.js';

const targetTemp=new THREE.Vector3(),offset=new THREE.Vector3(),projectTemp=new THREE.Vector3(),keyOffset=new THREE.Vector3(-24,42,10),fillOffset=new THREE.Vector3(20,15,-23),neutralLight=new THREE.Color(0xc1cedd);
const GradeShader={uniforms:{tDiffuse:{value:null},vignette:{value:.14},contrast:{value:1.025},saturation:{value:1.02},storm:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float vignette;uniform float contrast;uniform float saturation;uniform float storm;varying vec2 vUv;void main(){vec4 tex=texture2D(tDiffuse,vUv);vec3 c=tex.rgb;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,saturation);c=(c-.18)*contrast+.18;c*=1.-vignette*pow(length((vUv-.5)*vec2(1.05,1.)),1.7);c+=storm*vec3(.015,.008,.035);gl_FragColor=vec4(max(c,vec3(0.)),tex.a);}`};

export class GameRenderer {
  constructor(canvas,settings){
    this.canvas=canvas;this.settings=settings;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',stencil:false});
    this.renderer.info.autoReset=false;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;
    this.renderer.shadowMap.enabled=settings.shadows;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x162034,.0105);
    this.camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.25,540);this.target=new THREE.Vector3(0,0,0);this.camera.position.set(21,32,28);this.camera.lookAt(0,0,0);
    this.hemi=new THREE.HemisphereLight(0xaebcde,0x292638,1.6);this.scene.add(this.hemi);
    this.key=new THREE.DirectionalLight(0xbacef4,3.6);this.key.position.set(-20,40,12);this.key.castShadow=true;this.scene.add(this.key);this.scene.add(this.key.target);
    Object.assign(this.key.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:1,far:105});this.key.shadow.bias=-.0002;this.key.shadow.normalBias=.035;this.key.shadow.radius=2;
    this.fill=new THREE.DirectionalLight(0xa493ed,1.05);this.fill.position.set(24,16,-24);this.scene.add(this.fill);this.scene.add(this.fill.target);
    this.materials=new Materials(this.renderer);this.actors=new Map();this.portraits=new Map();this.sim=null;this.ready=false;this.time=0;this.mode='game';this.smoothFPS=60;this.stats={fps:60,calls:0,triangles:0,geometries:0,textures:0,resolution:1};this.adaptClock=0;this.basePixel=1;this.renderScale=1;this.lastSwitch=0;
    this.composer=new EffectComposer(this.renderer);this.renderPass=new RenderPass(this.scene,this.camera);this.composer.addPass(this.renderPass);
    this.ao=new SSAOPass(this.scene,this.camera,innerWidth,innerHeight);this.ao.kernelRadius=9;this.ao.minDistance=.003;this.ao.maxDistance=.12;this.composer.addPass(this.ao);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.36,.38,1.05);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass(GradeShader);this.composer.addPass(this.grade);this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);this.output=new OutputPass();this.composer.addPass(this.output);
    this.applySettings(settings);this.onResize=()=>this.resize();addEventListener('resize',this.onResize);this.resize();
    this.onContextLost=event=>{event.preventDefault();this.contextLost=true;this.onError?.('The graphics context was interrupted. Your last checkpoint is safe. Reload to reconnect to the renderer.');};canvas.addEventListener('webglcontextlost',this.onContextLost);
  }
  async load(progress){
    await this.materials.load(progress);this.scene.environment=this.materials.environment;this.scene.environmentIntensity=.8;
    this.environment=new Environment(this.scene,this.materials);this.characters=new CharacterFactory(this.materials);this.weather=new Weather(this.scene,this.settings);this.vfx=new VFX(this.scene,this.materials,this.camera,this.settings);this.ready=true;
  }
  setSimulation(sim,{menu=false}={}){
    if(!this.ready)throw new Error('Renderer assets were not loaded');
    this.offSwitch?.();for(const a of this.actors.values())this.characters.destroy(a);this.actors.clear();this.sim=sim;this.mode=menu?'menu':'game';
    this.environment.setWorld(sim);this.weather.setRegion(sim.mission.region);this.vfx.bind(sim);
    const r=REGIONS[sim.mission.region];this.scene.fog.color.set(r.fog);this.scene.fog.density=sim.mission.region===2?.009:sim.mission.region===3?.014:.0105;
    this.hemi.color.set(r.ambient).lerp(neutralLight,.25);this.hemi.groundColor.set(r.fog).lerp(neutralLight,.18);this.hemi.intensity=sim.mission.region===2?1.8:2.0;
    this.key.color.set(r.key);this.key.intensity=sim.mission.region===1?3.0:3.5;this.fill.color.set(r.fill).lerp(neutralLight,.35);this.fill.intensity=sim.mission.region===2?1.0:1.45;
    const p=sim.activeHero;this.target.set(p.x,sim.world.heightAt(p),p.z);this.environment.stream(p,true);this.updateActors(0);this.updateCamera(.1,true);
    this.offSwitch=this.sim.on('switch',()=>{this.lastSwitch=this.time;});
  }
  applySettings(settings){
    this.settings=settings;const q=QUALITY[settings.quality];this.renderer.shadowMap.enabled=settings.shadows;
    const oldSize=this.key.shadow.mapSize.x;this.key.shadow.mapSize.set(q.shadowSize,q.shadowSize);if(oldSize!==q.shadowSize&&this.key.shadow.map){this.key.shadow.map.dispose();this.key.shadow.map=null;}
    this.bloom.enabled=settings.bloom&&q.bloom;this.ao.enabled=!!settings.ao&&settings.quality!=='low';
    this.basePixel=Math.min(devicePixelRatio||1,q.pixelRatio)*settings.resolution;this.renderScale=1;
    if(this.weather)this.weather.settings=settings;if(this.vfx)this.vfx.settings=settings;
    this.resize();
  }
  resize(){
    const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    const ratio=this.basePixel*this.renderScale;this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);
    this.fxaa.material.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));this.stats.resolution=ratio;
    if(this.vfx)this.vfx.pixelRatio=ratio;
  }
  updateCamera(dt,snap=false,alpha=1){
    if(!this.sim)return;
    const p=displayPose(this.sim.activeHero,alpha,this.cameraPose||= {}),y=this.sim.world.heightAt(p);
    if(this.mode==='menu')targetTemp.set(this.sim.world.rooms[0].x-3,0,this.sim.world.rooms[0].z-2);
    else targetTemp.set(p.x,y+.55,p.z);
    this.target.lerp(targetTemp,snap?1:1-Math.exp(-dt*(this.time-this.lastSwitch<.7?5.5:8)));
    const zoom=this.settings.cameraZoom,yaw=this.mode==='menu'?.64+Math.sin(this.time*.028)*.065:.64;
    const distance=this.mode==='menu'?32:28,height=this.mode==='menu'?32.5:30.5;
    offset.set(Math.sin(yaw)*distance,height,Math.cos(yaw)*distance).multiplyScalar(zoom);
    this.camera.position.copy(this.target).add(offset);
    const shake=this.vfx?.shake*(this.settings.shake||0);if(shake){this.camera.position.x+=(Math.random()-.5)*shake*.7;this.camera.position.y+=(Math.random()-.5)*shake*.4;}
    this.camera.lookAt(this.target);
    this.key.position.copy(this.target).add(keyOffset);this.key.target.position.copy(this.target);this.key.target.updateMatrixWorld();
    this.fill.position.copy(this.target).add(fillOffset);this.fill.target.position.copy(this.target);this.fill.target.updateMatrixWorld();
  }
  updateActors(dt,alpha=1){
    if(!this.sim)return;const active=new Set();
    for(const e of [...this.sim.party,...this.sim.enemies,...this.sim.civilians,...this.sim.constructs,...this.sim.figures]){
      if(distance(e,this.sim.activeHero)>85||e.dead&&e.deathAge>6)continue;active.add(e.id);
      let actor=this.actors.get(e.id),key=this.characters.key(e);
      if(actor&&actor.key!==key){this.characters.destroy(actor);this.actors.delete(e.id);actor=null;}
      if(!actor){actor=this.characters.create(e);this.actors.set(e.id,actor);this.scene.add(actor.group);}
      this.characters.animate(actor,e,this.actorTime||0,dt);
      const pose=displayPose(e,alpha,actor.displayPose||= {});
      actor.group.position.x=pose.x;actor.group.position.z=pose.z;
      actor.group.position.y+=pose.y-e.y+this.sim.world.heightAt(pose);actor.group.rotation.y=pose.angle;
      if(e.safe)actor.group.visible=false;
      if(e.anchorFigure&&this.sim.activeHero.heroId===e.heroId&&!this.sim.objects.find(o=>o.id===e.heroAnchor)?.bound)actor.group.visible=false;
    }
    for(const [id,a] of this.actors)if(!active.has(id)){this.characters.destroy(a);this.actors.delete(id);}
  }
  update(dt,alpha=1){
    if(!this.ready||!this.sim||this.contextLost)return;dt=Math.min(.1,Math.max(0,dt));this.time+=dt;if(!this.presentationPaused)this.actorTime=(this.actorTime||0)+dt;
    this.updateCamera(dt,false,alpha);this.updateActors(this.presentationPaused?0:dt,alpha);this.environment.update(this.time,dt,this.sim.activeHero,this.camera,this.vfx.flash);this.weather.update(this.time,dt,this.sim.activeHero,this.sim.world.heightAt(this.sim.activeHero));this.vfx.update(this.time,dt,this.environment);
    this.grade.uniforms.storm.value=this.vfx.flash*this.settings.flashes;
    this.animateMenu();
  }
  render(dt,alpha=1){
    if(!this.ready||!this.sim||this.contextLost)return;const frameDt=Math.max(.001,dt);dt=Math.min(.1,Math.max(0,dt));
    this.update(dt,alpha);
    this.renderer.info.reset();this.composer.render(dt);
    const fps=1/frameDt;this.smoothFPS=this.smoothFPS*.95+Math.min(180,fps)*.05;
    this.stats.fps=Math.round(this.smoothFPS);this.stats.calls=this.renderer.info.render.calls;this.stats.triangles=this.renderer.info.render.triangles;this.stats.geometries=this.renderer.info.memory.geometries;this.stats.textures=this.renderer.info.memory.textures;
    this.adaptClock+=dt;
    if(this.settings.adaptive&&this.adaptClock>6){this.adaptClock=0;const old=this.renderScale;if(this.smoothFPS<43)this.renderScale=Math.max(.6,this.renderScale-.08);else if(this.smoothFPS>65)this.renderScale=Math.min(1,this.renderScale+.04);if(old!==this.renderScale)this.resize();}
  }
  animateMenu(){
    if(this.mode!=='menu')return;
    if(!this.nextMenuBolt)this.nextMenuBolt=this.time+5;
    if(this.time>this.nextMenuBolt){this.nextMenuBolt=this.time+8+Math.random()*6;this.vfx.skyBolt({x:4+(Math.random()-.5)*14,z:-8+(Math.random()-.5)*12,color:0xb9a3ff,height:32,radius:7,major:false});}
  }
  project(point,height=2){
    if(!this.sim)return null;
    projectTemp.set(point.x,(point.y||0)+this.sim.world.heightAt(point)+height,point.z).project(this.camera);
    if(projectTemp.z>1||projectTemp.z<-1)return null;
    return {x:(projectTemp.x*.5+.5)*innerWidth,y:(-projectTemp.y*.5+.5)*innerHeight,visible:Math.abs(projectTemp.x)<1.2&&Math.abs(projectTemp.y)<1.3};
  }
  groundFromScreen(x,y){
    const mouse=new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),ray=new THREE.Raycaster();ray.setFromCamera(mouse,this.camera);
    const yPlane=this.sim?this.sim.world.heightAt(this.sim.activeHero):0,plane=new THREE.Plane(new THREE.Vector3(0,1,0),-yPlane);const result=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,result))return null;return{x:result.x,z:result.z};
  }
  zoom(delta){this.settings.cameraZoom=clamp(this.settings.cameraZoom+delta*.00055,.7,1.5);}
  portrait(id,size=160){
    const cacheKey=id+':'+size;if(this.portraits.has(cacheKey))return this.portraits.get(cacheKey);
    const h=HERO_BY_ID[id];if(!h)return '';
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x151b2c);scene.environment=this.materials.environment;
    const camera=new THREE.PerspectiveCamera(28,1,.1,30);camera.position.set(-.65,2.28,3.3);camera.lookAt(0,2.04,0);
    scene.add(new THREE.HemisphereLight(0xc4d7ff,0x1d2030,2));const light=new THREE.DirectionalLight(0xffddbd,4);light.position.set(-2,4,4);scene.add(light);const rim=new THREE.DirectionalLight(h.colorHex,4);rim.position.set(3,2,-3);scene.add(rim);
    const hero=makeHero(id,createProfile(),{x:0,z:0},0);hero.rank=2;hero.angle=-.18;const actor=this.characters.create(hero);this.characters.animate(actor,hero,0,0);actor.group.scale.setScalar(1);actor.map.upperR.rotation.x=.2;scene.add(actor.group);
    const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace});const old=this.renderer.getRenderTarget();this.renderer.setRenderTarget(target);this.renderer.render(scene,camera);const pixels=new Uint8Array(size*size*4);this.renderer.readRenderTargetPixels(target,0,0,size,size,pixels);this.renderer.setRenderTarget(old);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);for(let y=0;y<size;y++)image.data.set(pixels.subarray((size-y-1)*size*4,(size-y)*size*4),y*size*4);ctx.putImageData(image,0,0);const url=canvas.toDataURL('image/webp',.9);target.dispose();this.characters.destroy(actor);this.portraits.set(cacheKey,url);return url;
  }
  dispose(){removeEventListener('resize',this.onResize);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.offSwitch?.();for(const a of this.actors.values())this.characters.destroy(a);this.actors.clear();this.portraits.clear();this.vfx?.dispose();this.weather?.dispose();this.environment?.dispose();this.characters?.dispose();this.materials.dispose();for(const pass of this.composer.passes)pass.dispose?.();this.bloom.materialHighPassFilter.dispose();this.composer.dispose();this.key.shadow.dispose();this.renderer.dispose();}
}
