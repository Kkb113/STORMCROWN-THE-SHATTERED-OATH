/** Exact segment coverage by the union of traversable platforms and bridge
 * capsules. Sampling missed thin gaps at bridge mouths and stranded followers.
 * Intervals also avoid the cost of walking dozens of samples down every ray.
 */
import { segmentDistanceSq } from '../core/math.js';
const EPS=1e-8;
function circle(a,dx,dz,x,z,r){
  if(r<0)return null;
  const ox=a.x-x,oz=a.z-z,q=dx*dx+dz*dz,c=ox*ox+oz*oz-r*r;
  if(q<EPS)return c<=EPS?[0,1]:null;
  const b=ox*dx+oz*dz,disc=b*b-q*c;if(disc<0)return null;
  const root=Math.sqrt(Math.max(0,disc)),lo=Math.max(0,(-b-root)/q),hi=Math.min(1,(-b+root)/q);
  return lo<=hi+EPS?[lo,hi]:null;
}
function polygon(a,dx,dz,x,z,planes){
  const ox=a.x-x,oz=a.z-z;let lo=0,hi=1;
  for(const [nx,nz,c]of planes){
    const start=ox*nx+oz*nz,change=dx*nx+dz*nz;
    if(Math.abs(change)<EPS){if(start>c+EPS)return null;continue;}
    const at=(c-start)/change;if(change>0)hi=Math.min(hi,at);else lo=Math.max(lo,at);
    if(lo>hi+EPS)return null;
  }
  return [Math.max(0,lo),Math.min(1,hi)];
}
export function clearSegment(world,a,b,radius=.55){
  const dx=b.x-a.x,dz=b.z-a.z,segments=[];
  const add=s=>{if(s&&s[0]<=s[1]+EPS)segments.push(s);};
  for(const room of world.rooms){
    if(room.shape==='rect'){
      const x=room.width/2-radius,z=room.depth/2-radius;
      add(polygon(a,dx,dz,room.x,room.z,[[1,0,x],[-1,0,x],[0,1,z],[0,-1,z]]));
    }else if(room.shape==='octagon'){
      const r=room.radius-radius,d=r*1.4142;
      add(polygon(a,dx,dz,room.x,room.z,[[1,0,r],[-1,0,r],[0,1,r],[0,-1,r],[1,1,d],[1,-1,d],[-1,1,d],[-1,-1,d]]));
    }else add(circle(a,dx,dz,room.x,room.z,room.radius-radius));
  }
  for(const bridge of world.bridges){
    const x=bridge.b.x-bridge.a.x,z=bridge.b.z-bridge.a.z,length=Math.hypot(x,z),r=Math.max(.5,bridge.width/2-radius);
    if(length<EPS){add(circle(a,dx,dz,bridge.a.x,bridge.a.z,r));continue;}
    const nx=x/length,nz=z/length;
    add(polygon(a,dx,dz,bridge.a.x,bridge.a.z,[[nx,nz,length],[-nx,-nz,0],[-nz,nx,r],[nz,-nx,r]]));
    add(circle(a,dx,dz,bridge.a.x,bridge.a.z,r));add(circle(a,dx,dz,bridge.b.x,bridge.b.z,r));
  }
  segments.sort((s,t)=>s[0]-t[0]);let end=0;
  for(const [lo,hi]of segments){if(lo>end+EPS)return false;end=Math.max(end,hi);if(end>=1-EPS)break;}
  if(end<1-EPS)return false;
  for(const o of world.obstacles)if(segmentDistanceSq(o,a,b)<(o.radius+radius)**2-EPS)return false;
  for(const h of world.holes)if(segmentDistanceSq(h,a,b)<(h.radius+radius)**2-EPS)return false;
  return true;
}
