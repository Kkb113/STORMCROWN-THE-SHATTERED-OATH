import { clamp, angleDelta } from '../core/math.js';
const AXES = [['x','prevX'], ['y','prevY'], ['z','prevZ']];

/** Interpolate presentation between fixed ticks without changing collision state.
 * Callers can reuse out to avoid allocating an object for every actor/frame. */
export function displayPose(entity, alpha = 1, out = {}) {
  const t = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : 1;
  for (const [field, previous] of AXES) {
    const current = entity[field] || 0;
    const from = Number.isFinite(entity[previous]) ? entity[previous] : current;
    out[field] = from + (current - from) * t;
  }
  const angle = entity.angle || 0;
  const previous = Number.isFinite(entity.prevAngle) ? entity.prevAngle : angle;
  out.angle = previous + angleDelta(previous, angle) * t;
  return out;
}
