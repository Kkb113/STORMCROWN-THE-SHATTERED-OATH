/** Cached clearance grid with reusable A* workspaces. Routes go around pillars,
 * not through room centres. The swept movement solver remains authoritative.
 * Static walkability is memoized; temporary boss holes are checked per query.
 */
const OFFSETS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
class MinHeap {
  constructor(){this.items=[];this.priorities=[];}
  clear(){this.items.length=this.priorities.length=0;}
  push(id,priority){
    let i=this.items.length;this.items.push(id);this.priorities.push(priority);
    while(i>0){const p=(i-1)>>1;if(this.priorities[p]<=priority)break;this.items[i]=this.items[p];this.priorities[i]=this.priorities[p];i=p;}
    this.items[i]=id;this.priorities[i]=priority;
  }
  pop(){
    const first=this.items[0],last=this.items.pop(),value=this.priorities.pop(),n=this.items.length;
    if(n){let i=0;while(i*2+1<n){let c=i*2+1;if(c+1<n&&this.priorities[c+1]<this.priorities[c])c++;if(this.priorities[c]>=value)break;this.items[i]=this.items[c];this.priorities[i]=this.priorities[c];i=c;}this.items[i]=last;this.priorities[i]=value;}
    return first;
  }
}
export class NavigationGrid {
  constructor(world,cellSize=1.25){
    this.world=world;this.cell=cellSize;this.cache=new Map();this.heap=new MinHeap();this.generation=0;
    const extent=r=>r.shape==='rect'?Math.max(r.width,r.depth)/2:r.radius;
    this.minX=Math.floor(Math.min(...world.rooms.map(r=>r.x-extent(r)))/cellSize)-2;
    this.minZ=Math.floor(Math.min(...world.rooms.map(r=>r.z-extent(r)))/cellSize)-2;
    this.width=Math.ceil(Math.max(...world.rooms.map(r=>r.x+extent(r)))/cellSize)-this.minX+3;
    this.height=Math.ceil(Math.max(...world.rooms.map(r=>r.z+extent(r)))/cellSize)-this.minZ+3;
    const n=this.width*this.height;
    this.cost=new Float32Array(n);this.parent=new Int32Array(n);this.seen=new Uint32Array(n);this.closed=new Uint32Array(n);
    this.stats={queries:0,expanded:0,cacheMisses:0};
  }
  point(id){return {x:(id%this.width+this.minX)*this.cell,z:(Math.floor(id/this.width)+this.minZ)*this.cell};}
  coords(p){return {x:Math.round(p.x/this.cell)-this.minX,z:Math.round(p.z/this.cell)-this.minZ};}
  valid(x,z){return x>=0&&z>=0&&x<this.width&&z<this.height;}
  open(id,radius,cache){
    if(!cache[id]){
      this.stats.cacheMisses++;
      cache[id]=this.world.isStaticWalkable(this.point(id),radius)?2:1;
    }
    if(cache[id]!==2)return false;
    if(this.world.holes.length){const p=this.point(id);for(const h of this.world.holes)if((p.x-h.x)**2+(p.z-h.z)**2<(h.radius+radius)**2)return false;}
    return true;
  }
  nearest(p,radius,cache){
    const c=this.coords(p);let best=-1,bestD=Infinity;
    for(let z=c.z-3;z<=c.z+3;z++)for(let x=c.x-3;x<=c.x+3;x++){
      if(!this.valid(x,z))continue;const id=z*this.width+x,q=this.point(id),d=(p.x-q.x)**2+(p.z-q.z)**2;
      if(d<bestD&&this.open(id,radius,cache)&&this.world.clearLine(p,q,radius)){best=id;bestD=d;}
    }
    return best;
  }
  find(from,to,radius=.55){
    this.stats.queries++;
    // A small set of clearance buckets bounds memory across the eleven heroes.
    // Character definitions provide a bounded set of exact clearance radii.
    // Rounding upward can reject a valid actor standing next to an edge.
    let cache=this.cache.get(radius);if(!cache){cache=new Uint8Array(this.width*this.height);this.cache.set(radius,cache);}
    const start=this.nearest(from,radius,cache),goal=this.nearest(to,radius,cache);
    if(start<0||goal<0)return [{x:to.x,z:to.z}];
    const gx=goal%this.width,gz=Math.floor(goal/this.width),heuristic=id=>{
      const dx=Math.abs(id%this.width-gx),dz=Math.abs(Math.floor(id/this.width)-gz);return Math.max(dx,dz)+.41421356*Math.min(dx,dz);
    };
    if(++this.generation===0xffffffff){this.seen.fill(0);this.closed.fill(0);this.generation=1;}
    const stamp=this.generation;this.heap.clear();this.heap.push(start,heuristic(start));this.cost[start]=0;this.seen[start]=stamp;this.parent[start]=-1;
    let reached=false,expanded=0;
    while(this.heap.items.length&&expanded<9000){
      const id=this.heap.pop();if(this.closed[id]===stamp)continue;
      if(id===goal){reached=true;break;}this.closed[id]=stamp;expanded++;
      const x=id%this.width,z=Math.floor(id/this.width);
      for(const [dx,dz,length] of OFFSETS){
        const nx=x+dx,nz=z+dz;if(!this.valid(nx,nz))continue;const next=nz*this.width+nx;
        if(this.closed[next]===stamp||!this.open(next,radius,cache))continue;
        // Never cut the corner of a pillar or jump across the edge of a bridge.
        if(dx&&dz&&(!this.open(z*this.width+nx,radius,cache)||!this.open(nz*this.width+x,radius,cache)))continue;
        if(!this.world.clearLine(this.point(id),this.point(next),radius))continue;
        const cost=this.cost[id]+length;if(this.seen[next]===stamp&&cost>=this.cost[next])continue;
        this.seen[next]=stamp;this.cost[next]=cost;this.parent[next]=id;this.heap.push(next,cost+heuristic(next));
      }
    }
    this.stats.expanded+=expanded;if(!reached)return [{x:to.x,z:to.z}];
    const reverse=[];for(let id=goal;id!==-1;id=this.parent[id])reverse.push(this.point(id));
    reverse.reverse();reverse.push({x:to.x,z:to.z});
    const result=[];let anchor=from;
    for(let i=0;i<reverse.length;){
      let far=i;while(far+1<reverse.length&&this.world.clearLine(anchor,reverse[far+1],radius))far++;
      const p=reverse[far];result.push(p);anchor=p;i=far+1;
    }
    return result;
  }
}
