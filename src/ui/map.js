import { distance, clamp, TAU } from '../core/math.js';
/** The map is drawn from collision/navigation data, not a decorative mockup. */
export function drawMap(canvas,sim,{full=false,region=0}={}){
  if(!canvas||!sim)return;
  const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height,p=sim.activeHero;
  ctx.clearRect(0,0,width,height);ctx.save();
  if(!full){ctx.beginPath();ctx.arc(width*.5,height*.5,width*.475,0,TAU);ctx.clip();}
  ctx.fillStyle='#0a0e17';ctx.fillRect(0,0,width,height);
  let center={x:p.x,z:p.z},scale=width/105;
  if(full){const rooms=sim.world.rooms;const xs=rooms.map(r=>r.x),zs=rooms.map(r=>r.z);const minX=Math.min(...xs)-32,maxX=Math.max(...xs)+32,minZ=Math.min(...zs)-32,maxZ=Math.max(...zs)+32;center={x:(minX+maxX)/2,z:(minZ+maxZ)/2};scale=Math.min(width/(maxX-minX+15),height/(maxZ-minZ+15));}
  const project=(x,z)=>({x:width*.5+(x-center.x)*scale,z:height*.5+(z-center.z)*scale});
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const bridge of sim.world.bridges){const a=project(bridge.a.x,bridge.a.z),b=project(bridge.b.x,bridge.b.z);ctx.strokeStyle='#253144';ctx.lineWidth=bridge.width*scale;ctx.beginPath();ctx.moveTo(a.x,a.z);ctx.lineTo(b.x,b.z);ctx.stroke();ctx.strokeStyle='#5a4e3d';ctx.lineWidth=1;ctx.stroke();}
  for(const room of sim.world.rooms){
    const q=project(room.x,room.z),seen=sim.world.isHub||sim.profile.visited[`${sim.mission.id}:${room.id}`]||distance(room,p)<room.radius+22,current=room.id===sim.director.index;
    ctx.fillStyle=seen?'#263044':'#141c2b';ctx.strokeStyle=current?'#d1b276':seen?'#657085':'#303b4e';ctx.lineWidth=current?2:1;
    ctx.beginPath();if(room.shape==='rect')ctx.rect(q.x-room.width*scale*.5,q.z-room.depth*scale*.5,room.width*scale,room.depth*scale);else ctx.arc(q.x,q.z,room.radius*scale,0,TAU);ctx.fill();ctx.stroke();
    if(full){ctx.fillStyle=current?'#f2d9a4':'#b8bfd0';ctx.font=`${Math.max(11,Math.min(16,scale*4))}px system-ui`;ctx.textAlign='center';ctx.fillText(room.id<0?'◆':String(room.id+1),q.x,q.z+5);}
  }
  for(const hole of sim.world.holes){const q=project(hole.x,hole.z);ctx.fillStyle='#090c14';ctx.beginPath();ctx.arc(q.x,q.z,hole.radius*scale,0,TAU);ctx.fill();}
  const diamond=(q,s,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(q.x,q.z-s);ctx.lineTo(q.x+s,q.z);ctx.lineTo(q.x,q.z+s);ctx.lineTo(q.x-s,q.z);ctx.closePath();ctx.fill();};
  for(const object of sim.objects){
    if(object.used||object.dead||!full&&distance(object,p)>55)continue;
    if(object.stage!==undefined&&object.stage!==sim.director.index&&!object.optional)continue;
    const q=project(object.x,object.z),color=object.objectType==='beacon'||object.objectType==='escapeBeacon'?'#fee3a3':object.optional?'#82b9d5':object.team==='hostile'?'#e48578':'#e5c684';diamond(q,full?4:3,color);
    if(full&&sim.world.isHub){ctx.fillStyle='#ddd3c1';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText(object.label,q.x+7,q.z+4);}
  }
  for(const e of sim.enemies){if(e.dead||distance(e,p)>58&&!full)continue;const q=project(e.x,e.z);if(e.kind==='boss')diamond(q,5,'#fa9b89');else{ctx.fillStyle=e.elite?'#eda784':'#bb5e64';ctx.beginPath();ctx.arc(q.x,q.z,full?2.5:2,0,TAU);ctx.fill();}}
  for(const c of sim.civilians){if(c.dead||c.safe)continue;const q=project(c.x,c.z);ctx.fillStyle='#9bc1a4';ctx.fillRect(q.x-2.5,q.z-2.5,5,5);}
  if(full)for(const e of sim.figures){const q=project(e.x,e.z);diamond(q,3,e.definition?.color||'#b5add3');if(sim.world.isHub){ctx.fillStyle='#bac0d3';ctx.font='11px system-ui';ctx.textAlign=e.x<0?'right':'left';ctx.fillText(e.short,q.x+(e.x<0?-8:8),q.z+4);}}
  for(const h of sim.party){if(h.dead)continue;const q=project(h.x,h.z);if(h.id!==p.id){diamond(q,3.5,h.definition.color);continue;}ctx.save();ctx.translate(q.x,q.z);ctx.rotate(-h.angle);ctx.fillStyle='#f2ead7';ctx.strokeStyle='#0d0c15';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(-5,-5);ctx.lineTo(0,-2);ctx.lineTo(5,-5);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();}
  if(!full){ctx.fillStyle='rgba(207,185,135,.8)';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText('N',width*.5,15);}
  ctx.restore();
}
