import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random, TAU } from '../core/math.js';

export function bevelBox(x,y,z,bevel=.05){
  bevel=Math.min(bevel,x/4,y/4,z/4);const s=new THREE.Shape();s.moveTo(-x/2+bevel,-y/2);s.lineTo(x/2-bevel,-y/2);s.quadraticCurveTo(x/2,-y/2,x/2,-y/2+bevel);s.lineTo(x/2,y/2-bevel);s.quadraticCurveTo(x/2,y/2,x/2-bevel,y/2);s.lineTo(-x/2+bevel,y/2);s.quadraticCurveTo(-x/2,y/2,-x/2,y/2-bevel);s.lineTo(-x/2,-y/2+bevel);s.quadraticCurveTo(-x/2,-y/2,-x/2+bevel,-y/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.01,z-bevel*2),bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:2});g.translate(0,0,-z/2+bevel);return g;
}
export function shardGeometry(seed=1,detail=1){
  const g=new THREE.IcosahedronGeometry(1,detail),a=g.attributes.position,rng=random(seed),byPos=new Map();
  for(let i=0;i<a.count;i++){const k=[a.getX(i),a.getY(i),a.getZ(i)].map(v=>v.toFixed(4)).join(',');if(!byPos.has(k))byPos.set(k,.77+rng()*.37);const r=byPos.get(k);a.setXYZ(i,a.getX(i)*r,a.getY(i)*r,a.getZ(i)*r);}
  g.computeVertexNormals();return g;
}
export function cylinderBetween(a,b,r1,r2=r1,segments=8){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av);const g=new THREE.CylinderGeometry(r2,r1,dir.length(),segments,1,false);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());return g;}
export function tube(points,radius=.08,segments=5){const curve=new THREE.CatmullRomCurve3(points.map(p=>Array.isArray(p)?new THREE.Vector3(...p):p));return new THREE.TubeGeometry(curve,Math.max(4,points.length*3),radius,segments,false);}
export function flatRing(inner,outer,segments=96){const g=new THREE.RingGeometry(inner,outer,segments);g.rotateX(-Math.PI/2);return g;}
export function archGeometry(width,height,thickness=.7,depth=.8,segments=20){
  const outer=new THREE.Shape(),r=width/2;outer.moveTo(-r-thickness,0);outer.lineTo(-r-thickness,height-r);outer.absarc(0,height-r,r+thickness,Math.PI,0,true);outer.lineTo(r+thickness,0);outer.lineTo(r,0);outer.lineTo(r,height-r);outer.absarc(0,height-r,r,0,Math.PI,false);outer.lineTo(-r,0);outer.closePath();
  const g=new THREE.ExtrudeGeometry(outer,{depth,steps:1,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:1,curveSegments:segments});g.translate(0,0,-depth/2);return g;
}
export function planeUV(g,axis='xz',scale=1){const p=g.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*scale;uv[i*2+1]=(axis==='xz'?p.getZ(i):p.getY(i))*scale;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;}
/** Shape coordinates are x/-z before rotation so asymmetric world outlines are not mirrored. */
export function polygonFloor(points){
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
  shape.closePath();const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);return g;
}
/** A bridge follows the same clamped edge-to-edge height ramp as WorldMap.heightAt. */
export function bridgeDeckGeometry(bridge,depth=.55){
  const {a,b,deckStart,deckEnd,width}=bridge,length=Math.hypot(b.x-a.x,b.z-a.z);
  const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,half=width/2,positions=[],indices=[];
  const stops=[deckStart-.6,deckStart,deckEnd,deckEnd+.6];
  for(let i=0;i<stops.length-1;i++){
    const base=positions.length/3;
    for(const t of [stops[i],stops[i+1]]){
      const h=a.y+(b.y-a.y)*Math.max(0,Math.min(1,(t-deckStart)/Math.max(.001,deckEnd-deckStart)));
      for(const y of [h,h-depth])for(const side of [-1,1])positions.push(a.x+dx*t+dz*half*side,y,a.z+dz*t-dx*half*side);
    }
    for(const j of [0,4,1,1,4,5,2,3,6,3,7,6,2,6,0,0,6,4,1,5,3,3,5,7,0,1,2,1,3,2,4,6,5,5,6,7])indices.push(base+j);
  }
  const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setIndex(indices);
  const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();return planeUV(g,'xz',.15);
}
/** Batches static dressed geometry by material. Shared buffers keep scene changes bounded. */
export class GeometryBatch {
  constructor(){this.parts=new Map();}
  add(geometry,material,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){
    const g=geometry.clone();const m=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));g.applyMatrix4(m);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    // Merge wants an identical non-indexed schema for procedurally mixed solids.
    const flat=g.index?g.toNonIndexed():g;if(g!==flat)g.dispose();for(const key of Object.keys(flat.attributes))if(!['position','normal','uv'].includes(key))flat.deleteAttribute(key);
    if(!flat.attributes.normal)flat.computeVertexNormals();
    if(!this.parts.has(material))this.parts.set(material,[]);this.parts.get(material).push(flat);
  }
  build(group,shadows=true){
    for(const [material,list] of this.parts){const g=mergeGeometries(list,false);for(const p of list)p.dispose();if(!g)continue;g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material);mesh.castShadow=shadows;mesh.receiveShadow=true;group.add(mesh);}
    this.parts.clear();return group;
  }
}
export function disposeGroup(group,materials=false){
  const geometries=new Set(),ownedMaterials=new Set();
  group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();if(materials||o.userData.ownsMaterial){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)ownedMaterials.add(m);}});
  for(const g of geometries)g.dispose();for(const m of ownedMaterials)m.dispose();group.clear();
}
