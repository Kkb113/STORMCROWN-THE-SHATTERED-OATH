import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HERO_BY_ID, ELEMENTS } from '../data/heroes.js';
import { bevelBox, tube, cylinderBetween, shardGeometry } from './geometry.js';
import { clamp, TAU, random, hashString } from '../core/math.js';

const Y=new THREE.Vector3(0,1,0),TMP=new THREE.Matrix4();
const FACE=new THREE.SphereGeometry(1,16,12),OVAL=new THREE.SphereGeometry(1,12,8),SMALL=new THREE.SphereGeometry(1,8,6);
const DEF_RIG=[
  ['root',null,[0,0,0]],['hips','root',[0,1.14,0]],['spine','hips',[0,.3,0]],['chest','spine',[0,.34,0]],['neck','chest',[0,.27,0]],['head','neck',[0,.2,0]],
  ['upperL','chest',[.45,.025,0]],['foreL','upperL',[0,-.43,0]],['handL','foreL',[0,-.38,0]],
  ['upperR','chest',[-.45,.025,0]],['foreR','upperR',[0,-.43,0]],['handR','foreR',[0,-.38,0]],
  ['thighL','hips',[.2,-.06,0]],['shinL','thighL',[0,-.52,0]],['footL','shinL',[0,-.49,0]],
  ['thighR','hips',[-.2,-.06,0]],['shinR','thighR',[0,-.52,0]],['footR','shinR',[0,-.49,0]],
  ['capeA','chest',[0,.1,-.19]],['capeB','capeA',[0,-.6,-.08]],['capeC','capeB',[0,-.62,-.08]],
];
const BEAST_RIG=['L','R'].flatMap(side=>['front','rear'].flatMap(end=>{
  const sign=side==='L'?1:-1,name=`${end}${side}`;
  return [[name,'root',[sign*.44,1.3,end==='front'?.64:-.72]],
    [`${name}Knee`,name,[sign*.02,-.7,.08]],[`${name}Paw`,`${name}Knee`,[sign*.01,-.47,.13]]];
}));
function rig(beast=false){
  const bones=[],map={};for(const [name,parent,pos] of beast?[...DEF_RIG,...BEAST_RIG]:DEF_RIG){const b=new THREE.Bone();b.name=name;b.position.set(...pos);b.userData.rest=b.position.clone();bones.push(b);map[name]=b;if(parent)map[parent].add(b);}
  map.root.updateMatrixWorld(true);return {bones,map,skeleton:new THREE.Skeleton(bones)};
}
class SkinBuilder {
  constructor(r){this.rig=r;this.parts=[];this.binds=r.bones.map(b=>b.matrixWorld.clone());this.index=Object.fromEntries(r.bones.map((b,i)=>[b.name,i]));}
  part(geometry,bone='root',position=[0,0,0],scale=[1,1,1],col=0x777777,surface=[.4,.7,0],rot=[0,0,0]){
    let g=geometry.index?geometry.toNonIndexed():geometry.clone();
    const local=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale));
    g.applyMatrix4(this.binds[this.index[bone]].clone().multiply(local));
    const n=g.attributes.position.count,color=new THREE.Color(col),colors=new Float32Array(n*3),surfaces=new Float32Array(n*3),indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
    for(let i=0;i<n;i++){color.toArray(colors,i*3);surfaces.set(surface,i*3);indices[i*4]=this.index[bone];weights[i*4]=1;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('surface',new THREE.BufferAttribute(surfaces,3));g.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));
    for(const a of Object.keys(g.attributes))if(!['position','normal','uv','color','surface','skinIndex','skinWeight'].includes(a))g.deleteAttribute(a);
    this.parts.push(g);return this;
  }
  oval(bone,p,s,c,surface=[.48,.65,0],rot=[0,0,0]){return this.part(Math.max(...s)<.12?SMALL:OVAL,bone,p,s,c,surface,rot);}
  box(bone,p,s,c,surface=[.32,.85,0],rot=[0,0,0],bevel=.03){const g=bevelBox(...s,bevel);this.part(g,bone,p,[1,1,1],c,surface,rot);g.dispose();return this;}
  line(bone,points,r,c,surface=[.36,.85,0]){const g=tube(points,r,5);this.part(g,bone,[0,0,0],[1,1,1],c,surface);g.dispose();return this;}
  finish(){const g=mergeGeometries(this.parts,false);for(const p of this.parts)p.dispose();g.computeBoundingSphere();g.boundingSphere.radius=Math.max(4.8,g.boundingSphere.radius+1);return g;}
}
const METAL=[.32,.78,0],DARK=[.48,.65,0],GOLD=[.32,.84,0],CLOTH=[.96,.02,0],SKIN=[.64,.02,0],LEATHER=[.85,.1,0];
function bladeGeometry(width=.13,length=1.05){
  // Diamond-section blades retain a razor-like highlight even at the isometric distance.
  const w=width,h=length,positions=[
    -w,0,0, 0,0,.035, 0,h,0, 0,0,.035, w,0,0, 0,h,0,
    w,0,0, 0,0,-.035, 0,h,0, 0,0,-.035,-w,0,0,0,h,0,
    -w,0,0,0,0,-.035,0,0,.035, 0,0,-.035,w,0,0,0,0,.035,
  ];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
function weapon(builder,bone,kind,palette,rank=0,left=false){
  const b=builder,c=palette,metal=rank>=3?0xc3cce0:0x8694a5,gold=rank>=4?0xe1bc68:c.trim,glow=[.22,.4,rank>0?1.7:.35],origin=[0,-.02,.06];
  const handle=(len=.34)=>{const g=new THREE.CylinderGeometry(.038,.048,len,8);b.part(g,bone,[0,len*.17,0],[1,1,1],0x302c35,LEATHER);g.dispose();};
  const spear=(short=false)=>{
    const len=short?1.35:2.3;const g=new THREE.CylinderGeometry(.038,.05,len,8);b.part(g,bone,[0,len*.08,0],[1,1,1],gold,METAL);g.dispose();
    for(let i=0;i<4;i++)b.box(bone,[0,-.25+i*.12,0],[.105,.035,.105],0x26282f,LEATHER);
    const blade=bladeGeometry(.11+(rank*.015),short?.5:.65);b.part(blade,bone,[0,len*.58,0],[1,1,1],metal,METAL);blade.dispose();
    b.oval(bone,[0,len*.61,.045],[.048,.14,.025],c.glow,glow);
    b.box(bone,[0,len*.59,0],[.24,.04,.065],gold,GOLD);
  };
  if(kind==='sword'||kind==='daggers'||kind==='chains'||kind==='ritual'){
    handle();const length=kind==='daggers'?.67:kind==='ritual'?.86:kind==='chains'?.76:1.35+rank*.13;
    const blade=bladeGeometry(kind==='sword'?.14+rank*.016:.10,length);b.part(blade,bone,[0,.17,0],[1,1,1],metal,METAL);blade.dispose();
    b.box(bone,[0,.16,0],[kind==='sword'?.48:.31,.06,.1],gold,GOLD,[0,0,left?-.12:.12]);
    b.oval(bone,[0,.22,.037],[.042,.18,.025],c.glow,glow);
    b.oval(bone,[0,-.17,0],[.07,.075,.07],gold,GOLD);
    if(rank>=2){b.line(bone,[[0,.52,.04],[.045,.76,.026],[-.04,1.03,.013],[0,1.2,0]],.008,c.glow,glow);}
    if(kind==='chains'){
      for(let i=0;i<9;i++){const g=new THREE.TorusGeometry(.051,.012,4,8);b.part(g,bone,[Math.sin(i*.5)*.12,-.18-i*.067,-.025],[1,1,1],gold,METAL,[i%2?Math.PI/2:0,0,.2]);g.dispose();}
      b.oval(bone,[0,-.74,0],[.08,.12,.07],c.glow,[.4,.5,.5]);
    }
  }else if(kind==='hammer'){
    const g=new THREE.CylinderGeometry(.055,.066,1.38,10);b.part(g,bone,[0,.22,0],[1,1,1],0x594333,LEATHER);g.dispose();
    for(let i=0;i<6;i++)b.box(bone,[0,-.15+i*.08,0],[.14,.025,.14],gold,GOLD);
    b.box(bone,[0,1.03,0],[.97+rank*.07,.43,.42],0x58606d,DARK,[0,0,0],.08);
    b.box(bone,[-.55-rank*.026,1.03,0],[.15,.5,.5],gold,GOLD);b.box(bone,[.55+rank*.026,1.03,0],[.15,.5,.5],gold,GOLD);
    b.box(bone,[0,1.03,.22],[.31,.3,.028],c.glow,[.2,.5,1.2]);
    for(let i=-1;i<=1;i++)b.line(bone,[[i*.1-.06,.9,.24],[i*.1,1.06,.244],[i*.1-.05,1.16,.24]],.012,gold,GOLD);
  }else if(kind==='staff'){
    const g=new THREE.CylinderGeometry(.032,.07,2.1,10);b.part(g,bone,[0,.5,0],[1,1,1],0x67758c,DARK);g.dispose();
    b.oval(bone,[0,1.64,0],[.16,.22,.16],c.glow,[.16,.1,2]);
    for(let i=0;i<3;i++){const a=i*TAU/3;b.line(bone,[[0,1.32,0],[Math.cos(a)*.28,1.68,Math.sin(a)*.28],[Math.cos(a)*.14,1.97,Math.sin(a)*.14]],.036,gold,GOLD);}
    for(let i=0;i<4;i++)b.box(bone,[0,-.18+i*.1,0],[.12,.035,.12],gold,GOLD);
  }else if(kind==='spearshield'){
    if(!left)spear(false);else{
      const sh=new THREE.Shape();sh.moveTo(-.32,.34);sh.quadraticCurveTo(0,.54,.32,.34);sh.lineTo(.27,-.13);sh.lineTo(0,-.46);sh.lineTo(-.27,-.13);sh.closePath();
      const g=new THREE.ExtrudeGeometry(sh,{depth:.06,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1});b.part(g,bone,[0,0,.11],[1.4,1.35,1],gold,GOLD);g.dispose();
      b.oval(bone,[0,.06,.205],[.28,.38,.04],c.cloth,DARK);b.box(bone,[0,.04,.253],[.055,.6,.025],gold,GOLD);b.box(bone,[0,.14,.26],[.4,.055,.025],gold,GOLD);b.oval(bone,[0,.15,.29],[.075,.09,.035],c.glow,glow);
    }
  }else if(kind==='twinspears')spear(true);
  else if(kind==='bow'){
    if(left){
      b.line(bone,[[0,-.82,0],[.15,-.64,.05],[.24,-.36,.08],[.11,0,0],[.24,.36,.08],[.15,.64,.05],[0,.82,0]],.045,gold,GOLD);
      b.line(bone,[[0,-.82,0],[0,0,-.18],[0,.82,0]],.009,rank>=2?c.glow:0xc0b7a1,rank>=2?glow:CLOTH);
      b.box(bone,[.11,0,0],[.12,.28,.12],0x3c3434,LEATHER);
      b.oval(bone,[.19,.4,.1],[.06,.12,.035],c.glow,glow);
    }else b.line(bone,[[0,-.12,0],[0,.72,0]],.014,0xbeb6a7,METAL);
  }else if(kind==='gauntlets'){
    b.box(bone,[0,.02,0],[.33,.38,.36],metal,METAL,[0,0,0],.06);
    b.box(bone,[0,.03,.19],[.27,.25,.045],gold,GOLD);
    b.oval(bone,[0,.04,.226],[.08,.08,.028],c.glow,[.2,.2,1.8]);
    for(let i=0;i<3;i++)b.box(bone,[-.085+i*.085,-.18,.15],[.06,.08,.1],gold,GOLD);
  }else if(kind==='claws'){
    b.box(bone,[0,.02,.04],[.23,.19,.17],gold,GOLD);
    for(let i=0;i<3;i++){const g=bladeGeometry(.026,.45);b.part(g,bone,[-.075+i*.075,.12,.07],[1,1,1],metal,METAL,[.1,0,(i-1)*.1]);g.dispose();}
  }
}
function cloak(b,palette,long=false,hood=false){
  const colors=palette.cloth,w=.5,rows=9,cols=10,positions=[],indices=[],uv=[],weights=[],skin=[],color=[],surface=[],base=b.binds[b.index.capeA],v=new THREE.Vector3(),c=new THREE.Color(colors);
  const len=long?1.88:1.45;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const t=j/rows,u=i/cols,x=(u-.5)*w*2*(1+.42*t),y=-t*len,z=-.03-.16*t+Math.cos(u*Math.PI*8)*.027*t;
    v.set(x,y,z).applyMatrix4(base);positions.push(v.x,v.y,v.z);uv.push(u,t);
    const bone=j<3?'capeA':j<6?'capeB':'capeC';skin.push(b.index[bone],0,0,0);weights.push(1,0,0,0);
    color.push(c.r*(i===0||i===cols?1.8:1),c.g*(i===0||i===cols?1.6:1),c.b*(i===0||i===cols?1.4:1));surface.push(.97,.02,0);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,c=a+cols+1;indices.push(a,c,a+1,a+1,c,c+1);}
  let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setAttribute('surface',new THREE.Float32BufferAttribute(surface,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skin,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(indices);g.computeVertexNormals();const flat=g.toNonIndexed();g.dispose();b.parts.push(flat);
  if(hood){b.oval('head',[0,.02,-.055],[.305,.36,.255],palette.cloth,CLOTH);b.oval('head',[0,-.07,.146],[.204,.24,.105],0x151421,CLOTH);}
}
function humanoidGeometry(e,r){
  const h=HERO_BY_ID[e.heroId],rank=e.rank||0,enemy=e.team==='hostile',caster=['staff','ritual'].includes(e.weapon),feminine=['sera','nym','mira','maelin'].includes(e.heroId)||e.bossType==='saint';
  const broad=e.heroId==='brann'||['colossus','brute','warengine'].includes(e.bossType||e.enemyType);
  const palette={cloth:h?.cloth || (e.bossType==='malthren'?0x382c48:enemy?0x29222c:0x354254),skin:h?.skin ||(e.bossType==='saint'?0xc8dae0:0x8d766a),hair:h?.hair ||0x302b2c,
    metal:enemy?0x596270:rank>=3?0xb0bfd1:0x899cb6,trim:rank>=4?0xdabc6b:e.bossType==='malthren'?0xd4b465:enemy?0x9e856b:0xc5b18c,glow:e.color||0xaaa0ff};
  if(e.heroId==='lucen'){palette.metal=0x655b7d;palette.trim=0xbba6ce;}
  const b=new SkinBuilder(r),width=broad?1.2:feminine?.9:1;
  // Fitted gambeson, articulated breastplate, fauld, and individually laid armor lames.
  b.oval('spine',[0,-.08,0],[.31*width,.36,.19],palette.cloth,CLOTH);
  b.oval('chest',[0,-.1,0],[.37*width,.34,.22],palette.metal,DARK);
  for(let side of [-1,1]){
    b.oval('chest',[side*.165*width,-.05,.11],[.195*width,.21,.14],palette.metal,METAL,[0,side*.18,-side*.1]);
    b.line('chest',[[side*.035,.13,.17],[side*.23,.06,.24],[side*.30,-.15,.19]],.018,palette.trim,GOLD);
  }
  b.box('chest',[0,-.17,.24],[.11,.35,.044],palette.trim,GOLD,[0,0,0],.01);
  b.oval('chest',[0,.03,.266],[.056,.082,.028],palette.glow,[.22,.45,rank>=1?1.4:.4]);
  for(let i=0;i<3;i++)b.oval('spine',[0,-.04-i*.10,.095],[.285*width,.088,.15],palette.metal,DARK);
  b.box('hips',[0,.05,.01],[.7*width,.12,.41],0x332a29,LEATHER);
  b.box('hips',[0,.05,.235],[.17,.16,.05],palette.trim,GOLD);
  for(let side of [-1,1]){
    b.oval('hips',[side*.3,-.08,-.02],[.16,.19,.15],palette.cloth,CLOTH);
    for(let i=0;i<3;i++)b.box('hips',[side*(.28+i*.025),-.16-i*.1,.09],[.19,.12,.28],palette.metal,DARK,[0,0,side*.1],.018);
    b.oval('hips',[side*.18,-.28,.08],[.13,.18,.15],palette.cloth,CLOTH);
  }
  if(caster){
    for(let i=0;i<10;i++){const a=i*TAU/10;b.oval('hips',[Math.sin(a)*.24,-.36,Math.cos(a)*.14],[.19,.44,.13],palette.cloth,CLOTH,[Math.cos(a)*.1,0,-Math.sin(a)*.1]);}
  }
  for(const side of ['L','R']){
    const sign=side==='L'?1:-1,upper=`upper${side}`,fore=`fore${side}`,hand=`hand${side}`,thigh=`thigh${side}`,shin=`shin${side}`,foot=`foot${side}`;
    b.oval(upper,[0,-.19,0],[.13*width,.25,.14],palette.cloth,CLOTH,[0,0,sign*.025]);
    // Raised, overlapping shoulder plates and trim make silhouettes readable at game scale.
    for(let i=0;i<3;i++)b.oval(upper,[sign*.035*i,-i*.075,.01],[.245*width-i*.015,.13,.25-i*.013],i===0?palette.metal:palette.metal,DARK,[0,0,sign*(.12+i*.08)]);
    b.line(upper,[[-.19,.018,.15],[0,.12,.24],[.2,.01,.15]],.022,palette.trim,GOLD);
    if(broad||rank>=3||enemy){for(let i=0;i<2;i++){const g=new THREE.ConeGeometry(.07,.23+(broad?.1:0),5);b.part(g,upper,[sign*(.12+i*.11),.17-i*.07,-.02],[1,1,1],palette.trim,GOLD,[0,0,-sign*.6]);g.dispose();}}
    b.oval(fore,[0,-.17,0],[.108,.22,.12],palette.cloth,CLOTH);
    b.oval(fore,[0,-.15,.02],[.14,.20,.16],palette.metal,DARK);
    b.box(fore,[0,-.14,.152],[.15,.3,.04],palette.metal,METAL,[0,0,0],.025);
    for(let i=0;i<2;i++)b.oval(fore,[0,-.04-i*.22,0],[.147,.035,.157],palette.trim,GOLD);
    b.oval(hand,[0,-.035,.012],[.084,.10,.062],0x413b3e,LEATHER);
    for(let i=0;i<4;i++)b.oval(hand,[-.051+i*.034,-.08,.047],[.017,.045,.019],palette.metal,DARK);
    b.oval(thigh,[0,-.22,0],[.155,.29,.165],palette.cloth,CLOTH);
    b.oval(thigh,[0,-.19,.10],[.14,.24,.085],palette.metal,DARK);
    b.oval(shin,[0,.045,.08],[.15,.145,.115],palette.metal,METAL);
    b.oval(shin,[0,-.20,0],[.124,.26,.145],0x353033,LEATHER);
    b.box(shin,[0,-.19,.12],[.18,.39,.095],palette.metal,DARK,[0,0,0],.025);
    b.line(shin,[[0,-.37,.172],[0,-.08,.186]],.012,palette.trim,GOLD);
    b.oval(foot,[0,.05,.12],[.143,.105,.245],0x302c32,LEATHER);
    b.oval(foot,[0,.068,.23],[.147,.067,.14],palette.metal,METAL);
    b.box(foot,[0,-.018,.1],[.28,.055,.43],0x171b23,LEATHER);
  }
  // A modeled face, not a blank sphere: jaw, eye sockets, brows, nose, lips, ears and hair locks.
  b.part(FACE,'head',[0,0,0],[feminine?.216:.228,.29,.213],palette.skin,SKIN);
  b.oval('head',[0,-.18,.026],[.165,.118,.154],palette.skin,SKIN);
  b.oval('neck',[0,.045,0],[.105,.17,.106],palette.skin,SKIN);
  b.oval('head',[0,-.018,.202],[.036,.087,.044],palette.skin,SKIN);
  b.oval('head',[0,-.062,.237],[.043,.03,.027],palette.skin,SKIN);
  b.line('head',[[-.066,-.129,.183],[0,-.139,.199],[.064,-.128,.182]],.009,0x825355,SKIN);
  for(const side of [-1,1]){
    b.oval('head',[side*.217,-.025,0],[.04,.076,.045],palette.skin,SKIN);
    b.oval('head',[side*.086,.02,.184],[.066,.033,.035],0x392d31,SKIN);
    b.oval('head',[side*.087,.023,.208],[.042,.015,.012],0xc6d1d1,SKIN);
    b.oval('head',[side*.086,.024,.22],[.015,.016,.006],e.bossType==='saint'?0xa8eeff:enemy?0xeaa984:0x69959c,enemy?[.35,.2,1]:SKIN);
    b.line('head',[[side*.042,.072,.197],[side*.093,.083,.199],[side*.145,.065,.173]],.013,palette.hair,CLOTH);
  }
  const hood=['vex','maelin'].includes(e.heroId)||e.enemyType==='priest';
  if(!hood){
    b.oval('head',[0,.145,-.025],[.239,.197,.22],palette.hair,CLOTH);
    const rng=random(hashString(e.heroId||e.bossType||e.enemyType||'soldier'));
    for(let i=0;i<12;i++){
      const a=i*TAU/12,r=.18;
      b.line('head',[[Math.sin(a)*r,.23+Math.cos(a)*.02,Math.cos(a)*r-.015],[Math.sin(a+.15)*.226,.13,Math.cos(a+.15)*.21],[Math.sin(a+.3)*.223,-.02-rng()*(feminine?.25:.08),Math.cos(a+.3)*.194]],.027+rng()*.015,palette.hair,CLOTH);
    }
    if(e.heroId==='sera')b.line('head',[[0,.12,-.19],[0,-.1,-.35],[.02,-.43,-.35],[.12,-.60,-.32]],.09,palette.hair,CLOTH);
    if(e.heroId==='nym')for(let s of [-1,1])b.line('head',[[s*.16,.12,-.07],[s*.24,-.14,-.02],[s*.2,-.48,-.05]],.07,palette.hair,CLOTH);
    if(e.heroId==='brann')b.oval('head',[0,-.16,.103],[.2,.19,.16],palette.hair,CLOTH);
  }
  cloak(b,palette,caster,hood);
  if(enemy && !e.echo && !['lucen','saint','malthren','astra'].includes(e.bossType)){
    b.oval('head',[0,.05,-.013],[.265,.33,.235],palette.metal,DARK);
    b.box('head',[0,-.04,.21],[.37,.20,.055],palette.metal,DARK,[0,0,0],.025);
    for(const s of [-1,1])b.box('head',[s*.084,.075,.229],[.11,.029,.033],e.element==='physical'?0xef7558:palette.glow,[.25,.1,1.6]);
    b.box('head',[0,.065,.245],[.037,.23,.035],palette.trim,GOLD);
    if(e.enemyType==='knight'||e.bossType==='colossus')for(const s of [-1,1])b.line('head',[[s*.18,.18,0],[s*.34,.34,-.02],[s*.34,.6,-.08]],.055,palette.trim,GOLD);
  }
  if(['malthren','ashking','saint','astra'].includes(e.bossType)){
    const g=new THREE.TorusGeometry(.26,.025,5,16);b.part(g,'head',[0,.17,0],[1,1,1],palette.trim,GOLD,[Math.PI/2,0,0]);g.dispose();
    for(let i=0;i<7;i++){const a=i*TAU/7,g=new THREE.ConeGeometry(.045,.30+(i%2)*.08,5);b.part(g,'head',[Math.sin(a)*.25,.3,Math.cos(a)*.24],[1,1,1],palette.trim,GOLD);g.dispose();}
  }
  if(e.bossType==='colossus'||e.enemyType==='guardian'){
    b.oval('chest',[0,-.02,.29],[.19,.23,.085],palette.glow,[.15,.3,2.4]);
    for(let i=0;i<6;i++)b.line('chest',[[Math.sin(i*TAU/6)*.2,Math.cos(i*TAU/6)*.23-.02,.3],[Math.sin(i*TAU/6)*.35,Math.cos(i*TAU/6)*.38-.02,.2]],.023,palette.trim,GOLD);
  }
  if(e.bossType==='astra')for(let i=0;i<5;i++){
    const g=shardGeometry(i,0);b.part(g,'chest',[Math.sin(i*1.2)*.7,.65+Math.cos(i*1.2)*.8,-.2],[.1,.4,.1],palette.glow,[.1,.5,1.8],[0,0,i*.8]);g.dispose();
  }
  const dual=['daggers','chains','claws','gauntlets','twinspears','spearshield','bow'].includes(e.weapon);
  if(e.weapon!=='none'){weapon(b,'handR',e.weapon,palette,rank,false);if(dual)weapon(b,'handL',e.weapon,palette,rank,true);}
  return b.finish();
}

function creatureGeometry(e,r){
  const b=new SkinBuilder(r),c=e.buffs?.beast?0x53644c:e.bossType==='worldbeast'?0x596756:0x43344a,glow=e.color||0xb695ff;
  // Anatomical quadruped anchored to the same leg/shoulder rig, plus layered scales and antlers.
  b.oval('root',[0,1.3,0],[.52,.52,1.12],c,[.87,.1,0]);
  b.oval('root',[0,1.51,.62],[.66,.58,.56],c,[.8,.14,0]);
  b.oval('root',[0,1.65,1.15],[.37,.39,.49],c,[.8,.12,0]);
  b.oval('root',[0,1.45,1.58],[.28,.22,.37],0x31312f,[.85,.05,0]);
  b.oval('root',[0,1.46,1.87],[.22,.12,.1],0x192427,[.4,.03,0]);
  for(const s of [-1,1]){
    b.oval('root',[s*.28,1.79,1.42],[.06,.04,.075],glow,[.2,.1,2.1]);
    for(let i=0;i<4;i++){const g=new THREE.ConeGeometry(.037,.19,5);b.part(g,'root',[s*.21,1.33,1.3+i*.12],[1,1,1],0xd9d2b8,[.65,.1,0],[Math.PI,0,0]);g.dispose();}
    b.line('root',[[s*.23,1.91,1],[s*.48,2.35,.91],[s*.62,2.66,.75],[s*.84,2.91,.6]],.065,0xbbb596,[.72,.08,0]);
    b.line('root',[[s*.51,2.42,.9],[s*.92,2.55,.83],[s*1.1,2.84,.68]],.042,0xbdb99b,[.7,.1,0]);
    b.line('root',[[s*.37,2.19,1],[s*.28,2.5,1.26],[s*.43,2.77,1.2]],.042,0xbdb99b,[.7,.1,0]);
    for(const end of ['front','rear']){
      const leg=`${end}${s===1?'L':'R'}`;
      b.oval(leg,[0,-.39,0],[.22,.47,.22],c,[.85,.1,0]);
      b.oval(`${leg}Knee`,[0,-.17,0],[.15,.32,.15],c,[.85,.1,0]);
      b.oval(`${leg}Paw`,[0,0,0],[.22,.12,.29],0x323731,[.8,.1,0]);
    }
  }
  b.line('root',[[0,1.35,-.91],[0,1.2,-1.45],[.22,1.34,-1.88],[.36,1.55,-2.13]],.15,c,[.9,.03,0]);
  for(let i=0;i<18;i++){const a=i*2.4,g=shardGeometry(i,0);b.part(g,'root',[Math.sin(a)*.43,1.75+(i%3)*.09,-.82+(i/18)*1.65],[.14,.26,.12],i%4===0?glow:c,i%4===0?[.3,.3,1]:[.78,.14,0],[0,0,Math.sin(a)*.7]);g.dispose();}
  return b.finish();
}
function rootlessGeometry(e,r){
  const b=new SkinBuilder(r),rng=random(1951);
  b.oval('root',[0,1.1,0],[1.1,1.5,.85],0x4d344a,[.54,.1,0]);
  for(let i=0;i<12;i++){const a=i*TAU/12,len=1.3+rng()*1.3;const points=[[Math.sin(a)*.5,.8,Math.cos(a)*.5],[Math.sin(a)*1.2,.3+rng(),Math.cos(a)*1.2],[Math.sin(a)*len,.18,Math.cos(a)*len],[Math.sin(a+.3)*(len+.5),.05,Math.cos(a+.3)*(len+.5)]];b.line('root',points,.17,0x55404c,[.67,.1,0]);b.line('root',points.map(p=>[p[0],p[1]+.11,p[2]]),.021,0xbe84f4,[.2,.1,1.4]);}
  for(let i=0;i<8;i++){const a=i*2.4;b.oval('root',[Math.sin(a)*.9,.9+(i%4)*.35,Math.cos(a)*.7],[.18,.25,.15],0x15121d,[.9,0,0]);b.oval('root',[Math.sin(a)*1,.9+(i%4)*.35,Math.cos(a)*.8],[.067,.11,.057],0xf0b0dc,[.2,.1,2]);}
  b.oval('root',[0,1.4,.85],[.39,.48,.09],0x211526,[.4,0,0]);
  for(let i=0;i<8;i++){const a=i*TAU/8,g=new THREE.ConeGeometry(.07,.26,5);b.part(g,'root',[Math.sin(a)*.29,1.4+Math.cos(a)*.38,.93],[1,1,1],0xb7a592,[.7,.05,0],[0,0,-a]);g.dispose();}
  return b.finish();
}
function engineGeometry(e,r){
  const b=new SkinBuilder(r),c=e.team==='party'?0x737f98:0x63594f,gold=e.team==='party'?0xc9b899:0xa78351,glow=e.team==='party'?0x80bfff:0xff8144;
  b.box('root',[0,.65,0],[1.5,.7,1.6],c,DARK,[0,0,0],.13);
  for(const s of [-1,1])for(const z of [-.7,.7]){const g=new THREE.CylinderGeometry(.38,.38,.23,12);b.part(g,'root',[s*.84,.4,z],[1,1,1],0x292f38,DARK,[0,0,Math.PI/2]);g.dispose();const ring=new THREE.TorusGeometry(.25,.04,5,12);b.part(ring,'root',[s*.98,.4,z],[1,1,1],gold,GOLD,[0,Math.PI/2,0]);ring.dispose();}
  b.box('root',[0,1.15,-.13],[1.02,.55,1.02],c,METAL,[0,0,0],.1);
  const barrel=new THREE.CylinderGeometry(.2,.27,1.7,12);b.part(barrel,'chest',[0,-.25,.8],[1,1,1],gold,GOLD,[Math.PI/2,0,0]);barrel.dispose();
  const ring=new THREE.TorusGeometry(.22,.045,6,16);b.part(ring,'chest',[0,-.25,1.63],[1,1,1],c,METAL);ring.dispose();
  b.oval('chest',[0,-.25,1.66],[.17,.17,.025],glow,[.22,.25,2.7]);
  b.oval('root',[0,1.3,-.65],[.24,.29,.18],glow,[.22,.25,1.8]);
  for(const side of [-1,1]){b.box('root',[side*.65,1,.1],[.18,.54,.75],gold,GOLD);b.line('root',[[side*.42,1.3,-.4],[side*.7,1.65,-.6],[side*.5,1.9,-.72]],.05,gold,GOLD);}
  return b.finish();
}

export class CharacterFactory {
  constructor(materials){this.materials=materials;this.cache=new Map();this.material=this.makeMaterial();}
  makeMaterial(){
    const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.7,metalness:.5,side:THREE.DoubleSide});
    m.onBeforeCompile=s=>{
      s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 surface; varying vec3 vSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=surface;');
      s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSurface;').replace('#include <roughnessmap_fragment>','float roughnessFactor=clamp(vSurface.x,0.13,0.99);').replace('#include <metalnessmap_fragment>','float metalnessFactor=vSurface.y;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSurface.z;').replace('#include <opaque_fragment>','float rim=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),2.8);\noutgoingLight += diffuseColor.rgb*.045 + vec3(.10,.14,.21)*rim;\n#include <opaque_fragment>');
    };m.customProgramCacheKey=()=> 'stormcrown-articulated-surfaces-v4';return m;
  }
  key(e){return `${e.heroId||e.bossType||e.enemyType||e.constructType||e.kind}:${e.weapon}:${e.rank||0}:${e.team}:${e.buffs?.beast?'beast':''}`;}
  create(e){
    const r=rig(e.bossType==='worldbeast'||!!e.buffs?.beast),key=this.key(e);let g=this.cache.get(key);
    if(!g){
      if(e.bossType==='rootless')g=rootlessGeometry(e,r);
      else if(e.bossType==='worldbeast'||e.buffs?.beast)g=creatureGeometry(e,r);
      else if(e.bossType==='warengine'||e.constructType==='engine'||e.constructType==='turret')g=engineGeometry(e,r);
      else g=humanoidGeometry(e,r);
      this.cache.set(key,g);
    }
    const mesh=new THREE.SkinnedMesh(g,this.material);mesh.add(r.map.root);mesh.bind(r.skeleton);mesh.castShadow=true;mesh.receiveShadow=true;mesh.boundingSphere=g.boundingSphere.clone();
    const group=new THREE.Group();group.add(mesh);
    const actor={group,mesh,...r,key,id:e.id,phase:e.animSeed||0,run:0,posed:false,pose:r.bones.map(b=>({rotation:b.quaternion.clone(),position:b.position.clone()}))};this.animate(actor,e,0,0);return actor;
  }
  animate(a,e,time,dt){
    const b=a.map,targetRun=e.moving&&!e.dead&&!(e.stun>0||e.frozen>0)?Math.min(1,(e.moveSpeed||e.speed||4)/6):0;
    a.run+=(targetRun-a.run)*(1-Math.exp(-dt*14));a.phase=(a.phase+dt*(1.8+a.run*8))%TAU;
    const phase=a.phase,run=a.run;
    for(const bone of a.bones){bone.rotation.set(0,0,0);bone.position.copy(bone.userData.rest);}
    const beast=!!e.buffs?.beast||e.bossType==='worldbeast',engine=e.bossType==='warengine'||!!e.constructType&&e.constructType!=='spirit';
    b.root.position.y=Math.sin(time*2.1+(e.animSeed||0))*.012;
    b.hips.position.y+=Math.abs(Math.sin(phase))*run*.075;b.chest.rotation.z=Math.sin(phase)*run*.055;b.chest.rotation.y=Math.sin(phase)*run*.07;
    b.spine.rotation.x=run*.09;
    b.upperL.rotation.z=.12;b.upperR.rotation.z=-.12;
    b.upperL.rotation.x=Math.sin(phase)*run*.58-.07;b.upperR.rotation.x=-Math.sin(phase)*run*.58-.1;
    b.foreL.rotation.x=-.13-run*.12;b.foreR.rotation.x=-.28-run*.12;
    for(const side of ['L','R']){const sign=side==='L'?1:-1,w=Math.sin(phase)*sign;b[`thigh${side}`].rotation.x=w*run*.64;b[`shin${side}`].rotation.x=Math.max(0,-w)*run*.92;b[`foot${side}`].rotation.x=-w*run*.15;}
    b.head.rotation.y=Math.sin(time*.7+e.id)*.04;b.neck.rotation.x=Math.sin(time*1.8)*.015;
    b.capeA.rotation.x=.10+run*.16+Math.sin(time*3+e.id)*.06;b.capeB.rotation.x=.08+Math.sin(time*3.3+e.id-.6)*.11+run*.25;b.capeC.rotation.x=Math.sin(time*3.8+e.id-1.3)*.15+run*.18;
    b.capeA.rotation.z=Math.sin(time*2.2)*.045;b.capeB.rotation.z=Math.sin(time*2.1-.7)*.09;b.capeC.rotation.z=Math.sin(time*2.2-1.4)*.12;
    if(e.weapon==='staff'){b.upperR.rotation.x=-.18;b.foreR.rotation.x=-.32;b.handR.rotation.x=Math.PI*.86;}
    else if(e.weapon==='spearshield'){b.handR.rotation.x=Math.PI*.88;b.handL.rotation.x=.2;}
    else if(e.weapon==='twinspears'){b.handR.rotation.x=2.55;b.handL.rotation.x=2.8;}
    else if(e.weapon==='hammer'){b.upperR.rotation.z=-.23;b.handR.rotation.z=-.12;}
    else if(e.weapon==='bow'){b.foreL.rotation.x=-.65;b.handL.rotation.x=Math.PI*.85;}
    if(e.blocking){b.chest.rotation.y=-.3;b.upperL.rotation.x=-1.2;b.foreL.rotation.x=-1.05;b.upperR.rotation.x=-1.0;b.foreR.rotation.x=-.55;b.handR.rotation.x=1.2;}
    if(e.action){
      const t=clamp(e.action.elapsed/e.action.duration,0,1),swing=Math.sin(t*Math.PI),kind=e.action.kind,skill=e.action.skill||e.action.move||'';
      if(['attack','heavy','ability','windup'].includes(kind)){
        const heavy=kind==='heavy'||kind==='windup',cast=kind==='ability'||['stormfield','frostfan','mirrors','crownbeam'].includes(skill);
        b.chest.rotation.y=(heavy?1.0:.7)*Math.sin(t*Math.PI*2)-(e.combo===1?.35:0);
        if(cast){b.upperR.rotation.x=-1.6*swing;b.foreR.rotation.x=-.55;b.handR.rotation.x=0;b.upperL.rotation.x=-1.2*swing;b.foreL.rotation.x=-.4;}
        else if(e.weapon==='bow'){b.upperL.rotation.x=-1.38;b.foreL.rotation.x=-.1;b.handL.rotation.x=3.05;b.upperR.rotation.x=-1.05;b.upperR.rotation.z=-.7*swing;b.foreR.rotation.x=-1.7;}
        else{b.upperR.rotation.x=-2.55*swing;b.upperR.rotation.z=-.35+Math.sin(t*TAU)*.75;b.foreR.rotation.x=-.28-swing*.7;b.handR.rotation.x=.15;b.spine.rotation.x=-.18*Math.sin(t*TAU)+(heavy?.22*swing:0);if(['hammer','gauntlets','chains','twinspears','claws'].includes(e.weapon)){b.upperL.rotation.x=-2.05*swing;b.foreL.rotation.x=-.5;b.upperL.rotation.z=.25-Math.sin(t*TAU)*.6;b.handL.rotation.x=.2;}}
      }
      if(kind==='ultimate'){
        b.upperR.rotation.x=-2.65;b.upperR.rotation.z=-.3;b.foreR.rotation.x=-.22;b.handR.rotation.x=.15;b.upperL.rotation.x=-1.7;b.upperL.rotation.z=.6;b.foreL.rotation.x=-.35;b.spine.rotation.x=-.12;b.head.rotation.x=-.3;
      }
      if(kind==='dodge'){b.hips.position.y-=.35;b.spine.rotation.x=.7;b.thighL.rotation.x=-.8;b.shinL.rotation.x=1.3;b.thighR.rotation.x=.5;b.upperL.rotation.x=.4;b.upperR.rotation.x=.4;}
    }
    if(e.frozen>0||e.stun>0){b.spine.rotation.x=.22;b.head.rotation.x=.15;b.upperL.rotation.x=.2;b.upperR.rotation.x=.4;}
    if(e.y>.3){b.spine.rotation.x=-.25;b.upperL.rotation.z=.7;b.upperR.rotation.z=-.7;b.thighL.rotation.x=-.3;b.thighR.rotation.x=.2;}
    let scale=(e.scale||1)*(e.kind==='hero'||e.kind==='figure'||e.echo?(e.height||1):1);
    if(e.buffs?.beast)scale*=1.6;
    a.group.position.set(e.x,e.y,e.z);a.group.rotation.set(0,e.angle||0,0);a.group.scale.setScalar(scale);
    if(beast){
      b.root.position.y+=run*Math.abs(Math.sin(phase))*.10;b.root.rotation.x=Math.sin(phase)*run*.04;b.root.rotation.z=Math.sin(time*2)*.025;
      for(const side of ['L','R'])for(const end of ['front','rear']){
        const name=`${end}${side}`,step=Math.sin(phase)*(side==='L'?1:-1)*(end==='front'?1:-1);
        b[name].rotation.x=step*run*.5;
        b[`${name}Knee`].rotation.x=Math.max(0,-step)*run*.85;
        b[`${name}Paw`].rotation.x=-step*run*.2;
      }
    }
    if(engine){b.chest.rotation.y=Math.sin(time*.3)*.05;b.root.position.y+=run*Math.sin(phase)*.035;}
    if(e.bossType==='saint'||e.bossType==='astra'||e.enemyType==='wisp'||e.constructType==='spirit')a.group.position.y+=.4+Math.sin(time*1.9+e.id)*.22;
    if(e.dead){const t=clamp(e.deathAge*2.3,0,1);a.group.rotation.z=(e.id%2?1:-1)*t*1.55;a.group.position.y+=t*.16;if(e.deathAge>3)a.group.scale.multiplyScalar(Math.max(.01,1-(e.deathAge-3)/3));}
    a.group.visible=!e.retired && (!e.dead||e.deathAge<6) && (!(e.invisible>0)||e.id%2===Math.floor(time*12)%2);
    // Blend back into locomotion without snapping limbs when an action finishes.
    // All presentation state stays on the actor; simulation transforms remain authoritative.
    const blend=!a.posed?1:1-Math.exp(-dt*(e.action?45:22));
    for(let i=0;i<a.bones.length;i++){const bone=a.bones[i],pose=a.pose[i];pose.rotation.slerp(bone.quaternion,blend);pose.position.lerp(bone.position,blend);bone.quaternion.copy(pose.rotation);bone.position.copy(pose.position);}
    a.posed=true;
  }
  destroy(actor){actor.group.removeFromParent();actor.skeleton.dispose();}
  dispose(){for(const g of this.cache.values())g.dispose();this.material.dispose();this.cache.clear();}
}
