import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, EMPTY_INPUT } from '../src/game/simulation.js';
import { createProfile } from '../src/game/progression.js';
import { CAMPAIGN } from '../src/data/campaign.js';

function fixture(t) {
  const sim = new Simulation(createProfile(), CAMPAIGN[0]);
  sim.director.update = () => {};
  sim.ai.enemies = () => {};
  sim.ai.companions = () => {};
  Object.assign(sim.activeHero, {x:0, z:0, angle:0});
  t.after(() => sim.dispose());
  return sim;
}
const input = (sim, value = {}) => sim.updatePlayer(1/60, {...EMPTY_INPUT, ...value});
function enemy(sim, type = 'legionary', point = {x:0, z:2}) {
  const e = sim.spawnEnemy(type, point);
  Object.assign(e, {spawnTime:0, hp:1000, maxHp:1000, attackTimer:0});
  return e;
}

test('a released guard tap retains its perfect-parry window', t => {
  const sim = fixture(t), h = sim.activeHero, foe = enemy(sim), hp = h.hp;
  input(sim, {guardPressed:true});
  sim.combat.updateEntity(h, .05);
  input(sim);
  sim.combat.damage(foe, h, 40, {parryable:true});
  assert.equal(sim.stats.parries, 1);
  assert.equal(h.hp, hp);
  sim.combat.updateEntity(h, .25);
  input(sim);
  assert.equal(h.blocking, false);
});

test('a guard tap during the end of a dodge is buffered until recovery', t => {
  const sim = fixture(t), h = sim.activeHero;
  sim.combat.dodge(h, {x:1, z:0});
  sim.combat.updateEntity(h, .28);
  input(sim, {guardPressed:true});
  for(let i=0; i<5; i++) { sim.combat.updateEntity(h, 1/60); input(sim); }
  assert.ok(h.parry > 0);
  assert.equal(h.blocking, true);
});

test('held attack does not cancel a newly pressed guard', t => {
  const sim = fixture(t), h = sim.activeHero;
  input(sim, {attack:true, guardPressed:true, guard:true});
  assert.equal(h.blocking, true);
  assert.ok(h.parry > 0);
  assert.notEqual(h.action?.kind, 'attack');
});

test('a heavy attack must pay its stamina cost before changing combat state', t => {
  const sim = fixture(t), h = sim.activeHero;
  h.stamina = 7;
  assert.equal(sim.combat.attack(h, true), false);
  assert.equal(h.stamina, 7);
  assert.equal(h.action, null);
  assert.equal(sim.tasks.length, 0);
  h.stamina = 8;
  assert.equal(sim.combat.attack(h, true), true);
  assert.equal(h.stamina, 0);
});

for(const type of ['reaver', 'legionary']) test(`${type} windup cannot hit after being staggered`, t => {
  const sim = fixture(t), h = sim.activeHero, foe = enemy(sim, type), hp = h.hp;
  sim.ai.strike(foe, h);
  sim.combat.damage(h, foe, 1, {stagger:100, noReaction:true});
  assert.equal(foe.action, null);
  sim.updateTasks(1.1);
  sim.updateHazards(1.1);
  assert.equal(sim.projectiles.length, 0);
  assert.equal(h.hp, hp);
});

test('a staggered heavy cannot return after the stun has expired', t => {
  const sim = fixture(t), h = sim.activeHero, foe = enemy(sim), hp = foe.hp;
  assert.equal(sim.combat.attack(h, true), true);
  sim.combat.damage(foe, h, 1, {stagger:100, noReaction:true});
  sim.combat.updateEntity(h, 1.2);
  sim.updateTasks(1.2);
  assert.equal(foe.hp, hp);
});

