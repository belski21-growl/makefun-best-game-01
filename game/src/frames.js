// ASHEN HOLLOW — the screenshot scenes behind
// ?shot=title|field|battle|battle-ult|battle-dragon|battle-combo|victory|victory-loot|hearth. Each one plays the real
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
  if (name === 'hearth') {
    const field = createField(createDice(seed));
    return { screen: SCREENS.HEARTH, field, combat: null, bestText: '', stats: null };
  }
  if (name === 'title') {
    const field = createField(createDice(seed));
    return { screen: SCREENS.TITLE, field, combat: null, bestText: 'Best: 2 / 3 Ember Crystals', stats: null };
  }
  if (name === 'puzzle-braziers') {
    const field = createField(createDice(seed));
    // Render-only tableau; real puzzle progress remains untouched.
    Object.assign(field.state.hero, { tx: 17, ty: 18, px: 544, py: 576, toX: 17, toY: 18, fromX: 17, fromY: 18, dir: 'up' });
    field.state.banner = null;
    field.state.fieldPresentation = {
      brazierLit: [0, 1],
      partyOffsets: [[-64, 12], [-20, 28], [58, 12], [20, -10]],
    };
    return { screen: SCREENS.FIELD, field, combat: null, bestText: '', stats: null };
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
    // Render-only staging: distinct silhouettes and three readable road props.
    // Positions do not move actors, change tiles, or participate in rules.
    field.state.fieldPresentation = {
      partyOffsets: [[-66, 20], [-12, 38], [42, 20], [0, -18]],
      props: [
        { tile: 'L', x: 688, y: 382 },
        { tile: 'C', x: 862, y: 382 },
        { tile: 'U', x: 926, y: 294 },
      ],
    };
    return { screen: SCREENS.FIELD, field, combat: null, bestText: '', stats: null };
  }
  if (name === 'battle') {
    // Both battle captures use the existing deterministic boss/ultimate tableau.
    // Reuse its real rules-driven sequence; no stats or encounter rules change.
    return stageShot('battle-ult', seed);
  }
  if (name === 'battle-ult' || name === 'battle-dragon') {
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
    if (name === 'battle-dragon') {
      // Same seeded battle and fixed-step freeze as battle-ult, earlier in
      // Ash's ultimate: t=0.65 (speed 1), breathTime=0.30, opacity=1.
      // floor(0.30 * 11.994002998500749)=3: the flame-bearing hit frame
      // is visible alongside the full-width wave, before the second hit.
      // Do not wait for multiple floats: the boss must remain on screen.
      driveCombatUntil(combat, () => {
        const anim = combat.state.anim;
        return anim?.kind === 'ultimate' && anim.actor?.name === 'Ash' && anim.t >= 0.65;
      });
      return { screen: SCREENS.BATTLE, field, combat, bestText: '', stats: null };
    }
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
  if (name === 'battle-combo') {
    const staged = stageShot('battle-ult', seed);
    staged.combat.state.emberCombo = 4;
    const card = staged.combat.state.fx.nameCard;
    if (card?.ultimate) {
      card.text = `EMBER ARTS FINISHER — ${card.text}`;
      card.finisher = true;
    }
    return staged;
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
  if (name === 'victory-loot') {
    const staged = stageShot('victory', seed);
    const dice = createDice(seed);
    const combat = createCombat(dice, staged.field.state.party, staged.field.state.inventory, {
      enemies: ['galehowl'], boss: true, canRun: false, speed: 1,
    });
    combat.state.foes[0].hp = 0;
    combat.state.phase = 'anim';
    combat.state.anim = { t: 0, dur: 0.01, applied: false, apply: null };
    combat.update(0.02, {});
    return { ...staged, loot: combat.state.results.loot };
  }
  const field = createField(createDice(seed));
  return { screen: SCREENS.TITLE, field, combat: null, bestText: '', stats: null };
}
