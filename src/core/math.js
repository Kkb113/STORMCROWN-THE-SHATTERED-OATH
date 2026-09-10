/** Deterministic, rendering-independent math used by simulation and tests. */
export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const distance = (a, b) => Math.sqrt(dist2(a, b));
export const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const angleDelta = (a, b) => ((b - a + Math.PI * 3) % TAU) - Math.PI;
export const moveAngle = (a, b, speed) => a + clamp(angleDelta(a, b), -speed, speed);
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
export function random(seed = 1) {
  let s = typeof seed === 'string' ? hashString(seed) : seed;
  const fn = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  fn.int = (min, max) => Math.floor(fn() * (max - min + 1)) + min;
  fn.range = (min, max) => min + fn() * (max - min);
  fn.pick = a => a[Math.floor(fn() * a.length)];
  return fn;
}
export function normalize2(x, z) { const l = Math.hypot(x, z); return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 }; }
export function segmentDistanceSq(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return (p.x - a.x - t * dx) ** 2 + (p.z - a.z - t * dz) ** 2;
}
export function shuffle(array, rng = Math.random) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function safeText(text) { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
