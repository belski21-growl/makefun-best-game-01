// Wispkeeper — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. You are the Wispkeeper: carry a living lantern through a night
// garden, guide golden wisps into its light before dawn, and keep the shadow moths
// from snuffing your flame.

/** The playfield, in logical pixels. */
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The lantern you carry: how fast it steers, how far its light reaches, how close a
 *  wisp must come to be gathered, and how long it is untouchable after a moth strike. */
export const LANTERN = {
  radius: 26,
  keyboardSpeed: 460,
  mouseEase: 7.5,
  glowRadius: 165,
  gatherRadius: 30,
  invulnerable: 1.4,
};

/** The pulse: a burst of light that burns moths. It costs energy, recharges over time,
 *  and can only be fired again once its cooldown has run out. */
export const PULSE = {
  cost: 26,
  cooldown: 1.1,
  maxRadius: 185,
  expandSeconds: 0.32,
  fadeSeconds: 0.25,
  mothPoints: 25,
};

/** Energy the pulse spends, and how fast it comes back. */
export const ENERGY = { max: 100, regenPerSecond: 13 };

/** How many flames the lantern holds: three moth strikes snuff it out. */
export const FLAMES = 3;

/** A wisp: how it drifts, how fast it is drawn into the light, and what it is worth. */
export const WISP = {
  radius: 9,
  driftSpeed: 42,
  drawSpeed: 260,
  spawnInterval: 0.9,
  points: 10,
  comboWindow: 2.6,
  maxCombo: 5,
};

/** A shadow moth: how fast it hunts, how much it wobbles, and how often it appears. */
export const MOTH = {
  radius: 15,
  baseSpeed: 92,
  speedPerNight: 16,
  wobble: 1.9,
  spawnInterval: 2.7,
  spawnScale: 0.86,
  minSpawnInterval: 1.15,
};

/** One night of the garden: how many wisps the lantern must gather before dawn, how
 *  long until dawn breaks, and how bold the moths are. Five nights, then morning. */
export const NIGHTS = [
  { needed: 12, dawnSeconds: 78, mothInterval: 2.7, mothSpeed: 92 },
  { needed: 16, dawnSeconds: 74, mothInterval: 2.3, mothSpeed: 104 },
  { needed: 20, dawnSeconds: 70, mothInterval: 1.9, mothSpeed: 118 },
  { needed: 24, dawnSeconds: 66, mothInterval: 1.6, mothSpeed: 132 },
  { needed: 28, dawnSeconds: 62, mothInterval: 1.35, mothSpeed: 148 },
];

/** Points for finishing a night with dawn still to spare, per second left. */
export const DAWN_BONUS_PER_SECOND = 8;

/** How many sparks, embers and motes can exist at once; the pools are allocated once. */
export const PARTICLE_POOL = 240;
export const FLOATING_TEXT_POOL = 16;

/** The garden's palette: deep indigo night, warm lantern amber, wisp gold, moth violet. */
export const PALETTE = {
  skyTop: '#0a0e24',
  skyBottom: '#1a2340',
  horizon: '#232c52',
  ground: '#10182e',
  grass: '#1d3a2a',
  grassLight: '#2a5238',
  flower: '#e78fb3',
  flowerAlt: '#8fd3e7',
  moon: '#f4ead0',
  moonGlow: '#f4ead0',
  lanternBrass: '#c98f2e',
  lanternGlass: '#ffd98a',
  flame: '#ffb347',
  flameCore: '#fff3c4',
  wisp: '#ffd94d',
  wispCore: '#fff7cc',
  moth: '#8b7fb8',
  mothWing: '#6b5f9e',
  mothEye: '#ff6b6b',
  pulse: '#ffe9a8',
  panel: '#141a30',
  panelEdge: '#3a4a7a',
  text: '#f2ecdc',
  muted: '#9aa5c8',
  danger: '#ff6b6b',
  good: '#7fe0a8',
};

/** The typeface for every word the game draws. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'wispkeeper.best';
