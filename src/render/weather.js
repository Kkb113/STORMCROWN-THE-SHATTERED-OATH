import * as THREE from 'three';
import { random, TAU } from '../core/math.js';
import { REGIONS } from '../data/regions.js';
import { QUALITY } from '../core/config.js';

/** Weather buffers are allocated once. Thousands of drops cost a single draw. */
export class Weather {
  constructor(scene,settings){
    this.scene=scene;this.settings=settings;this.rng=random(57312);this.count=1600;
    this.positions=new Float32Array(this.count*6);this.drops=Array.from({length:this.count},()=>({x:(this.rng()-.5)*90,z:(this.rng()-.5)*90,y:this.rng()*38,s:.5+this.rng()}));
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);
    this.rain=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xabc4e2,transparent:true,opacity:.20,depthWrite:false}));this.rain.frustumCulled=false;scene.add(this.rain);
    this.flakePositions=new Float32Array(this.count*3);const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.BufferAttribute(this.flakePositions,3).setUsage(THREE.DynamicDrawUsage));fg.setDrawRange(0,0);
    this.flakes=new THREE.Points(fg,new THREE.PointsMaterial({color:0xd1dfec,size:.075,transparent:true,opacity:.62,depthWrite:false,sizeAttenuation:true}));this.flakes.frustumCulled=false;scene.add(this.flakes);
    this.clouds=new THREE.Group();scene.add(this.clouds);this.makeClouds();this.region=0;this.lightningTimer=9;
  }
  makeClouds(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    for(let i=0;i<35;i++){const x=70+this.rng()*116,y=70+this.rng()*116,r=35+this.rng()*45,grad=c.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(208,220,239,.095)');grad.addColorStop(1,'rgba(208,220,239,0)');c.fillStyle=grad;c.fillRect(0,0,256,256);}
    this.cloudTexture=new THREE.CanvasTexture(canvas);
    this.cloudMaterial=new THREE.MeshBasicMaterial({map:this.cloudTexture,transparent:true,depthWrite:false,opacity:.26,color:0x8295bc,side:THREE.DoubleSide,fog:true});
    const g=new THREE.PlaneGeometry(80,58);
    for(let i=0;i<10;i++){const mesh=new THREE.Mesh(g,this.cloudMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set((this.rng()-.5)*220,-11-this.rng()*13,(this.rng()-.5)*230);mesh.rotation.z=this.rng()*TAU;mesh.userData.offset=mesh.position.clone();this.clouds.add(mesh);}
    this.cloudGeometry=g;
  }
  setRegion(index){this.region=index;const r=REGIONS[index];this.rain.visible=r.weather==='rain'||r.weather==='storm';this.flakes.visible=!this.rain.visible;this.flakes.material.color.set(index===1?0xffbc82:index===3?0xb8ddb0:0xd1e2f2);this.flakes.material.size=index===3?.10:.075;this.cloudMaterial.color.set(r.fog).multiplyScalar(2.2);}
  update(time,dt,point,floor=0){
    const rain=this.rain.visible,q=QUALITY[this.settings.quality]||QUALITY.high,n=Math.floor(this.count*Math.min(1,this.settings.particles*q.particles)*(rain?1:.48));
    for(let i=0;i<n;i++){
      const d=this.drops[i];d.y-=dt*(rain?21:1.5)*d.s;d.x+=dt*(rain?-3.5:.3);if(d.y<0)d.y=38;if(d.x<-45)d.x+=90;
      const x=point.x+d.x,z=point.z+d.z,y=d.y+floor;
      if(rain){const j=i*6;this.positions[j]=x;this.positions[j+1]=y;this.positions[j+2]=z;this.positions[j+3]=x+.13*d.s;this.positions[j+4]=y+.72*d.s;this.positions[j+5]=z+.035;}
      else{const j=i*3;this.flakePositions[j]=x+Math.sin(time*.7+i)*.7;this.flakePositions[j+1]=y;this.flakePositions[j+2]=z+Math.cos(time*.5+i)*.7;}
    }
    const geometry=rain?this.rain.geometry:this.flakes.geometry;geometry.setDrawRange(0,n*(rain?2:1));
    if(n){const attribute=geometry.attributes.position;attribute.clearUpdateRanges();attribute.addUpdateRange(0,n*(rain?6:3));attribute.needsUpdate=true;}
    for(let i=0;i<this.clouds.children.length;i++){const c=this.clouds.children[i],o=c.userData.offset;c.visible=i<Math.ceil(this.clouds.children.length*Math.min(1,q.scenery));if(c.visible){c.position.x=point.x+o.x+Math.sin(time*.025+i)*7;c.position.z=point.z+o.z;c.position.y=o.y+floor;}}
  }
  dispose(){this.rain.geometry.dispose();this.rain.material.dispose();this.rain.removeFromParent();this.flakes.geometry.dispose();this.flakes.material.dispose();this.flakes.removeFromParent();this.cloudTexture.dispose();this.cloudMaterial.dispose();this.cloudGeometry.dispose();this.clouds.removeFromParent();}
}
