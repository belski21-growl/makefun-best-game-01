// ASHEN HOLLOW — boot and the one loop: input is read every frame, the field
// and the battle advance in fixed 1/60 s steps, and the painter shows what
// is there. The game moves between six screens: title, field, battle,
// paused, game over and victory.
//
// ?seed=N fixes the run's dice. ?shot=title|field|battle|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './tuning.js';
import { createDice } from './dice.js';
import { createField } from './field.js';
import { createCombat } from './combat.js';
import { createChiptune } from './chiptune.js';
import { equipmentBySource } from './story.js';
import {
  ACT_CONFIRM, ACT_CANCEL, ACT_PAUSE, ACT_MUTE, ACT_HELP, ACT_PARTY, ACT_NEWGAME, createKeys,
} from './keys.js';
import { createPainter, SCREENS, fieldCamera } from './painter.js';
import { stageShot } from './frames.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const painter = createPainter(canvas);
const sounds = createChiptune();

function readBest() {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? 'null') || { crystals: 0, victories: 0, bestTime: null };
  } catch {
    return { crystals: 0, victories: 0, bestTime: null };
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function bestText(best) {
  if (best.victories > 0) return `Best: victory in ${fmtTime(best.bestTime)} — ${best.crystals}/3 crystals`;
  if (best.crystals > 0) return `Best: ${best.crystals} / 3 Ember Crystals`;
  return '';
}

function runShot(name) {
  const scene = stageShot(name, seed);
  const best = readBest();
  let painted = 0;
  function paint() {
    painter.draw({
      screen: scene.screen,
      field: scene.field,
      combat: scene.combat,
      bestText: scene.bestText || bestText(best),
      muted: false,
      time: 2.0,
      showControls: false,
      stats: scene.stats || { time: 0, battles: 0, level: 1, gold: 0 },
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const keys = createKeys(canvas, (x, y) => painter.toLogical(x, y));
  let screen = SCREENS.TITLE;
  let field = createField(createDice(seed));
  let combat = null;
  let pendingBattle = null;
  let showControls = false;
  let best = readBest();
  let hasSave = Boolean(readSave());
  let stats = null;
  let muted = false;
  let battleSpeed = 1;
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let prevFloats = 0;
  let prevPhase = '';

  function announce(message) {
    status.textContent = message;
  }

  function setScreen(next, theme) {
    screen = next;
    sounds.setTheme(theme);
  }

  /** The field asked for a save (hearthfire, crystal, swap, equip):
   *  write it to localStorage now. */
  function persistSave() {
    if (field.state.pendingSave) {
      if (writeSave(field.state.pendingSave)) hasSave = true;
      field.state.pendingSave = null;
    }
  }

  function startQuest() {
    field = createField(createDice(seed));
    stats = null;
    setScreen(SCREENS.FIELD, 'field');
    announce('Aldermere. Find Elder Maren in the town to the south-west.');
  }

  function continueQuest() {
    const save = readSave();
    field = createField(createDice(seed));
    stats = null;
    if (save && field.applySave(save)) {
      setScreen(SCREENS.FIELD, 'field');
      announce('Welcome back. The hearth is still cold — three crystals to go.');
    } else {
      startQuest();
    }
  }

  function newGame() {
    clearSave();
    hasSave = false;
    startQuest();
  }

  function startBattle(event) {
    pendingBattle = event;
    combat = createCombat(createDice(seed + field.state.battles + 1), field.state.party, field.state.inventory, {
      enemies: event.enemies,
      boss: Boolean(event.boss),
      canRun: !event.boss,
      speed: battleSpeed,
    });
    prevFloats = 0;
    prevPhase = 'intro';
    setScreen(SCREENS.BATTLE, 'battle');
    announce(combat.state.message);
  }

  function endBattle(result) {
    if (result.won) {
      field.state.gold += result.gold;
      // The spoils: monster materials, a boss's Elixir, boss-drop
      // equipment, and kill counts for the side quests.
      for (const [m, n] of Object.entries(result.materials || {})) {
        field.state.materials[m] = (field.state.materials[m] || 0) + n;
      }
      if (result.elixir) {
        field.state.inventory.elixir = (field.state.inventory.elixir || 0) + result.elixir;
      }
      if (result.sourceKey) {
        for (const id of equipmentBySource(result.sourceKey)) {
          field.state.equipmentOwned[id] = true;
        }
      }
      field.recordKills(result.slain);
      field.state.pendingSave = field.serializeSave();
      persistSave();
      if (result.levelUps.length > 0) sounds.sfx('levelup');
      if (pendingBattle && pendingBattle.crystal) {
        field.addCrystal(pendingBattle.crystal);
        persistSave();
        field.state.saveToast = { text: 'Progress saved', t: 0 };
        sounds.sfx('crystal');
        const count = field.state.crystals.size;
        if (count > best.crystals) {
          best.crystals = count;
          saveBest(best);
        }
      }
      if (pendingBattle && pendingBattle.final) {
        stats = {
          time: field.state.time,
          battles: field.state.battles,
          level: Math.max(...field.state.party.map((h) => h.level)),
          gold: field.state.gold,
        };
        if (best.bestTime === null || stats.time < best.bestTime) best.bestTime = stats.time;
        best.victories += 1;
        saveBest(best);
        sounds.sfx('win');
        setScreen(SCREENS.VICTORY, null);
        announce(`Victory! The hearth burns again. Time ${fmtTime(stats.time)}.`);
      } else {
        sounds.sfx('win');
        setScreen(SCREENS.FIELD, 'field');
        announce(result.fled ? 'Escaped safely.' : 'Victory! The road is clear.');
      }
    } else {
      sounds.sfx('lose');
      setScreen(SCREENS.GAMEOVER, null);
      announce('The party has fallen. Press Enter to return to Aldermere.');
    }
    combat = null;
    pendingBattle = null;
  }

  function respawn() {
    for (const hero of field.state.party) {
      hero.hp = Math.max(1, Math.round(hero.maxHp * 0.5));
      hero.mp = Math.max(1, Math.round(hero.maxMp * 0.5));
      hero.guard = 0;
    }
    field.respawn();
    field.state.dialog = null;
    field.state.banner = null;
    setScreen(SCREENS.FIELD, 'field');
    announce('Back in Aldermere, healed and ready.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    accumulator += dt;

    const bits = keys.takeActions();
    const speedKey = keys.takeSpeed();
    if (speedKey) {
      battleSpeed = speedKey;
      if (combat) combat.setSpeed(speedKey);
    }
    if (bits & ACT_MUTE) {
      muted = sounds.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    const confirm = Boolean(bits & ACT_CONFIRM);
    const cancel = Boolean(bits & ACT_CANCEL);
    const pause = Boolean(bits & ACT_PAUSE);
    const help = Boolean(bits & ACT_HELP);
    const party = Boolean(bits & ACT_PARTY);
    const newgame = Boolean(bits & ACT_NEWGAME);
    const dirs = keys.takeDirs();
    // One-shot actions are consumed by the first step that uses them, so a
    // single press never fires twice on a slow frame.
    let frameConfirm = confirm;
    let frameCancel = cancel;
    let frameDirs = dirs;

    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (screen === SCREENS.TITLE) {
        if (help) showControls = !showControls;
        else if (newgame) {
          sounds.unlock();
          sounds.sfx('confirm');
          newGame();
        } else if (frameConfirm) {
          sounds.unlock();
          sounds.sfx('confirm');
          if (hasSave) continueQuest();
          else startQuest();
        }
        frameConfirm = false;
      } else if (screen === SCREENS.FIELD) {
        const click = keys.takeClick();
        let worldClick = null;
        if (click) {
          const cam = fieldCamera(field);
          worldClick = { x: click.x + cam.x, y: click.y + cam.y };
        }
        if (field.state.partyOpen) {
          // The Party overlay consumes all input: one-shot dirs move the
          // cursor, Enter swaps or equips, Tab toggles the mode, Esc closes.
          // P does not pause while it is open. frameDirs is {up,down,left,
          // right} booleans; the field reads dir as {x,y}, so convert here
          // (a missing y would read as undefined and swallow every confirm).
          field.update(STEP, {
            dir: {
              x: (frameDirs.right ? 1 : 0) - (frameDirs.left ? 1 : 0),
              y: (frameDirs.down ? 1 : 0) - (frameDirs.up ? 1 : 0),
            },
            confirm: frameConfirm,
            cancel: frameCancel,
            partyToggle: party,
            click: null,
          });
          frameDirs = { up: false, down: false, left: false, right: false };
          persistSave();
        } else if (pause || frameCancel) {
          setScreen(SCREENS.PAUSED, null);
          announce('Paused.');
        } else {
          const event = field.update(STEP, {
            dir: keys.direction(),
            confirm: frameConfirm,
            partyToggle: party,
            click: worldClick,
          });
          persistSave();
          if (event) {
            sounds.sfx('confirm');
            if (event.type === 'encounter' || event.type === 'battle') startBattle(event);
          }
        }
        frameConfirm = false;
        frameCancel = false;
      } else if (screen === SCREENS.BATTLE && combat) {
        if (pause) {
          setScreen(SCREENS.PAUSED, null);
          announce('Paused.');
        } else {
          const click = keys.takeClick();
          const result = combat.update(STEP, {
            confirm: frameConfirm,
            cancel: frameCancel,
            up: frameDirs.up,
            down: frameDirs.down,
            left: frameDirs.left,
            right: frameDirs.right,
            click,
          });
          frameDirs = { up: false, down: false, left: false, right: false };
          if (combat.state.floats.length > prevFloats) sounds.sfx('hit');
          prevFloats = combat.state.floats.length;
          if (combat.state.phase !== prevPhase) {
            if (combat.state.phase === 'win') sounds.sfx('win');
            if (combat.state.phase === 'lose') sounds.sfx('lose');
            prevPhase = combat.state.phase;
          }
          if (result && result.done) endBattle(result);
        }
        frameConfirm = false;
        frameCancel = false;
      } else if (screen === SCREENS.PAUSED) {
        if (pause || frameCancel || frameConfirm) {
          setScreen(combat ? SCREENS.BATTLE : SCREENS.FIELD, combat ? 'battle' : 'field');
          announce('Playing.');
        }
        frameConfirm = false;
        frameCancel = false;
      } else if (screen === SCREENS.VICTORY) {
        if (frameConfirm) startQuest();
        frameConfirm = false;
      } else if (screen === SCREENS.GAMEOVER) {
        if (frameConfirm) respawn();
        frameConfirm = false;
      }
      if (screen !== SCREENS.BATTLE) {
        prevFloats = 0;
        prevPhase = '';
      }
    }

    painter.draw({
      screen,
      field,
      combat,
      bestText: bestText(best),
      hasSave,
      muted,
      time,
      showControls,
      stats: stats || { time: 0, battles: 0, level: 1, gold: 0 },
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREENS.FIELD) {
      setScreen(SCREENS.PAUSED, null);
      announce('Paused.');
    }
  });

  window.addEventListener('pointerdown', () => sounds.unlock(), { once: true });
  window.addEventListener('keydown', () => sounds.unlock(), { once: true });

  // A handle for play tests: read the live screen and state from the console.
  window.__ember = {
    get screen() { return screen; },
    get field() { return field; },
    get combat() { return combat; },
    get best() { return best; },
  };

  announce('Ashen Hollow. Press Enter or click to begin the quest.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
