// The garden's rules: the lantern, the wisps it gathers, the moths that hunt it, the
// pulse that burns them, and the dawn that ends each night. The world advances in
// fixed steps and never touches the screen; the renderer paints what is here. Every
// random choice comes from the seeded generator, so a seed replays the same garden.

import {
  DAWN_BONUS_PER_SECOND, ENERGY, FIELD, FLAMES, FLOATING_TEXT_POOL, LANTERN,
  MOTH, NIGHTS, PARTICLE_POOL, PULSE, WISP,
} from './config.js';
import { range } from './random.js';

/** Event flags a step returns, so the game can chime, shake and announce. */
export const EVENT_COLLECT = 1;
export const EVENT_ZAP = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;
export const EVENT_NIGHT = 16;
export const EVENT_WIN = 32;
export const EVENT_PULSE = 64;

/** How many wisps and moths may be loose at once. */
const MAX_WISPS = 14;
const MAX_MOTHS = 9;
/** The soft glow that drifts behind the title screen. */
const AMBIENT_COUNT = 26;

/** A wisp starts at a field edge, far from the lantern's light. */
function spawnWisp(random, lantern) {
  const edge = Math.floor(random() * 4);
  const margin = 30;
  let x = 0;
  let y = 0;
  if (edge === 0) { x = range(random, 0, FIELD.width); y = -margin; }
  else if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + margin; }
  else if (edge === 2) { x = -margin; y = range(random, 0, FIELD.height); }
  else { x = FIELD.width + margin; y = range(random, 0, FIELD.height); }
  return {
    x, y,
    angle: range(random, 0, Math.PI * 2),
    turn: range(random, -1.2, 1.2),
    speed: range(random, 0.7, 1.3) * WISP.driftSpeed,
    phase: range(random, 0, Math.PI * 2),
    drawn: false,
    // Wisps far from the lantern drift in; none starts already inside its light.
    far: Math.hypot(x - lantern.x, y - lantern.y) > LANTERN.glowRadius + 60,
  };
}

/** A moth starts at a field edge and hunts straight for the flame. */
function spawnMoth(random) {
  const edge = Math.floor(random() * 4);
  const margin = 40;
  let x = 0;
  let y = 0;
  if (edge === 0) { x = range(random, 0, FIELD.width); y = -margin; }
  else if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + margin; }
  else if (edge === 2) { x = -margin; y = range(random, 0, FIELD.height); }
  else { x = FIELD.width + margin; y = range(random, 0, FIELD.height); }
  return {
    x, y,
    phase: range(random, 0, Math.PI * 2),
    flap: range(random, 0, Math.PI * 2),
    speedJitter: range(random, 0.85, 1.15),
  };
}

/** A burst of sparks at a point, in the given colour. */
function burst(state, x, y, colour, count, speed) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= PARTICLE_POOL) state.particles.shift();
    const angle = range(state.random, 0, Math.PI * 2);
    const velocity = range(state.random, speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 20,
      life: range(state.random, 0.35, 0.8),
      maxLife: 0.8,
      size: range(state.random, 2, 4.5),
      colour,
    });
  }
}

/** A short-lived score label that floats up from a point. */
function floatText(state, x, y, text, colour) {
  if (state.texts.length >= FLOATING_TEXT_POOL) state.texts.shift();
  state.texts.push({ x, y, text, colour, life: 1.1, maxLife: 1.1 });
}

