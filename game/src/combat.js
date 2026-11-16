// ASHEN HOLLOW — the battle engine: turn-based fights with a party of six,
// four active and two in reserve. Only the four active heroes fight; the
// reserves gain half XP and wait in Aldermere. Damage, guards, stuns, XP
// and level-ups all live here. It never draws anything.
// The spectacle lives here too: the fx state (screen shake, element flash,
// particles, rings, the skill-name card) is filled by the rules and read
// by painter.js — all of it driven by game time, never by the clock.

import { xpNext, grantXp, SKILLS, ITEMS, ENEMIES, SPRITES } from './story.js';
import { RUN_CHANCE } from './tuning.js';

/** How much damage a guard lets through. Bram's Aegis Guard perk cuts it
 *  further: a guarded Bram takes 40% instead of 60%. */
export function guardMultiplier(hero) {
  if (hero.guard > 0 && hero.perk && hero.perk.id === 'aegis') return 0.4;
  return 0.6;
}

/** Element colours for the battle spectacle, shared with painter.js. */
export const ELEMENT_COLORS = {
  fire: '#ff5a2a',
  shadow: '#8a3ad8',
  steel: '#ffc857',
};

/** Menu and foe layout in logical pixels, shared with painter.js so mouse
 *  clicks land on the same rectangles the eye sees. */
export const MENU = { x: 40, y: 392, w: 880, h: 128, itemH: 30 };
export const FOE_AREA = { x: 90, y: 130, w: 420, h: 220 };

/** Hero rows in the battle screen (four active heroes), shared with
 *  painter.js so floats land on the same rows the eye sees. */
export const BATTLE_HERO_Y = [115, 190, 265, 340];

export function foeSlotPos(index, count) {
  const spread = count === 1 ? [0.5] : count === 2 ? [0.3, 0.7] : [0.16, 0.5, 0.84];
  return {
    x: FOE_AREA.x + FOE_AREA.w * spread[index],
    y: FOE_AREA.y + FOE_AREA.h * (index % 2 === 0 ? 0.25 : 0.62),
  };
}

const MAIN_ITEMS = ['Attack', 'Skill', 'Item', 'Run'];

