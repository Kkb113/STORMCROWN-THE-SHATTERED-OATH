import { HERO_BY_ID } from '../data/heroes.js';
import { ENEMIES, BOSSES } from '../data/enemies.js';
import { REGIONS } from '../data/regions.js';
import { DIFFICULTY } from '../core/config.js';
import { heroStats } from './progression.js';

let nextId = 1;
export function resetEntityIds() { nextId = 1; }
function base(kind, team, p) {
  return {
    id:nextId++, kind, team, x:p.x, z:p.z, prevX:p.x, prevZ:p.z, y:0, vy:0, vx:0, vz:0,
    angle:Math.PI, radius:.55, hp:1, maxHp:1, damage:1, armor:0, speed:5, range:3,
    dead:false, deathAge:0, age:0, action:null, attackTimer:0, dodge:0, invulnerable:0,
    stamina:100, focus:100, maxFocus:100, judgment:0, cooldowns:[0,0,0], statuses:{}, buffs:{},
    combo:0, comboTime:0, streak:0, stagger:0, stun:0, frozen:0, hitFlash:0,
    blocking:false, parry:0, blockAge:0, shield:0, shieldTime:0, shieldHits:0,
    moving:false, moveSpeed:0, nav:null, navTime:0, think:0, targetId:null,
    knock:0, airborne:0, lastStandUsed:false, invisible:0, resource:0,
    kills:0, damageDealt:0, animSeed:(nextId*1.619)%TAU,
  };
}
const TAU = Math.PI*2;
export function makeHero(id, profile, p, slot = 0) {
  const h = HERO_BY_ID[id];
  if (!h) throw new Error(`No playable character named ${id}`);
  const stats = heroStats(profile,id), e=base('hero','party',p);
  Object.assign(e,{heroId:id,definition:h,stats,name:h.name,short:h.short,element:h.element,weapon:h.weapon,
    color:h.colorHex,height:h.height,scale:1,slot,radius:.53*h.height,
    maxHp:stats.hp,hp:stats.hp,damage:stats.damage,armor:stats.armor,speed:stats.speed,range:stats.range,
    maxFocus:stats.maxFocus,focus:stats.maxFocus,judgment:40,rank:stats.rank,phase:0,
  });
  return e;
}
export function makeEnemy(type, p, level, difficulty = 'oathkeeper', region = 0, elite = false) {
  const d=ENEMIES[type]; if (!d) throw new Error(`Unknown enemy archetype: ${type}`);
  const diff=DIFFICULTY[difficulty] || DIFFICULTY.oathkeeper, scale=1+(level-1)*.074;
  const e=base('enemy','hostile',p), factor=elite?1.65:1;
  Object.assign(e,{enemyType:type,definition:d,name:elite?`Veteran ${d.name}`:d.name,short:d.name,level,
    element:d.element==='region'?REGIONS[region].element:d.element,weapon:d.weapon,color:d.color,
    style:d.style,elite,scale:d.scale*(elite?1.1:1),height:d.scale,radius:d.radius,
    maxHp:Math.round(d.hp*scale*diff.enemyHealth*factor),damage:d.damage*scale*diff.enemyDamage*(elite?1.25:1),
    speed:d.speed*diff.aggression,range:d.range,armor:elite?.12:.04,
    attackInterval:d.cooldown/diff.aggression,windup:d.windup,spawnTime:.65,
    attackTimer:.6+((e.id*71)%100)/100,judgment:0,resurrections:0,aiMode:'approach',
  });
  e.hp=e.maxHp; return e;
}
export function makeBoss(type,p,level,difficulty='oathkeeper',region=0,modifier=1) {
  const d=BOSSES[type]; if (!d) throw new Error(`Unknown boss: ${type}`);
  const diff=DIFFICULTY[difficulty] || DIFFICULTY.oathkeeper, s=1+(level-1)*.067;
  const e=base('boss','hostile',p);
  Object.assign(e,{bossType:type,definition:d,name:d.name,short:d.name,level,element:d.element,weapon:d.weapon,
    color:d.color,style:'boss',scale:d.scale,height:d.scale,radius:Math.min(2.7,.62*d.scale),
    maxHp:Math.round(d.hp*s*diff.enemyHealth*modifier),damage:d.damage*s*diff.enemyDamage,
    speed:d.speed,range:3.2+d.scale*.7,armor:.1,phase:0,moveIndex:0,attackTimer:2.2,
    attackInterval:2.4/diff.aggression,windup:1.1,spawnTime:1.2,phaseTimer:0,
  });
  e.hp=e.maxHp; return e;
}
export function makeEcho(heroId,p,level,difficulty='oathkeeper') {
  const h=HERO_BY_ID[heroId],diff=DIFFICULTY[difficulty],s=1+(level-1)*.07;
  const e=base('boss','hostile',p);
  const stats={attackSpeed:1.1,crit:.1,power:1.2,cooldown:.8,ultimate:1.2,parryWindow:.18,focusRegen:10,maxFocus:150,rank:4,level};
  Object.assign(e,{heroId,echo:true,bossType:'echo',definition:h,stats,name:`CROWN ECHO • ${h.name.toUpperCase()}`,short:h.short,element:h.element,
    weapon:h.weapon,color:h.colorHex,style:'echo',scale:1.18,height:h.height,radius:.65,level,rank:4,
    maxHp:Math.round(h.hp*s*3.4*diff.enemyHealth),damage:h.damage*s*.72*diff.enemyDamage,
    speed:h.speed*.8,range:h.range,armor:h.armor*.7,attackTimer:1.5,attackInterval:1.2,
    focus:150,maxFocus:150,judgment:30,phase:0,spawnTime:1.1,
  });
  e.hp=e.maxHp; return e;
}
export function makeObject(kind,p,properties={}) {
  const e=base('object',kind==='device'?'hostile':'neutral',p);
  Object.assign(e,{objectType:kind,name:properties.label || kind,label:properties.label || kind,radius:.65,
    interactable:true,used:false,progress:0,state:'idle',color:0xb9a4ff,scale:1,...properties});
  if (kind==='device') {e.maxHp=properties.hp || 320;e.hp=e.maxHp;e.damageable=true;}
  return e;
}
export function makeCivilian(p,properties={}) {
  const e=base('civilian','friendly',p);
  Object.assign(e,{name:'Civilian',short:'Civilian',maxHp:600,hp:600,damage:0,speed:3.2,radius:.48,scale:.9,
    color:0xa9bdc9,weapon:'none',element:'light',following:false,interactable:true,...properties});
  return e;
}
export function makeConstruct(owner,p,kind,duration,power) {
  const e=base('construct',owner.team,p);
  Object.assign(e,{ownerId:owner.id,constructType:kind,name:kind==='engine'?'Rune Engine':kind==='spirit'?'Remembered Warrior':'Rune Sentinel',
    short:kind,element:kind==='spirit'?'spirit':'arcane',color:kind==='spirit'?0xb7c7ff:0x78baff,
    maxHp:owner.maxHp*(kind==='engine'?.7:.3),damage:owner.damage*power,range:17,
    radius:kind==='engine'?1.1:.6,scale:kind==='engine'?1.7:1,life:duration,shotTimer:.3,
    speed:kind==='spirit'?5:0,interactable:false});
  e.hp=e.maxHp; return e;
}
