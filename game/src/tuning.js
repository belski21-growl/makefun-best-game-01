// ASHEN HOLLOW — every tuning number in one place, so the game can be retuned
// without touching the rules. Palette: a near-black rogue world lit only by
// blood-red embers and bone-white text — dark, not bright.

export const VIEW_W = 960;
export const VIEW_H = 540;
export const TILE = 32;
export const STEP = 1 / 60;
export const BEST_KEY = 'ashenhollow-best-v1';
export const SAVE_KEY = 'ashenhollow-save-v1';

/** Milliseconds to glide one tile on the overworld. */
export const MOVE_MS = 150;
/** Steps of wild walking before the next random encounter can roll. */
export const ENCOUNTER_MIN_STEPS = 12;
export const ENCOUNTER_MAX_STEPS = 22;
/** Chance a field battle lets the party run away. */
export const RUN_CHANCE = 0.7;
/** Battle animation speed multipliers, toggled with 1 / 2. */
export const SPEEDS = [1, 2];

export const PALETTE = {
  night: '#07050d',
  nightDeep: '#030207',
  panel: '#0d0a14',
  panelEdge: '#5a1f2b',
  ink: '#e8ddc8',
  inkDim: '#9a8a72',
  gold: '#e8a33d',
  ember: '#ff5a2a',
  emberDeep: '#8a1a1a',
  leaf: '#1d3a24',
  leafDark: '#0d1f12',
  leafLight: '#2d5a34',
  path: '#4a3826',
  pathDark: '#2e2318',
  water: '#1a3a4a',
  waterDark: '#0e2233',
  waterLight: '#2a5a6a',
  roof: '#5a1f24',
  roofDark: '#3a1418',
  wall: '#4a4038',
  hp: '#58a83a',
  hpLow: '#ff3a2a',
  mp: '#7a6ac8',
  xp: '#e8a33d',
  shadow: '#14101f',
  foe: '#6a2a5a',
};

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