export function createCombat(dice, party, inventory, spec) {
  const foes = spec.enemies.map((id, i) => {
    const base = ENEMIES[id];
    return { id, ...base, hp: base.hp, maxHp: base.hp, guard: 0, stun: 0, slot: i, flash: 0, knock: 0 };
  });
  for (const hero of party) hero.ultUsed = false;
  const state = {
    foes,
    heroes: party,
    inventory,
    boss: spec.boss,
    canRun: spec.canRun,
    speed: spec.speed || 1,
    phase: 'intro',
    phaseT: 0,
    order: [],
    actorIndex: 0,
    menu: { mode: 'main', index: 0, skill: 0, item: 0, target: 0, action: null },
    message: spec.boss
      ? `${ENEMIES[spec.enemies[0]].name} rises from the dark!`
      : `Something stirs in the dark — ${foes.map((f) => f.name).join(', ')}!`,
    floats: [],
    anim: null,
    results: null,
    fled: false,
    waveCount: 0,
    /** The spectacle: read by painter.js every frame. */
    fx: {
      shake: 0,
      flash: 0,
      flashColor: '#ff5a2a',
      bgElement: null,
      bgT: 0,
      nameCard: null,
      particles: [],
      rings: [],
      cracks: [],
    },
  };

  // Visual randomness is isolated from the dice that determine battle outcomes.
  let visualSeed = 0x51ade;
  function visualRandom() {
    visualSeed = (Math.imul(visualSeed, 1664525) + 1013904223) >>> 0;
    return visualSeed / 4294967296;
  }
  function spawnParticles(x, y, element, count, power) {
    // Preserve legacy gameplay dice consumption; added layers use visualRandom.
    const previousCount = ({ 72: 46, 28: 18, 18: 10, 26: 16, 34: 20 })[count] || count;
    for (let i = 0; i < previousCount * 5; i += 1) dice.next();
    const colors = element === 'fire'
      ? ['#ff5a2a', '#ff7a3c', '#ffc857', '#c73e2c']
      : element === 'shadow'
        ? ['#8a3ad8', '#b45ad8', '#5a2a8a', '#ff5a2a']
        : ['#ffc857', '#c8ccd4', '#ff5a2a', '#e8ddc8'];
    for (let i = 0; i < count; i += 1) {
      const angle = visualRandom() * Math.PI * 2;
      const layer = i % 3;
      const speed = (40 + visualRandom() * 160) * power * (layer === 2 ? 1.5 : 1);
      state.fx.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60 * power,
        age: 0,
        life: 0.5 + visualRandom() * 0.7,
        size: 2 + visualRandom() * 4,
        color: layer === 0 ? '#423443' : colors[Math.floor(visualRandom() * colors.length)],
        layer,
      });
    }
  }
  function spawnRing(x, y, color, size = 170, life = 0.7, width = 4) {
    state.fx.rings.push({ x, y, age: 0, life, color, size, width });
  }
  function spawnCracks(x, y, color) {
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8 + (visualRandom() - 0.5) * 0.3;
      const length = 30 + visualRandom() * 80;
      state.fx.cracks.push({ x, y, age: 0, life: 1.4, color, angle, length });
    }
  }
  function setNameCard(skill, hero) {
    state.fx.nameCard = {
      text: skill.name,
      sub: `${hero.name} — ${hero.cls}`,
      color: ELEMENT_COLORS[skill.element] || '#ffc857',
      ultimate: skill.kind === 'ultimate',
      t: 0,
      dur: skill.kind === 'ultimate' ? 1.7 : 0.9,
    };
  }
  function triggerFx(skill, x, y, power) {
    const color = ELEMENT_COLORS[skill.element] || '#ffc857';
    state.fx.flashColor = color;
    state.fx.flash = skill.kind === 'ultimate' ? 0.55 : 0.3;
    state.fx.shake = Math.max(state.fx.shake, skill.kind === 'ultimate' ? 22 : 9);
    state.fx.bgElement = skill.element;
    state.fx.bgT = 0;
    spawnParticles(x, y, skill.element, skill.kind === 'ultimate' ? 72 : 28, power);
    spawnRing(x, y, color, skill.kind === 'ultimate' ? 240 : 180, skill.kind === 'ultimate' ? 1.1 : 0.7, skill.kind === 'ultimate' ? 6 : 4);
    if (skill.kind === 'ultimate') {
      spawnRing(x, y, '#ffcc66', 145, 0.8, 3);
    }
  }

  function activeHeroes() {
    return state.heroes.filter((h) => h.active !== false);
  }
  function aliveHeroes() {
    return activeHeroes().filter((h) => h.hp > 0);
  }
  function heroFloatY(hero) {
    const i = activeHeroes().indexOf(hero);
    return BATTLE_HERO_Y[Math.max(0, i)] - 40;
  }
  function heroRowY(hero) {
    const i = activeHeroes().indexOf(hero);
    return BATTLE_HERO_Y[Math.max(0, i)];
  }
  function aliveFoes() {
    return state.foes.filter((f) => f.hp > 0);
  }
  function firstLivingFoe() {
    const foe = aliveFoes()[0];
    return foe || null;
  }
  function addFloat(x, y, text, color, size) {
    state.floats.push({ x, y, text, color, size: size || 22, t: 0, dur: 1.1 });
  }
  function setMessage(text) {
    state.message = text;
  }
  function startRound() {
    // Liora's Grace perk: the party regains 2 HP at the start of each round.
    const liora = state.heroes.find((h) => h.perk && h.perk.id === 'grace' && h.hp > 0 && h.active !== false);
    if (liora) {
      for (const hero of aliveHeroes()) hero.hp = Math.min(hero.maxHp, hero.hp + 2);
    }
    const actors = [];
    for (const hero of activeHeroes()) if (hero.hp > 0) actors.push({ kind: 'hero', ref: hero });
    for (const foe of state.foes) if (foe.hp > 0) actors.push({ kind: 'foe', ref: foe });
    actors.sort((a, b) => (b.ref.spd - a.ref.spd) || (dice.chance(0.5) ? 1 : -1));
    state.order = actors;
    state.actorIndex = 0;
    nextActor();
  }
  function nextActor() {
    while (state.actorIndex < state.order.length) {
      const actor = state.order[state.actorIndex];
      state.actorIndex += 1;
      if (actor.kind === 'hero' && actor.ref.hp <= 0) continue;
      if (actor.kind === 'foe' && (actor.ref.hp <= 0 || actor.ref.stun > 0)) {
        if (actor.ref.stun > 0) {
          actor.ref.stun -= 1;
          setMessage(`${actor.ref.name} is stunned and cannot move!`);
          state.phase = 'anim';
          state.phaseT = 0;
          state.anim = { kind: 'wait', t: 0, dur: 0.7, applied: true, apply: null };
          return;
        }
        continue;
      }
      if (actor.kind === 'hero') {
        // Poison ticks at the start of the hero's turn; a hero who falls to
        // it never gets a turn.
        if (actor.ref.poison > 0) {
          actor.ref.poison -= 1;
          actor.ref.hp = Math.max(0, actor.ref.hp - 5);
          addFloat(760, heroFloatY(actor.ref), '-5 poison', '#7ac74a');
          if (actor.ref.hp <= 0) {
            setMessage(`${actor.ref.name} succumbs to the poison!`);
            continue;
          }
        }
        // Mira's Emberwell perk: she regains 3 MP as her turn begins.
        if (actor.ref.perk && actor.ref.perk.id === 'emberwell' && actor.ref.hp > 0 && actor.ref.mp < actor.ref.maxMp) {
          actor.ref.mp = Math.min(actor.ref.maxMp, actor.ref.mp + 3);
          addFloat(760, heroFloatY(actor.ref), '+3 MP', '#7a6ac8');
        }
        state.menu = { mode: 'main', index: 0, skill: 0, item: 0, target: 0, action: null };
        state.phase = 'command';
        setMessage(`${actor.ref.name}'s turn — choose an action.`);
        return;
      }
      state.phase = 'foe';
      state.phaseT = 0;
      foeAct(actor.ref);
      return;
    }
    for (const hero of state.heroes) if (hero.guard > 0) hero.guard -= 1;
    startRound();
  }
  function damageOf(attacker, power, defender) {
    const variance = 0.85 + dice.next() * 0.3;
    // Rowan's Hawkeye perk: critical hits land 25% of the time.
    const critChance = attacker.perk && attacker.perk.id === 'hawkeye' ? 0.25 : 0.1;
    const crit = dice.chance(critChance);
    let raw = Math.max(1, Math.round((attacker.atk * power - defender.def * 0.8) * variance));
    // Vex's Executioner perk: +50% damage against foes below 30% HP.
    if (attacker.perk && attacker.perk.id === 'executioner' && defender.hp < defender.maxHp * 0.3) {
      raw = Math.round(raw * 1.5);
    }
    if (defender.guard > 0) raw = Math.max(1, Math.round(raw * guardMultiplier(defender)));
    if (crit) raw = Math.round(raw * 1.5);
    return { amount: raw, crit };
  }
  function applyDamage(target, amount, crit, x, y) {
    target.hp = Math.max(0, target.hp - amount);
    if (target.flash !== undefined) target.flash = 1;
    if (target.knock !== undefined) target.knock = 1;
    addFloat(x, y, `${amount}${crit ? '!' : ''}`, crit ? '#ffc857' : '#ffffff', crit ? 30 : 22);
  }
  function checkEnd() {
    if (aliveFoes().length === 0) {
      const xp = state.foes.reduce((sum, f) => sum + f.xp, 0);
      const gold = state.foes.reduce((sum, f) => sum + f.gold, 0);
      const levelUps = grantXp(state.heroes, xp);
      // Every fallen foe leaves one material behind; a boss leaves an Elixir
      // and the equipment its shrine guards (by source key).
      const materials = {};
      for (const foe of state.foes) {
        if (foe.boss || !foe.material) continue;
        materials[foe.material] = (materials[foe.material] || 0) + 1;
      }
      const BOSS_SOURCE = { galehowl: 'gale', tidecoil: 'tide', dawnwing: 'dawn', griefbelow: 'hidden' };
      const sourceKey = state.boss ? (BOSS_SOURCE[state.foes[0].id] || null) : null;
      state.results = { xp, gold, levelUps, materials, elixir: state.boss ? 1 : 0, sourceKey, slain: state.foes.map((f) => f.id) };
      state.phase = 'win';
      state.phaseT = 0;
      setMessage(levelUps.length > 0
        ? `Victory! ${levelUps.map((l) => `${l.name} reached level ${l.level}`).join(', ')}!`
        : `Victory! The party gains ${xp} XP and ${gold} gold.`);
      return true;
    }
    if (aliveHeroes().length === 0) {
      state.phase = 'lose';
      state.phaseT = 0;
      setMessage('The party has fallen...');
      return true;
    }
    return false;
  }
  function playAnim(kind, actor, target, apply, opts = {}) {
    // Event times are written for speed 1 and scaled here, so a multi-hit
    // ultimate lands every hit at 2x speed too.
    const events = opts.events
      ? opts.events.map((ev) => ({ ...ev, at: ev.at / state.speed }))
      : null;
    state.anim = {
      kind, actor, target, t: 0,
      dur: (opts.dur || 0.65) / state.speed,
      applied: false, apply,
      events,
    };
    state.phase = 'anim';
    state.phaseT = 0;
  }
  function currentHero() {
    return state.order[state.actorIndex - 1].ref;
  }
  function heroAct(action) {
    const hero = currentHero();
    if (action.kind === 'attack' || action.kind === 'skill') {
      const skill = action.kind === 'skill' ? SKILLS[action.skill] : null;
      if (skill) hero.mp -= skill.mp;
      const power = skill ? skill.power : 1;
      // Heal / guard / party skills target allies (or no one) — they must
      // not resolve action.target as a foe index first: with fewer foes
      // than the ally's index that read crashes the battle.
      if (skill && skill.kind === 'heal') {
        const ally = activeHeroes()[action.target];
        // Liora's Grace perk: healing is 25% stronger.
        const amount = Math.round(35 * (hero.perk && hero.perk.id === 'grace' ? 1.25 : 1));
        setNameCard(skill, hero);
        triggerFx(skill, 760, heroRowY(ally), 0.5);
        playAnim('heal', hero, ally, () => {
          ally.hp = Math.min(ally.maxHp, ally.hp + amount);
          addFloat(760, heroFloatY(ally), `+${amount}`, '#58d858');
          setMessage(`${hero.name} kindles ${ally.name}'s wounds (+${amount} HP).`);
        });
        return;
      }
      if (skill && skill.kind === 'guard') {
        setNameCard(skill, hero);
        triggerFx(skill, 760, heroRowY(hero), 0.5);
        playAnim('guard', hero, hero, () => {
          hero.guard = 3;
          setMessage(`${hero.name} raises a hearth guard. Defence up!`);
        });
        return;
      }
      if (skill && skill.kind === 'partyGuard') {
        setNameCard(skill, hero);
        triggerFx(skill, 760, 200, 0.5);
        playAnim('guard', hero, hero, () => {
          for (const ally of activeHeroes()) ally.guard = 3;
          setMessage(`${hero.name} raises a bulwark over the party!`);
        });
        return;
      }
      if (skill && skill.kind === 'partyHeal') {
        setNameCard(skill, hero);
        triggerFx(skill, 760, 200, 0.5);
        playAnim('heal', hero, hero, () => {
          const amount = Math.round(20 * (hero.perk && hero.perk.id === 'grace' ? 1.25 : 1));
          for (const ally of aliveHeroes()) {
            ally.hp = Math.min(ally.maxHp, ally.hp + amount);
            ally.poison = 0;
            addFloat(760, heroFloatY(ally), `+${amount}`, '#58d858');
          }
          setMessage(`${hero.name} casts ${skill.name} — the party is mended and cleansed.`);
        });
        return;
      }
      // From here the action targets a foe: resolve it now.
      const foe = state.foes[action.target];
      const pos = foeSlotPos(foe.slot, state.foes.length);
      if (skill && skill.kind === 'ultimate') {
        hero.ultUsed = true;
        setNameCard(skill, hero);
        triggerFx(skill, pos.x, pos.y, 1);
        if (skill.hits) {
          // Ashen Requiem: five burning slashes, one after another, after
          // a slow beat while the name card burns on screen.
          const events = [];
          for (let i = 0; i < skill.hits; i += 1) {
            events.push({
              at: 0.6 + i * 0.25,
              done: false,
              fn: () => {
                if (foe.hp <= 0) return;
                const hit = damageOf(hero, skill.hitPower, foe);
                applyDamage(foe, hit.amount, hit.crit, pos.x + (i % 2 === 0 ? -14 : 14), pos.y - 40 - i * 6);
                spawnParticles(pos.x, pos.y - 30, skill.element, 18, 1.1);
                spawnRing(pos.x, pos.y - 30, ELEMENT_COLORS[skill.element], 130, 0.55, 3);
                spawnCracks(pos.x, pos.y, ELEMENT_COLORS[skill.element]);
                state.fx.shake = Math.max(state.fx.shake, 18);
                state.fx.flash = Math.max(state.fx.flash, 0.35);
              },
            });
          }
          playAnim('ultimate', hero, foe, () => {
            setMessage(`${hero.name} unleashes ${skill.name} — ${skill.ultMsg}!`);
          }, { dur: 2.1, events });
          return;
        }
        if (skill.aoe) {
          // Hollowfire Cataclysm: one hollow-fire burst across all foes.
          playAnim('ultimate', hero, null, () => {
            setMessage(`${hero.name} unleashes ${skill.name} — ${skill.ultMsg}!`);
          }, {
            dur: 2.1,
            events: [{
              at: 0.9, done: false,
              fn: () => {
                for (const target of aliveFoes()) {
                  const p = foeSlotPos(target.slot, state.foes.length);
                  const hit = damageOf(hero, skill.power, target);
                  applyDamage(target, hit.amount, hit.crit, p.x, p.y - 40);
                  spawnParticles(p.x, p.y - 30, skill.element, 26, 1.25);
                  spawnRing(p.x, p.y - 30, ELEMENT_COLORS[skill.element], 220, 0.9, 5);
                  spawnRing(p.x, p.y - 30, '#ffcc66', 120, 0.6, 3);
                  spawnCracks(p.x, p.y, ELEMENT_COLORS[skill.element]);
                }
                state.fx.shake = 24;
                state.fx.flash = Math.max(state.fx.flash, 0.4);
              },
            }],
          });
          return;
        }
        if (skill.reviveHeal) {
          // Sanctum of Dawn: the dawn itself answers — the living are made
          // whole, and the fallen rise at half strength, poison cleansed.
          playAnim('ultimate', hero, null, () => {
            setMessage(`${hero.name} unleashes ${skill.name} — ${skill.ultMsg}!`);
          }, {
            dur: 2.1,
            events: [{
              at: 0.9, done: false,
              fn: () => {
                for (const ally of activeHeroes()) {
                  if (ally.hp <= 0) {
                    ally.hp = Math.max(1, Math.round(ally.maxHp * 0.5));
                    ally.poison = 0;
                    addFloat(760, heroFloatY(ally), 'risen!', '#ffe9a8');
                  } else {
                    ally.hp = ally.maxHp;
                    ally.mp = ally.maxMp;
                    ally.poison = 0;
                    addFloat(760, heroFloatY(ally), '+FULL', '#ffe9a8');
                  }
                }
                spawnRing(760, 200, ELEMENT_COLORS[skill.element]);
                state.fx.flash = Math.max(state.fx.flash, 0.4);
              },
            }],
          });
          return;
        }
        // Hearthwall Judgment: one crushing shield slam, then the party guard.
        playAnim('ultimate', hero, foe, () => {
          setMessage(`${hero.name} unleashes ${skill.name} — ${skill.ultMsg}!`);
        }, {
          dur: 1.9,
          events: [{
            at: 0.8, done: false,
            fn: () => {
              const hit = damageOf(hero, skill.power, foe);
              applyDamage(foe, hit.amount, hit.crit, pos.x, pos.y - 40);
              spawnParticles(pos.x, pos.y - 30, skill.element, 34, 1.35);
              spawnRing(pos.x, pos.y - 30, ELEMENT_COLORS[skill.element], 250, 1.0, 6);
              spawnRing(pos.x, pos.y - 30, '#ffcc66', 150, 0.7, 3);
              spawnCracks(pos.x, pos.y, ELEMENT_COLORS[skill.element]);
              for (const ally of activeHeroes()) ally.guard = 3;
              if (skill.stunChance && dice.chance(skill.stunChance) && foe.hp > 0) foe.stun = 1;
              state.fx.shake = 24;
              state.fx.flash = Math.max(state.fx.flash, 0.4);
            },
          }],
        });
        return;
      }
      if (skill && skill.aoe) {
        // Arrow Rain: one volley across every living foe.
        setNameCard(skill, hero);
        triggerFx(skill, pos.x, pos.y, 0.7);
        playAnim('skill', hero, foe, () => {
          for (const target of aliveFoes()) {
            const p = foeSlotPos(target.slot, state.foes.length);
            const hit = damageOf(hero, power, target);
            applyDamage(target, hit.amount, hit.crit, p.x, p.y - 40);
          }
          setMessage(`${hero.name} casts ${skill.name} — it strikes every foe!`);
        });
        return;
      }
      if (skill) {
        setNameCard(skill, hero);
        triggerFx(skill, pos.x, pos.y, 0.7);
      }
      playAnim(skill ? 'skill' : 'strike', hero, foe, () => {
        const hit = damageOf(hero, power, foe);
        applyDamage(foe, hit.amount, hit.crit, pos.x, pos.y - 40);
        if (skill && skill.kind === 'bash' && dice.chance(0.35) && foe.hp > 0) {
          foe.stun = 1;
          setMessage(`${hero.name}'s Shield Bash hits ${foe.name} for ${hit.amount} — stunned!`);
        } else {
          setMessage(`${hero.name} ${skill ? `casts ${skill.name}` : 'attacks'} ${foe.name} for ${hit.amount} damage${hit.crit ? ' — a critical hit!' : ''}.`);
        }
      });
      return;
    }
    if (action.kind === 'item') {
      const ally = activeHeroes()[action.target];
      const item = ITEMS[action.item];
      state.inventory[action.item] -= 1;
      playAnim('heal', hero, ally, () => {
        let floatText = '';
        let message = '';
        if (item.full) {
          ally.hp = ally.maxHp;
          ally.mp = ally.maxMp;
          floatText = '+FULL';
          message = `${hero.name} uses an ${item.name} on ${ally.name} — fully restored!`;
        } else if (item.revive) {
          ally.hp = Math.max(1, Math.round(ally.maxHp * 0.5));
          ally.poison = 0;
          floatText = 'risen!';
          message = `${hero.name} uses a ${item.name} — ${ally.name} rises again!`;
        } else if (item.cure) {
          ally.poison = 0;
          floatText = 'cured';
          message = `${hero.name} uses an ${item.name} on ${ally.name} — the poison is gone.`;
        } else {
          if (item.heal) ally.hp = Math.min(ally.maxHp, ally.hp + item.heal);
          if (item.mp) ally.mp = Math.min(ally.maxMp, ally.mp + item.mp);
          floatText = `+${item.heal || item.mp}`;
          message = `${hero.name} uses a ${item.name} on ${ally.name}.`;
        }
        addFloat(760, heroFloatY(ally), floatText, '#58d858');
        setMessage(message);
      });
      return;
    }
    if (action.kind === 'run') {
      if (dice.chance(RUN_CHANCE)) {
        state.fled = true;
        state.phase = 'win';
        state.phaseT = 0;
        state.results = { xp: 0, gold: 0, levelUps: [] };
        setMessage('The party slips away into the tall grass...');
        return;
      }
      playAnim('wait', hero, hero, () => {
        setMessage("Couldn't escape!");
      });
    }
  }
  function foeAct(foe) {
    const heroes = aliveHeroes();
    const target = dice.pick(heroes);
    const isKing = foe.id === 'hollowking';
    state.waveCount += 1;
    if (isKing && state.waveCount % 3 === 0) {
      playAnim('wave', foe, null, () => {
        for (const hero of heroes) {
          const hit = damageOf(foe, 0.8, hero);
          applyDamage(hero, hit.amount, hit.crit, 760, heroFloatY(hero));
        }
        setMessage('The Hollow King unleashes a Hollow Wave across the party!');
      });
      return;
    }
    playAnim('strike', foe, target, () => {
      const hit = damageOf(foe, 1, target);
      applyDamage(target, hit.amount, hit.crit, 760, heroFloatY(target));
      // Venomcoil's bite: a 35% chance to poison the hero for 2 turns.
      if (foe.poison && target.hp > 0 && dice.chance(foe.poison)) {
        target.poison = 2;
        setMessage(`${foe.name} strikes ${target.name} for ${hit.amount} — poisoned!`);
      } else {
        setMessage(`${foe.name} strikes ${target.name} for ${hit.amount} damage.`);
      }
      // Ash's Ember Riposte perk: a 40% chance to answer a blow with fire.
      if (target.perk && target.perk.id === 'riposte' && target.hp > 0 && foe.hp > 0 && dice.chance(0.4)) {
        const back = damageOf(target, 0.8, foe);
        const pos = foeSlotPos(foe.slot, state.foes.length);
        applyDamage(foe, back.amount, back.crit, pos.x, pos.y - 60);
        setMessage(`${foe.name} strikes ${target.name} for ${hit.amount} — ${target.name} answers with Ember Riposte for ${back.amount}!`);
      }
    });
  }
  function menuItems() {
    if (state.menu.mode === 'skill') {
      const hero = currentHero();
      return hero.skills.map((id) => {
        const skill = SKILLS[id];
        if (skill.kind !== 'ultimate') return skill.name;
        if (hero.level < skill.unlock) return `★ ${skill.name}  (Lv${skill.unlock})`;
        if (hero.ultUsed) return `★ ${skill.name}  (spent)`;
        return `★ ${skill.name}`;
      });
    }
    if (state.menu.mode === 'item') {
      return Object.keys(state.inventory)
        .filter((id) => state.inventory[id] > 0)
        .map((id) => `${ITEMS[id].name} x${state.inventory[id]}`);
    }
    return MAIN_ITEMS;
  }
  function confirmMenu() {
    const hero = currentHero();
    const menu = state.menu;
    if (menu.mode === 'main') {
      const choice = MAIN_ITEMS[menu.index];
      if (choice === 'Attack') {
        menu.mode = 'target';
        menu.action = { kind: 'attack' };
        menu.target = state.foes.findIndex((f) => f.hp > 0);
        return;
      }
      if (choice === 'Skill') {
        menu.mode = 'skill';
        return;
      }
      if (choice === 'Item') {
        if (Object.values(state.inventory).every((n) => n <= 0)) {
          setMessage('The satchel is empty!');
          return;
        }
        menu.mode = 'item';
        return;
      }
      if (choice === 'Run') {
        if (!state.canRun) {
          setMessage('There is no running from this fight!');
          return;
        }
        heroAct({ kind: 'run' });
      }
      return;
    }
    if (menu.mode === 'skill') {
      const skillId = hero.skills[menu.skill];
      const skill = SKILLS[skillId];
      if (skill.kind === 'ultimate' && hero.level < skill.unlock) {
        setMessage(`${hero.name} has not learned ${skill.name} yet (level ${skill.unlock}).`);
        return;
      }
      if (skill.kind === 'ultimate' && hero.ultUsed) {
        setMessage(`${skill.name} is spent for this battle.`);
        return;
      }
      if (hero.mp < skill.mp) {
        setMessage(`Not enough MP for ${skill.name}!`);
        return;
      }
      if (skill.kind === 'heal') {
        menu.mode = 'ally';
        menu.action = { kind: 'skill', skill: skillId };
        menu.target = 0;
        return;
      }
      if (skill.kind === 'guard' || skill.kind === 'partyGuard' || skill.kind === 'partyHeal') {
        heroAct({ kind: 'skill', skill: skillId, target: 0 });
        return;
      }
      menu.mode = 'target';
      menu.action = { kind: 'skill', skill: skillId };
      menu.target = state.foes.findIndex((f) => f.hp > 0);
      return;
    }
    if (menu.mode === 'item') {
      const ids = Object.keys(state.inventory).filter((id) => state.inventory[id] > 0);
      const itemId = ids[menu.item];
      menu.mode = 'ally';
      menu.action = { kind: 'item', item: itemId };
      menu.target = 0;
      return;
    }
    if (menu.mode === 'target') {
      if (menu.target < 0) return;
      heroAct({ ...menu.action, target: menu.target });
      return;
    }
    if (menu.mode === 'ally') {
      const ally = activeHeroes()[menu.target];
      if (!ally) return;
      const item = menu.action.kind === 'item' ? ITEMS[menu.action.item] : null;
      const skill = menu.action.kind === 'skill' ? SKILLS[menu.action.skill] : null;
      // A Phoenix Tear only works on a fallen ally; everything else needs
      // a living one. The player picks again — nothing is consumed.
      if (item && item.revive) {
        if (ally.hp > 0) {
          setMessage(`${ally.name} is still standing — a ${item.name} is for the fallen.`);
          return;
        }
      } else if (ally.hp <= 0) {
        setMessage(`${ally.name} has fallen — use a Phoenix Tear.`);
        return;
      }
      if (skill && skill.kind === 'heal' && ally.hp <= 0) {
        setMessage(`${ally.name} has fallen — use a Phoenix Tear.`);
        return;
      }
      heroAct({ ...menu.action, target: menu.target });
    }
  }
  function cancelMenu() {
    const menu = state.menu;
    if (menu.mode === 'main') return;
    if (menu.mode === 'skill' || menu.mode === 'item') menu.mode = 'main';
    else menu.mode = menu.action && menu.action.kind === 'skill' && SKILLS[menu.action.skill] ? 'skill' : 'main';
    if (menu.mode === 'main') menu.action = null;
  }
  function moveMenu(dir) {
    const menu = state.menu;
    if (menu.mode === 'main' || menu.mode === 'skill' || menu.mode === 'item') {
      const items = menuItems();
      const key = menu.mode === 'main' ? 'index' : menu.mode;
      const count = items.length;
      menu[key] = ((menu[key] + dir) % count + count) % count;
    } else if (menu.mode === 'target') {
      const living = state.foes.map((f, i) => (f.hp > 0 ? i : -1)).filter((i) => i >= 0);
      if (living.length === 0) return;
      const at = living.indexOf(menu.target);
      menu.target = living[((at + dir) % living.length + living.length) % living.length];
    } else if (menu.mode === 'ally') {
      const count = activeHeroes().length;
      menu.target = ((menu.target + dir) % count + count) % count;
    }
  }
  function clickMenu(x, y) {
    if (state.phase !== 'command') return;
    const menu = state.menu;
    if (menu.mode === 'main' || menu.mode === 'skill' || menu.mode === 'item') {
      const items = menuItems();
      const relY = y - (MENU.y + 8);
      const row = Math.floor(relY / MENU.itemH);
      if (x >= MENU.x && x <= MENU.x + MENU.w && row >= 0 && row < items.length) {
        const key = menu.mode === 'main' ? 'index' : menu.mode;
        menu[key] = row;
        confirmMenu();
      }
      return;
    }
    if (menu.mode === 'target') {
      for (const foe of aliveFoes()) {
        const pos = foeSlotPos(foe.slot, state.foes.length);
        const scale = foe.scale || (foe.boss ? 5 : 4);
        const rows = SPRITES[foe.sprite] || [];
        const w = Math.max(14, ...rows.map((r) => r.length)) * scale;
        const h = rows.length * scale;
        if (Math.abs(x - pos.x) < Math.max(70, w / 2 + 10) && Math.abs(y - pos.y) < Math.max(80, h / 2 + 10)) {
          menu.target = foe.slot;
          confirmMenu();
          return;
        }
      }
    }
    if (menu.mode === 'ally') {
      // The hero rows on the right (painter.js draws them at BATTLE_HERO_Y).
      const actives = activeHeroes();
      for (let i = 0; i < actives.length; i += 1) {
        if (x >= 700 && x <= 940 && Math.abs(y - BATTLE_HERO_Y[i]) <= 34) {
          menu.target = i;
          confirmMenu();
          return;
        }
      }
    }
  }

  function update(dt, act) {
    for (const float of state.floats) float.t += dt * state.speed;
    state.floats = state.floats.filter((f) => f.t < f.dur);
    for (const foe of state.foes) if (foe.flash > 0) foe.flash = Math.max(0, foe.flash - dt * 4);
    // The spectacle decays on game time: particles fly, rings spread, the
    // flash and the shake fade, the name card burns out.
    const fdt = dt * state.speed;
    for (const p of state.fx.particles) {
      p.age += fdt;
      p.x += p.vx * fdt;
      p.y += p.vy * fdt;
      p.vy += 220 * fdt;
    }
    state.fx.particles = state.fx.particles.filter((p) => p.age < p.life);
    for (const r of state.fx.rings) r.age += fdt;
    state.fx.rings = state.fx.rings.filter((r) => r.age < r.life);
    for (const crack of state.fx.cracks) crack.age += fdt;
    state.fx.cracks = state.fx.cracks.filter((crack) => crack.age < crack.life);
    if (state.fx.flash > 0) state.fx.flash = Math.max(0, state.fx.flash - fdt * 0.35);
    if (state.fx.shake > 0) state.fx.shake = Math.max(0, state.fx.shake - fdt * 14);
    if (state.fx.bgElement) {
      state.fx.bgT += fdt;
      if (state.fx.bgT > 2.2) state.fx.bgElement = null;
    }
    if (state.fx.nameCard) {
      state.fx.nameCard.t += fdt;
      if (state.fx.nameCard.t >= state.fx.nameCard.dur) state.fx.nameCard = null;
    }
    for (const foe of state.foes) if (foe.knock > 0) foe.knock = Math.max(0, foe.knock - fdt * 2.5);

    if (state.phase === 'intro') {
      state.phaseT += dt;
      if (state.phaseT > 1.1) {
        state.phaseT = 0;
        startRound();
      }
      return null;
    }
    if (state.phase === 'command') {
      if (act.click) clickMenu(act.click.x, act.click.y);
      if (act.up) moveMenu(-1);
      if (act.down) moveMenu(1);
      if (act.left) moveMenu(-1);
      if (act.right) moveMenu(1);
      if (act.confirm) confirmMenu();
      if (act.cancel) cancelMenu();
      return null;
    }
    if (state.phase === 'anim') {
      const anim = state.anim;
      anim.t += dt;
      if (anim.events) {
        for (const ev of anim.events) {
          if (!ev.done && anim.t >= ev.at) {
            ev.done = true;
            ev.fn();
          }
        }
      }
      if (!anim.applied && anim.t >= anim.dur * 0.35) {
        anim.applied = true;
        if (anim.apply) anim.apply();
      }
      if (anim.t >= anim.dur) {
        state.anim = null;
        if (checkEnd()) return null;
        if (state.phase === 'anim') nextActor();
      }
      return null;
    }
    if (state.phase === 'foe') {
      state.phaseT += dt;
      if (state.phaseT > 0.55 && !state.anim) nextActor();
      return null;
    }
    if (state.phase === 'win') {
      state.phaseT += dt;
      if (state.phaseT > 2.2) {
        return { done: true, won: true, fled: state.fled, ...state.results };
      }
      return null;
    }
    if (state.phase === 'lose') {
      state.phaseT += dt;
      if (state.phaseT > 2.2) {
        return { done: true, won: false, fled: false, xp: 0, gold: 0, levelUps: [] };
      }
      return null;
    }
    return null;
  }

  return {
    state,
    update,
    setSpeed(n) {
      state.speed = n;
    },
    menuItems,
  };
}
