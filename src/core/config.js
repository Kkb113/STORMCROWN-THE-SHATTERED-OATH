export const VERSION = '1.0.0';
export const SAVE_VERSION = 3;
export const SETTINGS_KEY = 'stormcrown.settings.v1';
export const SETTINGS_DEFAULTS = Object.freeze({
  quality: 'high', resolution: 1, adaptive: true, shadows: true, bloom: true,
  ao: false, particles: 1, shake: 0.65, flashes: 0.6, music: 0.55, effects: 0.8,
  master: 0.8, textSize: 1, damageNumbers: true, autoAim: true, subtitles: true,
  fps: false, cameraZoom: 1, difficulty: 'oathkeeper', tutorial: true, gamepad: true,
});
export const QUALITY = {
  low: { pixelRatio: 1, shadowSize: 1024, bloom: false, particles: 0.4, scenery: 0.6, far: 110 },
  medium: { pixelRatio: 1.2, shadowSize: 1536, bloom: true, particles: 0.65, scenery: 0.8, far: 150 },
  high: { pixelRatio: 1.5, shadowSize: 2048, bloom: true, particles: 1, scenery: 1, far: 190 },
  ultra: { pixelRatio: 2, shadowSize: 4096, bloom: true, particles: 1.4, scenery: 1.25, far: 230 },
};
export const DIFFICULTY = {
  story: { name: 'Storyteller', enemyHealth: 0.7, enemyDamage: 0.48, aggression: 0.8, parryWindow: 0.3, description: 'A forgiving journey. The story remains unchanged.' },
  oathkeeper: { name: 'Oathkeeper', enemyHealth: 1, enemyDamage: 1, aggression: 1, parryWindow: 0.2, description: 'The intended balance of spectacle and consequence.' },
  tempest: { name: 'Tempest', enemyHealth: 1.28, enemyDamage: 1.45, aggression: 1.18, parryWindow: 0.16, description: 'Enemy formations punish hesitation. Every switch matters.' },
  crownfall: { name: 'Crownfall', enemyHealth: 1.65, enemyDamage: 1.9, aggression: 1.35, parryWindow: 0.14, description: 'For those who have already defied the sky.' },
};
export function loadSettings(storage = globalThis.localStorage) {
  try { return sanitizeSettings({ ...SETTINGS_DEFAULTS, ...JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') }); }
  catch { return { ...SETTINGS_DEFAULTS }; }
}
export function sanitizeSettings(value) {
  const out = { ...SETTINGS_DEFAULTS };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'boolean') out[k] = typeof value[k] === 'boolean' ? value[k] : out[k];
    else if (typeof out[k] === 'number') out[k] = Number.isFinite(value[k]) ? Math.max(0, Math.min(2, value[k])) : out[k];
    else if (typeof value[k] === 'string') out[k] = value[k];
  }
  if (!QUALITY[out.quality]) out.quality = 'high';
  if (!DIFFICULTY[out.difficulty]) out.difficulty = 'oathkeeper';
  out.resolution = Math.max(0.5, Math.min(1.5, out.resolution));
  out.textSize = Math.max(0.8, Math.min(1.4, out.textSize));
  out.cameraZoom = Math.max(0.7, Math.min(1.5, out.cameraZoom));
  return out;
}
export function storeSettings(settings, storage = globalThis.localStorage) {
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings))); return true; } catch { return false; }
}