/** Build a fresh world from a seeded generator. */
export function createWorld(random) {
  const state = {
    random,
    phase: 'idle',
    night: 1,
    score: 0,
    collected: 0,
    needed: NIGHTS[0].needed,
    dawnLeft: NIGHTS[0].dawnSeconds,
    flames: FLAMES,
    energy: ENERGY.max,
    pulseCooldown: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    time: 0,
    shake: 0,
    wispTimer: 0.4,
    mothTimer: 2.2,
    lantern: { x: FIELD.width / 2, y: FIELD.height / 2 + 60, vx: 0, vy: 0, tilt: 0, invuln: 0 },
    wisps: [],
    moths: [],
    pulses: [],
    particles: [],
    texts: [],
    ambient: [],
    stats: { gathered: 0, zapped: 0, pulses: 0, nightsCleared: 0, playSeconds: 0 },
  };

  for (let i = 0; i < AMBIENT_COUNT; i += 1) {
    state.ambient.push({
      x: range(random, 0, FIELD.width),
      y: range(random, 0, FIELD.height),
      angle: range(random, 0, Math.PI * 2),
      speed: range(random, 8, 26),
      phase: range(random, 0, Math.PI * 2),
    });
  }

  /** Start over from night one with an empty garden. */
  function reset() {
    state.phase = 'idle';
    state.night = 1;
    state.score = 0;
    state.collected = 0;
    state.needed = NIGHTS[0].needed;
    state.dawnLeft = NIGHTS[0].dawnSeconds;
    state.flames = FLAMES;
    state.energy = ENERGY.max;
    state.pulseCooldown = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.time = 0;
    state.shake = 0;
    state.wispTimer = 0.4;
    state.mothTimer = 2.2;
    state.lantern.x = FIELD.width / 2;
    state.lantern.y = FIELD.height / 2 + 60;
    state.lantern.vx = 0;
    state.lantern.vy = 0;
    state.lantern.tilt = 0;
    state.lantern.invuln = 0;
    state.wisps.length = 0;
    state.moths.length = 0;
    state.pulses.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.stats.gathered = 0;
    state.stats.zapped = 0;
    state.stats.pulses = 0;
    state.stats.nightsCleared = 0;
    state.stats.playSeconds = 0;
  }

  /** Begin a night: fresh quota, fresh dawn, the lantern at the garden's heart. */
  function startNight(night) {
    const plan = NIGHTS[night - 1];
    state.night = night;
    state.needed = plan.needed;
    state.dawnLeft = plan.dawnSeconds;
    state.collected = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.wispTimer = 0.3;
    state.mothTimer = plan.mothInterval;
    state.wisps.length = 0;
    state.moths.length = 0;
    state.pulses.length = 0;
    state.lantern.x = FIELD.width / 2;
    state.lantern.y = FIELD.height / 2 + 60;
    state.lantern.vx = 0;
    state.lantern.vy = 0;
    state.lantern.invuln = 0;
    state.phase = 'play';
  }

  /** Steer the lantern: keys push, the mouse pulls, and the flame leans into the motion. */
  function moveLantern(dt, ctrl) {
    const lantern = state.lantern;
    const beforeX = lantern.x;
    const beforeY = lantern.y;
    const length = Math.hypot(ctrl.dx, ctrl.dy);
    if (length > 0) {
      lantern.x += (ctrl.dx / length) * LANTERN.keyboardSpeed * dt;
      lantern.y += (ctrl.dy / length) * LANTERN.keyboardSpeed * dt;
    } else if (ctrl.mouse) {
      const pull = 1 - Math.exp(-LANTERN.mouseEase * dt);
      lantern.x += (ctrl.mouse.x - lantern.x) * pull;
      lantern.y += (ctrl.mouse.y - lantern.y) * pull;
    }
    lantern.x = Math.min(FIELD.width - 30, Math.max(30, lantern.x));
    lantern.y = Math.min(FIELD.height - 30, Math.max(30, lantern.y));
    lantern.vx = (lantern.x - beforeX) / Math.max(dt, 0.0001);
    lantern.vy = (lantern.y - beforeY) / Math.max(dt, 0.0001);
    const targetTilt = Math.max(-0.22, Math.min(0.22, lantern.vx / 1400));
    lantern.tilt += (targetTilt - lantern.tilt) * Math.min(1, dt * 10);
    if (lantern.invuln > 0) lantern.invuln -= dt;
  }

  /** Fire the pulse when the player asks and the lantern can pay for it. */
  function tryPulse(ctrl) {
    if (!ctrl.pulse) return 0;
    if (state.pulseCooldown > 0 || state.energy < PULSE.cost) return 0;
    state.energy -= PULSE.cost;
    state.pulseCooldown = PULSE.cooldown;
    state.pulses.push({ age: 0 });
    state.stats.pulses += 1;
    return EVENT_PULSE;
  }

  /** Wisps drift, are drawn into the light, and are gathered when they reach it. */
  function updateWisps(dt) {
    const lantern = state.lantern;
    let events = 0;
    state.wispTimer -= dt;
    if (state.wispTimer <= 0 && state.wisps.length < MAX_WISPS) {
      state.wisps.push(spawnWisp(state.random, lantern));
      state.wispTimer = WISP.spawnInterval * range(state.random, 0.75, 1.25);
    }
    for (let i = state.wisps.length - 1; i >= 0; i -= 1) {
      const wisp = state.wisps[i];
      const dx = lantern.x - wisp.x;
      const dy = lantern.y - wisp.y;
      const distance = Math.hypot(dx, dy);
      if (!wisp.drawn && distance < LANTERN.glowRadius) wisp.drawn = true;
      if (wisp.drawn) {
        const speed = WISP.drawSpeed * (1 + (1 - distance / LANTERN.glowRadius) * 0.6);
        wisp.x += (dx / Math.max(distance, 1)) * speed * dt;
        wisp.y += (dy / Math.max(distance, 1)) * speed * dt;
      } else {
        wisp.angle += wisp.turn * dt;
        wisp.x += Math.cos(wisp.angle) * wisp.speed * dt;
        wisp.y += Math.sin(wisp.angle) * wisp.speed * dt + Math.sin(state.time * 2 + wisp.phase) * 12 * dt;
      }
      if (wisp.x < -50 || wisp.x > FIELD.width + 50 || wisp.y < -50 || wisp.y > FIELD.height + 50) {
        state.wisps.splice(i, 1);
        continue;
      }
      if (distance < LANTERN.gatherRadius) {
        state.wisps.splice(i, 1);
        state.combo = state.comboTimer > 0 ? Math.min(state.combo + 1, WISP.maxCombo) : 1;
        state.comboTimer = WISP.comboWindow;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        const points = WISP.points * state.combo;
        state.score += points;
        state.collected += 1;
        state.stats.gathered += 1;
        burst(state, wisp.x, wisp.y, '#ffd94d', 10, 130);
        floatText(state, wisp.x, wisp.y - 12, state.combo > 1 ? `+${points} x${state.combo}` : `+${points}`, '#ffe9a8');
        events |= EVENT_COLLECT;
      }
    }
    return events;
  }

  /** Moths hunt the flame, wobbling as they close in; the pulse burns them. */
  function updateMoths(dt) {
    const lantern = state.lantern;
    const plan = NIGHTS[state.night - 1];
    let events = 0;
    state.mothTimer -= dt;
    if (state.mothTimer <= 0 && state.moths.length < Math.min(MAX_MOTHS, 3 + state.night)) {
      state.moths.push(spawnMoth(state.random));
      state.mothTimer = plan.mothInterval * range(state.random, 0.8, 1.25);
    }
    for (let i = state.moths.length - 1; i >= 0; i -= 1) {
      const moth = state.moths[i];
      moth.flap += dt * 14;
      const dx = lantern.x - moth.x;
      const dy = lantern.y - moth.y;
      const distance = Math.hypot(dx, dy);
      const speed = plan.mothSpeed * moth.speedJitter;
      const wobble = Math.sin(state.time * MOTH.wobble + moth.phase) * 46;
      const nx = dx / Math.max(distance, 1);
      const ny = dy / Math.max(distance, 1);
      moth.x += (nx * speed - ny * wobble * 0.3) * dt;
      moth.y += (ny * speed + nx * wobble * 0.3) * dt;
      // A live pulse burns any moth its light has reached.
      let burned = false;
      for (const pulse of state.pulses) {
        const radius = PULSE.maxRadius * Math.min(1, pulse.age / PULSE.expandSeconds);
        if (Math.hypot(moth.x - lantern.x, moth.y - lantern.y) < radius) { burned = true; break; }
      }
      if (burned) {
        state.moths.splice(i, 1);
        state.score += PULSE.mothPoints;
        state.stats.zapped += 1;
        burst(state, moth.x, moth.y, '#b9a8e8', 12, 160);
        floatText(state, moth.x, moth.y - 12, `+${PULSE.mothPoints}`, '#d8ccff');
        events |= EVENT_ZAP;
        continue;
      }
      if (distance < LANTERN.radius + MOTH.radius && lantern.invuln <= 0) {
        state.moths.splice(i, 1);
        state.flames -= 1;
        lantern.invuln = LANTERN.invulnerable;
        state.shake = 1;
        state.combo = 0;
        state.comboTimer = 0;
        burst(state, lantern.x, lantern.y, '#ff6b6b', 16, 200);
        events |= EVENT_HIT;
        if (state.flames <= 0) {
          state.phase = 'over';
          events |= EVENT_OVER;
        }
      }
    }
    return events;
  }

  /** Pulses expand, fade, and are spent. */
  function updatePulses(dt) {
    for (let i = state.pulses.length - 1; i >= 0; i -= 1) {
      state.pulses[i].age += dt;
      if (state.pulses[i].age > PULSE.expandSeconds + PULSE.fadeSeconds) state.pulses.splice(i, 1);
    }
  }

  /** Sparks fade and drift; labels float up and fade. */
  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 60 * dt;
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const text = state.texts[i];
      text.y -= 34 * dt;
      text.life -= dt;
      if (text.life <= 0) state.texts.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
  }

  /** The title screen's drifting glow: wisps that never gather, just wander. */
  function updateAmbient(dt) {
    for (const mote of state.ambient) {
      mote.angle += Math.sin(state.time * 0.4 + mote.phase) * 0.5 * dt;
      mote.x += Math.cos(mote.angle) * mote.speed * dt;
      mote.y += Math.sin(mote.angle) * mote.speed * dt;
      if (mote.x < -20) mote.x = FIELD.width + 20;
      if (mote.x > FIELD.width + 20) mote.x = -20;
      if (mote.y < -20) mote.y = FIELD.height + 20;
      if (mote.y > FIELD.height + 20) mote.y = -20;
    }
  }

  /**
   * Advance the world one fixed step. `ctrl` carries the frame's steering and pulse;
   * on the title screen the garden only drifts. Returns event flags for the step.
   */
  function step(dt, ctrl) {
    state.time += dt;
    updateAmbient(dt);
    updateParticles(dt);
    if (state.phase !== 'play') return 0;
    state.stats.playSeconds += dt;
    let events = 0;
    if (state.pulseCooldown > 0) state.pulseCooldown -= dt;
    if (state.energy < ENERGY.max) state.energy = Math.min(ENERGY.max, state.energy + ENERGY.regenPerSecond * dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    moveLantern(dt, ctrl);
    events |= tryPulse(ctrl);
    events |= updateWisps(dt);
    events |= updateMoths(dt);
    updatePulses(dt);
    if (state.phase === 'over') return events | EVENT_OVER;
    state.dawnLeft -= dt;
    if (state.collected >= state.needed) {
      const bonus = Math.ceil(Math.max(0, state.dawnLeft)) * DAWN_BONUS_PER_SECOND;
      state.score += bonus;
      state.stats.nightsCleared += 1;
      if (state.night >= NIGHTS.length) {
        state.phase = 'won';
        return events | EVENT_WIN;
      }
      state.phase = 'nightclear';
      state.dawnBonus = bonus;
      return events | EVENT_NIGHT;
    }
    if (state.dawnLeft <= 0) {
      state.phase = 'over';
      return events | EVENT_OVER;
    }
    return events;
  }

  return { state, reset, startNight, step };
}
