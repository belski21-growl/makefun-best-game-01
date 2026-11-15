// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, night cleared, game
// over and victory.
//
// ?seed=N fixes the garden's pattern. ?shot=start|play|end|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_COLLECT, EVENT_HIT, EVENT_NIGHT, EVENT_OVER, EVENT_PULSE, EVENT_WIN, EVENT_ZAP } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PULSE, createInput } from './input.js';
import { createRenderer, SCREEN_NIGHT, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSoundBank } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sounds = createSoundBank();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.startNight(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Night 1. Gather ${world.state.needed} wisps before dawn.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Morning breaks. You won with ${world.state.score} points. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  /** Handle one frame's actions; returns the actions still live for the step (a
   *  confirm that starts the game eats its own pulse, so the first frame is free). */
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = sounds.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      sounds.unlock();
      sounds.click();
      startGame();
      return actions & ~ACTION_PULSE;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_NIGHT) {
      sounds.unlock();
      sounds.click();
      world.startNight(world.state.night + 1);
      screen = SCREEN_PLAY;
      announce(`Night ${world.state.night}. Gather ${world.state.needed} wisps before dawn.`);
      return actions & ~ACTION_PULSE;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, mouse: null, pulse: false });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const direction = input.direction();
    const mouse = input.mouse();
    const events = world.step(STEP, {
      dx: direction.x,
      dy: direction.y,
      mouse,
      pulse: Boolean(actions & ACTION_PULSE),
    });
    if (events & EVENT_PULSE) sounds.pulse();
    if (events & EVENT_COLLECT) sounds.chime(world.state.combo);
    if (events & EVENT_ZAP) sounds.spark();
    if (events & EVENT_HIT) {
      sounds.thud();
      announce(world.state.flames === 1 ? 'Hit. 1 flame left.' : `Hit. ${world.state.flames} flames left.`);
    }
    if (events & EVENT_NIGHT) {
      sounds.fanfare();
      screen = SCREEN_NIGHT;
      announce(`Night ${world.state.night - 1} cleared. Dawn bonus ${world.state.dawnBonus}.`);
    } else if (events & EVENT_WIN) {
      sounds.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      sounds.lose();
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, sounds.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting moths hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The first gesture unlocks sound; the pad starts humming underneath.
  window.addEventListener('pointerdown', () => sounds.unlock(), { once: true });
  window.addEventListener('keydown', () => sounds.unlock(), { once: true });

  announce('Wispkeeper. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
