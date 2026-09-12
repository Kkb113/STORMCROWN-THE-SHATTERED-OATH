import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { REGIONS } from '../data/regions.js';

export class Materials {
  constructor(renderer){this.renderer=renderer;this.textures={};this.materials=new Map();this.owned=[];this.environment=null;this.loaded=false;}
  async load(progress=()=>{}){
    const loader=new THREE.TextureLoader(),names=['stone','brick','rock','wood','leather'],channels=['diff','nor_gl','rough'];let count=0;
    const jobs=[];
    for(const name of names)for(const ch of channels){const key=`${name}_${ch}`;jobs.push(loader.loadAsync(`./assets/textures/${key}.webp`).then(texture=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
      if(ch==='diff')texture.colorSpace=THREE.SRGBColorSpace;
      this.textures[key]=texture;this.owned.push(texture);progress(++count/16);
    }));}
    jobs.push(new RGBELoader().loadAsync('./assets/environment/night.hdr').then(hdr=>{
      const pmrem=new THREE.PMREMGenerator(this.renderer);
      try{const target=pmrem.fromEquirectangular(hdr);this.environment=target.texture;this.owned.push(target);}finally{hdr.dispose();pmrem.dispose();}
      progress(++count/16);
    }));
    await Promise.all(jobs);this.loaded=true;
  }
  surface(name,{color=0xffffff,repeat=1,roughness=.85,metalness=.05,normal=.8,emissive=0x000000,emissiveIntensity=0,side=THREE.FrontSide,...rest}={}){
    const key=JSON.stringify({name,color,repeat,roughness,metalness,normal,emissive,emissiveIntensity,side,...rest});
    if(this.materials.has(key))return this.materials.get(key);
    const textures={};for(const [ch,prop] of [['diff','map'],['nor_gl','normalMap'],['rough','roughnessMap']]){
      const base=this.textures[`${name}_${ch}`];if(base){const t=base.clone();t.repeat.set(repeat,repeat);t.needsUpdate=true;textures[prop]=t;this.owned.push(t);}
    }
    const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...textures,normalScale:new THREE.Vector2(normal,normal),emissive,emissiveIntensity,side,...rest});
    this.materials.set(key,m);this.owned.push(m);return m;
  }
  plain(color,roughness=.5,metalness=.6,extra={}){
    const key=`plain:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
    if(this.materials.has(key))return this.materials.get(key);
    const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.set(key,m);this.owned.push(m);return m;
  }
  glow(color=0xb29eff,intensity=2){return this.plain(color,.25,.15,{emissive:color,emissiveIntensity:intensity});}
  region(index){
    const r=REGIONS[index],wet=r.wet;
    return {
      stone:this.surface('stone',{color:new THREE.Color(r.stone).lerp(new THREE.Color(0xa7afbc),.14).getHex(),repeat:1.3,roughness:wet?.58:.9,metalness:wet?.12:.04,normal:.62}),
      brick:this.surface('brick',{color:r.stone,repeat:1,roughness:.8,metalness:.09,normal:.8}),
      rock:this.surface('rock',{color:index===2?0x8399ab:index===3?0x47594c:0x444452,repeat:2,roughness:.95,normal:1.2}),
      dark:this.plain(index===2?0x566b80:0x202432,.65,.4),
      trim:this.plain(r.trim,.38,.83),
      glow:this.glow(new THREE.Color(r.color).getHex(),1.8),
      wood:this.surface('wood',{color:index===0?0x95877c:0x786558,repeat:1,roughness:.75,metalness:.02}),
      cloth:this.surface('leather',{color:index===1?0x6a242d:index===2?0x7994af:index===3?0x325342:0x302650,repeat:1,roughness:.93,side:THREE.DoubleSide}),
      bone:this.plain(0xbcb5a4,.85,.05),
    };
  }
  runeTexture(size=1024){
    if(this.textures.runes)return this.textures.runes;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d'),half=size/2;
    c.clearRect(0,0,size,size);c.translate(half,half);c.strokeStyle='#ddd2b2';c.fillStyle='#ddd2b2';c.lineWidth=1.4;
    for(const r of [.46,.438,.38,.32,.21]){c.beginPath();c.arc(0,0,size*r,0,Math.PI*2);c.stroke();}
    const marks=['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ','ᛇ','ᛈ','ᛉ','ᛋ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ','ᛟ'];
    for(let i=0;i<64;i++){const a=i*Math.PI*2/64;c.save();c.rotate(a);c.beginPath();c.moveTo(0,-size*.445);c.lineTo(0,-size*(i%4===0?.465:.454));c.stroke();c.restore();}
    c.font=`${size*.032}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';
    for(let i=0;i<32;i++){c.save();c.rotate(i*Math.PI*2/32);c.fillText(marks[i%marks.length],0,-size*.405);c.restore();}
    for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.lineWidth=2;c.beginPath();c.moveTo(0,-size*.31);c.lineTo(size*.03,-size*.235);c.lineTo(0,-size*.17);c.lineTo(-size*.03,-size*.235);c.closePath();c.stroke();c.beginPath();c.moveTo(0,-size*.32);c.lineTo(0,-size*.14);c.stroke();c.restore();}
    c.lineWidth=3;c.beginPath();for(let i=0;i<16;i++){const a=i*Math.PI/8,r=size*(i%2?.067:.165),x=Math.sin(a)*r,y=Math.cos(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.stroke();
    c.beginPath();c.arc(0,0,size*.055,0,Math.PI*2);c.stroke();
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;this.textures.runes=t;this.owned.push(t);return t;
  }
  runeMaterial(color=0xc8b18a,glow=.4){const key=`rune:${color}:${glow}`;if(this.materials.has(key))return this.materials.get(key);const m=new THREE.MeshStandardMaterial({map:this.runeTexture(),color,transparent:true,opacity:.88,depthWrite:false,roughness:.3,metalness:.78,emissive:color,emissiveMap:this.runeTexture(),emissiveIntensity:glow,polygonOffset:true,polygonOffsetFactor:-2});this.materials.set(key,m);this.owned.push(m);return m;}
  dispose(){for(const o of this.owned)o.dispose?.();this.materials.clear();this.owned=[];this.textures={};this.environment=null;this.loaded=false;}
}
