import { normalize2, distance, angleTo, moveAngle } from '../core/math.js';

export const INPUT_BUFFER_SECONDS = .16;
const YAW = .64, COS = Math.cos(YAW), SIN = Math.sin(YAW);
const COMMANDS = ['attack', 'heavy', 'dodge', 'skill1', 'skill2', 'ultimate', 'guardPressed'];

/** Screen-relative motion and short, bounded combat buffering. The controller
 * owns movement velocity, not knockback velocity. All displacement is swept by
 * WorldMap; neither a dash nor its recovery can skip collision checks. */
export class PlayerController {
  constructor(sim) { this.sim = sim; this.reset(); }
  reset() { this.pending = new Map(); this.heroId = null; this.vx = 0; this.vz = 0; }
  capture(input, dt) {
    for (const [key, left] of this.pending) {
      if (left <= dt) this.pending.delete(key);
      else this.pending.set(key, left - dt);
    }
    for (const key of COMMANDS) if (input[key]) this.pending.set(key, INPUT_BUFFER_SECONDS);
  }
  update(dt, input) {
    const sim = this.sim;
    if (input.switchTo !== null && input.switchTo !== undefined) sim.switchParty(input.switchTo);
    const e = sim.activeHero;
    if (!e || e.dead) { this.reset(); return; }
    if (this.heroId !== e.id) { this.reset(); this.heroId = e.id; }
    this.capture(input, dt);
    e.moving = false;
    const x = Number.isFinite(input.moveX) ? input.moveX : 0;
    const y = Number.isFinite(input.moveY) ? input.moveY : 0;
    const strength = Math.min(1, Math.hypot(x, y)), raw = normalize2(x, y);
    const dir = { x: (raw.x * COS + raw.z * SIN) * strength, z: (-raw.x * SIN + raw.z * COS) * strength };
    let aim = input.aim && Number.isFinite(input.aim.x) && Number.isFinite(input.aim.z) ? input.aim : null;
    const target = sim.nearestTarget(e, Math.max(e.range + 3, 11));
    if (sim.autoAim && target && (!aim || distance(aim, e) < 2 || distance(aim, target) < 5.5)) aim = target;
    const aiming = ['attack','heavy','skill1','skill2','ultimate'].some(key => this.pending.has(key)) || input.guard;
    if (aim && aiming) e.angle = moveAngle(e.angle, angleTo(e, aim), dt * 32);
    else if (strength > .05) e.angle = moveAngle(e.angle, Math.atan2(dir.x, dir.z), dt * 18);

    const guarded = this.pending.has('guardPressed') && sim.combat.available(e);
    sim.combat.guard(e, guarded, !!input.guard);
    if (guarded || !input.guard) this.pending.delete('guardPressed');
    if (this.pending.has('dodge') && sim.combat.dodge(e, dir)) {
      this.pending.delete('dodge'); this.vx = this.vz = 0;
      e.flow = 1;
    }
    // A successful dodge's final recovery can flow into an attack. The evade
    // window is shortened as well, so this cannot grant an invulnerable combo.
    if (e.dodge > 0 && e.dodge <= .10 && (this.pending.has('attack') || this.pending.has('heavy'))) {
      e.dodge = 0; e.action = null; e.attackTimer = 0;
      e.invulnerable = Math.min(e.invulnerable, .08);
    }
    for (const [key, slot] of [['ultimate',2], ['skill1',0], ['skill2',1]]) {
      if (!this.pending.has(key)) continue;
      // Long cooldowns are not repeatedly retried; show their normal feedback
      // once. Only an almost-ready ability stays in the short input buffer.
      if (e.cooldowns[slot] > INPUT_BUFFER_SECONDS && sim.combat.available(e)) {
        sim.abilities.cast(e, slot, aim); this.pending.delete(key); continue;
      }
      if (e.cooldowns[slot] > 0 || !sim.combat.available(e) || e.action?.kind === 'ultimate') continue;
      const ok = sim.abilities.cast(e, slot, aim);
      this.pending.delete(key);
      if (ok) break;
    }
    if (input.bond) sim.abilities.bond();
    if (input.remedy) sim.combat.remedy();
    if (input.interact) sim.director.interact();
    if (!sim.world.isHub) {
      const key = this.pending.has('heavy') ? 'heavy' : this.pending.has('attack') ? 'attack' : null;
      if (key && sim.combat.attack(e, key === 'heavy', aim ? angleTo(e, aim) : null)) this.pending.delete(key);
    }
    e.flow = Math.max(0, (e.flow || 0) - dt);
    if (!sim.combat.available(e) || e.y >= 1.2 || e.statuses.root > 0) { this.vx = this.vz = 0; e.moveSpeed = 0; return; }
    const actionScale = !e.action ? 1 : e.action.kind === 'ultimate' ? .12 : e.action.kind === 'heavy' ? .35 : .72;
    const speed = e.speed * actionScale * (e.blocking ? .45 : 1) * (e.statuses.frost > 0 ? .58 : 1)
      * (e.buffs.haste ? 1.3 : 1) * (e.buffs.beast ? 1.18 : 1) * (1 + .12 * e.flow);
    // 90% of commanded speed in roughly 60 ms; faster braking prevents skating.
    const blend = 1 - Math.exp(-dt * (strength > .05 ? 38 : 55));
    this.vx += (dir.x * speed - this.vx) * blend;
    this.vz += (dir.z * speed - this.vz) * blend;
    if (strength < .05 && Math.hypot(this.vx, this.vz) < .05) this.vx = this.vz = 0;
    const beforeX = e.x, beforeZ = e.z;
    sim.world.move(e, this.vx * dt, this.vz * dt);
    const movedX = e.x - beforeX, movedZ = e.z - beforeZ;
    if (Math.abs(movedX) < Math.abs(this.vx * dt) * .2) this.vx = 0;
    if (Math.abs(movedZ) < Math.abs(this.vz * dt) * .2) this.vz = 0;
    e.moveSpeed = Math.hypot(movedX, movedZ) / Math.max(.001, dt);
    e.moving = e.moveSpeed > .1;
  }
}
