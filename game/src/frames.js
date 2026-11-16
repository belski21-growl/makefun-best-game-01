// ASHEN HOLLOW — the screenshot scenes behind
// ?shot=title|field|battle|battle-ult|victory. Each one plays the real
// rules forward from a fresh field for a fixed number of steps, so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.

import { STEP } from './tuning.js';
import { createDice } from './dice.js';
import { createField } from './field.js';
import { createCombat } from './combat.js';
import { SCREENS } from './painter.js';

function driveField(field, dir, until, maxSteps = 4000) {
  let guard = 0;
  // A step starts in the same update the last one lands, so the goal is the
  // tile the hero is heading for (toX/toY), not the tile it stands on: once
  // the destination is the goal, stop steering and let the tween land.
  while (guard < maxSteps) {
    field.state.encounterIn = 9999;
    const go = until() ? { x: 0, y: 0 } : dir;
    field.update(STEP, { dir: go, confirm: false, click: null });
    guard += 1;
    if (until() && !field.state.hero.moving) break;
  }
}

function driveCombatUntil(combat, cond, maxSteps = 3000) {
  let guard = 0;
  while (guard < maxSteps && !cond()) {
    combat.update(0.05, {});
    guard += 1;
  }
  return guard < maxSteps;
}

function currentActorName(combat) {
  const actor = combat.state.order[combat.state.actorIndex - 1];
  return actor ? actor.ref.name : '';
}

export function stageShot(name, seed) {
  if (name === 'title') {
    const field = createField(createDice(seed));
    return { screen: SCREENS.TITLE, field, combat: null, bestText: 'Best: 2 / 3 Ember Crystals', stats: null };
  }
  if (name === 'field') {
    // The field shot shows the world, not a dialog: the hero stands on the
    // market road below the giant Wraithwood spirit tree (world 805,230),
    // its crown running off the top of the frame, with the flooding poison
    // river visible to the south-east — so a giant landmark dominates the
    // frame and the flood reads as water, not grass.
    const field = createField(createDice(seed));
    field.addCrystal('gale');
    field.state.party[1].hp = 18;
    field.state.party[2].mp = 4;
    field.state.gold = 46;
    driveField(field, { x: 0, y: -1 }, () => field.state.hero.toY <= 11);
    driveField(field, { x: 1, y: 0 }, () => field.state.hero.toX >= 25);
    return { screen: SCREENS.FIELD, field, combat: null, bestText: '', stats: null };
  }
  if (name === 'battle') {
    const dice = createDice(seed);
    const field = createField(createDice(seed));
    field.addCrystal('gale');
    field.state.banner = null;
    const combat = createCombat(dice, field.state.party, field.state.inventory, {
      enemies: ['rattlebones', 'gravebat'], boss: false, canRun: true, speed: 1,
    });
    driveCombatUntil(combat, () => combat.state.phase === 'command');
    // Mira attacks the Rattlebones; the foes answer; then Ash opens his Skill menu.
    combat.update(0.05, { confirm: true });
    combat.update(0.05, { confirm: true });
    driveCombatUntil(combat, () => combat.state.phase === 'command');
    combat.update(0.05, { down: true });
    combat.update(0.05, { confirm: true });
    return { screen: SCREENS.BATTLE, field, combat, bestText: '', stats: null };
  }
  if (name === 'battle-ult') {
    // The peak of Ash's ultimate against the Galehowl: the name card burns,
    // the first slashes have landed, particles fill the air. The combat is
    // driven forward a fixed number of steps and then frozen, so the frame
    // is deterministic for a given seed.
    const dice = createDice(seed);
    const field = createField(createDice(seed));
    field.addCrystal('gale');
    field.state.banner = null;
    for (const hero of field.state.party) {
      // Level 1 -> 4: apply the growth three times, so MP and stats match
      // a party that really fought its way there (an ultimate must be
      // affordable: Ash needs 14 MP, Bram 12).
      for (let i = 0; i < 3; i += 1) {
        hero.level += 1;
        hero.maxHp += hero.growth.hp;
        hero.maxMp += hero.growth.mp;
        hero.atk += hero.growth.atk;
        hero.def += hero.growth.def;
      }
      hero.mp = hero.maxMp;
      hero.hp = hero.maxHp;
    }
    const combat = createCombat(dice, field.state.party, field.state.inventory, {
      enemies: ['galehowl'], boss: true, canRun: false, speed: 1,
    });
    driveCombatUntil(combat, () => combat.state.phase === 'command');
    // Mira acts first (fastest): a plain attack on the boss.
    combat.update(0.05, { confirm: true });
    combat.update(0.05, { confirm: true });
    // Wait for Ash's command phase.
    driveCombatUntil(combat, () => combat.state.phase === 'command' && currentActorName(combat) === 'Ash');
    // Ash: Skill -> Ashen Requiem (3rd skill) -> target -> unleash.
    combat.update(0.05, { down: true });
    combat.update(0.05, { confirm: true });
    combat.update(0.05, { down: true });
    combat.update(0.05, { down: true });
    combat.update(0.05, { confirm: true });
    combat.update(0.05, { confirm: true });
    // Drive the ultimate to its peak: the five slashes land at 0.6 + i*0.25
    // (floats live 1.1 s, the name card 1.7 s), so at t = 1.30 three slashes
    // have landed, three damage numbers are up, the freshest particles are
    // mid-burst, and the boss is still standing (Mira's opening attack plus
    // four slashes would already kill it — t = 1.45 showed an empty field).
    // t = 1.30, not 1.15: the hit flash (decay 4/s) is nearly gone 0.2 s
    // after the third slash, so the dark boss sprite reads instead of
    // whiting out under its own flash.
    driveCombatUntil(combat, () => {
      const anim = combat.state.anim;
      return Boolean(anim) && anim.t >= 1.30 && combat.state.floats.length >= 3;
    });
    return { screen: SCREENS.BATTLE, field, combat, bestText: '', stats: null };
  }
  if (name === 'victory') {
    const field = createField(createDice(seed));
    field.addCrystal('gale');
    field.addCrystal('dawn');
    field.addCrystal('tide');
    field.state.banner = null;
    field.state.time = 742;
    field.state.battles = 14;
    field.state.gold = 180;
    field.state.party[0].level = 4;
    field.state.party[1].level = 4;
    field.state.party[2].level = 3;
    return {
      screen: SCREENS.VICTORY,
      field,
      combat: null,
      bestText: '',
      stats: { time: 742, battles: 14, level: 4, gold: 180 },
    };
  }
  const field = createField(createDice(seed));
  return { screen: SCREENS.TITLE, field, combat: null, bestText: '', stats: null };
}
