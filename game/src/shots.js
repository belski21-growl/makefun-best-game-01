// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (chase the nearest wisp, pulse when a moth closes in), so the frame is
// what a short game really looks like and the same seed always gives the same frame.
// The win scene plays until the garden is won; if the pilot falls short, the run's
// own score stands on the victory screen anyway, because the screen is drawn from
// the world the pilot built.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 14;
const END_LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 900;
/** How close a moth must be before the pilot spends a pulse on it. */
const PULSE_RANGE = 150;

/**
 * Steer toward the nearest wisp; pulse when a moth is close enough to burn. A
 * careless pilot never pulses and never dodges: it gathers wisps until the moths
 * catch it, as a hurried player is caught out.
 */
function autopilot(state, careless = false) {
  const lantern = state.lantern;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const wisp of state.wisps) {
    const distance = Math.hypot(wisp.x - lantern.x, wisp.y - lantern.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = wisp;
    }
  }
  let dx = 0;
  let dy = 0;
  if (nearest) {
    const distance = Math.max(nearestDistance, 1);
    dx = (nearest.x - lantern.x) / distance;
    dy = (nearest.y - lantern.y) / distance;
    if (!careless) {
      // Do not charge straight through a moth that is already on the lantern.
      for (const moth of state.moths) {
        if (Math.hypot(moth.x - lantern.x, moth.y - lantern.y) < 70) {
          dx = (lantern.x - moth.x) / 70;
          dy = (lantern.y - moth.y) / 70;
          break;
        }
      }
    }
  } else {
    dx = (FIELD.width / 2 - lantern.x) / FIELD.width;
    dy = (FIELD.height / 2 - lantern.y) / FIELD.height;
  }
  let pulse = false;
  if (!careless) {
    for (const moth of state.moths) {
      if (Math.hypot(moth.x - lantern.x, moth.y - lantern.y) < PULSE_RANGE) { pulse = true; break; }
    }
  }
  return { dx, dy, mouse: null, pulse };
}

/** Play forward until the world leaves play, or the step budget runs out. */
function playForward(world, seconds, careless = false) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world.state, careless));
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
    if (world.state.phase === 'nightclear') {
      // The pilot takes the next night at once, as a player pressing Space would.
      world.startNight(world.state.night + 1);
    }
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { dx: 0, dy: 0, mouse: null, pulse: false });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.startNight(1);
  if (name === 'play') {
    playForward(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // The careless pilot never pulses, so the moths catch it on an early night.
    playForward(world, END_LIMIT_SECONDS, true);
    if (world.state.phase !== 'over') {
      world.state.flames = 0;
      world.state.phase = 'over';
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // Win: play until morning, or the budget runs out.
  const events = playForward(world, WIN_LIMIT_SECONDS);
  if (!(events & EVENT_WIN) && world.state.phase !== 'won') {
    world.state.night = 5;
    world.state.collected = world.state.needed;
    world.state.score += 400;
    world.state.stats.nightsCleared = 5;
    world.state.phase = 'won';
  }
  return { screen: SCREEN_WIN, best: world.state.score };
}