test('remedy clears a fallen hero’s movement, guard and harmful status state', t => {
  const sim = fixture(t), h = sim.party[1];
  Object.assign(h, {stun:3, frozen:2, dodge:.3, dodgeX:1, dodgeZ:0, vx:8, vz:-4, vy:6, y:2,
    airborne:1, blocking:true, parry:.2, pull:{x:10, z:10, time:1}});
  h.statuses = {fire:4, root:3};
  sim.combat.kill(sim.environment, h);
  assert.equal(sim.combat.remedy(), true);
  assert.equal(h.dead, false);
  assert.ok(sim.combat.available(h));
  assert.deepEqual(h.statuses, {});
  assert.equal(h.vx + h.vz + h.vy + h.y, 0);
  assert.equal(h.pull, null);
  assert.equal(h.blocking, false);
  assert.equal(h.parry, 0);
  assert.ok(sim.world.isWalkable(h, h.radius));
});

test('a delayed ability is canceled across death and immediate revival', t => {
  const sim = fixture(t), h = sim.activeHero, foe = enemy(sim), hp = foe.hp;
  let persisted = 0;
  assert.equal(sim.abilities.cast(h, 1), true);
  sim.schedule(.1, () => persisted++, h.id, true);
  sim.combat.kill(sim.environment, h);
  sim.combat.remedy();
  sim.updateTasks(.5);
  assert.equal(foe.hp, hp);
  assert.equal(persisted, 1, 'explicitly persistent callbacks retain their contract');
});

test('switching away and back before the next tick clears buffered commands', t => {
  const sim = fixture(t), h = sim.activeHero;
  h.cooldowns[1] = .1;
  input(sim, {skill2:true, moveX:1});
  assert.equal(sim.player.pending.has('skill2'), true);
  sim.switchParty(1);
  sim.switchParty(0);
  assert.equal(sim.player.pending.size, 0);
  assert.equal(sim.player.vx, 0);
  h.cooldowns[1] = 0;
  input(sim);
  assert.equal(h.cooldowns[1], 0);
});

test('assuming an oath anchor clears disabling state before its required cast', t => {
  const sim = fixture(t), h = sim.activeHero;
  Object.assign(h, {stun:4, frozen:3, dodge:.2, vx:8, vz:2, pull:{x:10,z:0,time:1}});
  h.statuses.root = 3;
  sim.assumeAnchor(h.heroId, {x:0,z:0});
  assert.equal(sim.abilities.cast(h, 0), true);
  assert.deepEqual(h.statuses, {});
  assert.equal(h.vx + h.vz, 0);
  assert.equal(h.pull, null);
});

test('an interaction changing the active hero cannot move the retired hero afterward', t => {
  const sim = fixture(t), old = sim.activeHero;
  sim.director.interact = () => sim.assumeAnchor('nym', {x:0,z:0});
  input(sim, {interact:true, moveX:1, attack:true});
  assert.equal(sim.activeHero.heroId, 'nym');
  assert.equal(old.retired, true);
  assert.equal(old.x, 0);
  assert.equal(old.z, 0);
  assert.equal(old.action, null);
});

test('a dodged pinning projectile cannot apply stun or knockback', t => {
  const sim = fixture(t), h = sim.activeHero, foe = enemy(sim, 'reaver', {x:0,z:3}), hp = h.hp;
  h.invulnerable = .5;
  sim.projectile(foe, {angle:Math.PI, speed:30, range:10, pin:true});
  sim.updateProjectiles(.1);
  assert.equal(h.hp, hp);
  assert.equal(h.stun, 0);
  assert.equal(h.vx, 0);
  assert.equal(h.vz, 0);
});

test('moving hazards follow the velocity supplied by the stormwall boss move', t => {
  const sim = fixture(t), boss = sim.spawnBoss('lucen', {x:0,z:-8});
  sim.bosses.stormwall(boss, sim.activeHero, sim.world.rooms[0]);
  const wall = sim.hazards[0], start = wall.x;
  sim.updateHazards(1.35);
  const activeX = wall.x;
  sim.updateHazards(.25);
  assert.ok(wall.x > start);
  assert.ok(Math.abs(wall.x - activeX - .8) < 1e-8);
});
