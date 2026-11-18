// ASHEN HOLLOW — the overworld: walking the map of Aldermere, talking to its
// people, and stumbling into the monsters that live in the tall grass.
// The field owns the map, the party's position, the quest state, the save
// and the dialog box; it never draws anything and never fights a battle.

import { TILE, MOVE_MS, ENCOUNTER_MIN_STEPS, ENCOUNTER_MAX_STEPS, SAVE_KEY } from './tuning.js';
import {
  buildMap, tileAt, isWalkable, regionAt, NPCS, CRYSTALS, linesFor,
  questFor, groupFor, PARTY_TEMPLATE, WILD_TILES, QUESTS, EQUIPMENT,
  equipmentBySource, applyEquipBonus, equipItem, grantXp, landmarkAt,
  CODEX_DIALOGUE,
} from './story.js';

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// The inn is the house at (14,22) — variant 4 — its four tiles.
const INN_TILES = new Set(['14,22', '15,22', '14,23', '15,23']);
const EQUIP_SLOTS = ['weapon', 'armor', 'accessory'];

function cloneParty() {
  return PARTY_TEMPLATE.map((hero) => {
    const c = { ...hero, skills: hero.skills.slice(), equipment: { ...hero.equipment } };
    applyEquipBonus(c);
    return c;
  });
}

/** Swap an active hero with a reserve hero, keeping exactly four active.
 *  Pure over the party array: returns true when a swap happened. */
export function swapActive(party, heroName) {
  const hero = party.find((h) => h.name === heroName);
  if (!hero) return false;
  if (hero.active) return false; // already active; pick a reserve to swap in
  const active = party.filter((h) => h.active);
  if (active.length === 0) return false;
  // The reserve swaps with the last active hero who is not Ash (the leader
  // never leaves the field).
  const out = [...active].reverse().find((h) => h.name !== 'Ash') || active[active.length - 1];
  if (!out || out.name === heroName) return false;
  out.active = false;
  hero.active = true;
  return true;
}

export function createField(dice) {
  const map = buildMap(dice);
  const state = {
    map,
    hero: { tx: 19, ty: 26, px: 19 * TILE, py: 26 * TILE, dir: 'down', moving: false, moveT: 0, fromX: 19, fromY: 26, toX: 19, toY: 26 },
    followers: [],
    // Independent optional puzzle: no dice, quest, inventory or save changes.
    braziers: {
      spots: [{ x: 11, y: 16 }, { x: 15, y: 16 }, { x: 19, y: 16 }],
      shrine: { x: 15, y: 13 }, lit: [], solved: false,
    },
    party: cloneParty(),
    gold: 20,
    inventory: { potion: 3, ether: 1, elixir: 1, phoenixTear: 1 },
    materials: {},
    equipmentOwned: {
      eq_ash_emberblade_i: true, eq_mira_galeweave_staff_i: true,
      eq_bram_gravehammer_i: true, eq_marksman_marrowbow_i: true,
      eq_assassin_griefsplitters_i: true, eq_healer_sunlit_staff_i: true,
    },
    crystals: new Set(),
    quests: {},
    questKills: {},
    harvested: new Set(),
    flags: {},
    dialog: null,
    banner: null,
    pendingBanner: null,
    saveToast: null,
    region: 'Aldermere',
    regionT: 0,
    steps: 0,
    encounterIn: dice.range(ENCOUNTER_MIN_STEPS, ENCOUNTER_MAX_STEPS),
    time: 0,
    battles: 0,
    walkTarget: null,
    partyOpen: false,
    partyMode: 'party',
    partyCursor: 0,
    partySelected: null,
    equipSlot: 0,
  };

  function activeHeroes() {
    return state.party.filter((h) => h.active);
  }

  function buildFollowers() {
    // The three active heroes after the leader walk behind, in party order.
    const actives = activeHeroes();
    state.followers = [];
    for (let i = 1; i < actives.length; i += 1) {
      const ty = state.hero.ty + i;
      state.followers.push({
        tx: state.hero.tx, ty, px: state.hero.tx * TILE, py: ty * TILE,
        dir: 'up', moving: false, moveT: 0,
        fromX: state.hero.tx, fromY: ty, toX: state.hero.tx, toY: ty,
        sprite: actives[i].sprite,
      });
    }
  }
  buildFollowers();

  function setBanner(text) {
    state.banner = { text, t: 0 };
  }
  function queueBanner(text) {
    // A quest reward banner waits until the dialog closes, so the player
    // reads the delivery lines first.
    if (state.dialog) state.pendingBanner = text;
    else setBanner(text);
  }

  function heroTile() {
    return { x: state.hero.tx, y: state.hero.ty };
  }

  function neighbours(x, y) {
    return [
      { x, y },
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
  }

  function npcNear() {
    for (const spot of neighbours(state.hero.tx, state.hero.ty)) {
      const npc = NPCS.find((n) => n.x === spot.x && n.y === spot.y);
      // Tilda hides in her house until the first crystal burns again.
      if (npc && npc.minCrystals && state.crystals.size < npc.minCrystals) continue;
      if (npc) return npc;
    }
    return null;
  }

  function shrineNear() {
    for (const spot of neighbours(state.hero.tx, state.hero.ty)) {
      const crystal = CRYSTALS.find((c) => c.shrine.x === spot.x && c.shrine.y === spot.y);
      if (crystal) return crystal;
    }
    return null;
  }

  function throneNear() {
    for (const spot of neighbours(state.hero.tx, state.hero.ty)) {
      if (tileAt(map, spot.x, spot.y) === 'X') return true;
    }
    return false;
  }

  function tileNear(ch) {
    for (const spot of neighbours(state.hero.tx, state.hero.ty)) {
      if (tileAt(map, spot.x, spot.y) === ch) return spot;
    }
    return null;
  }

  function landmarkNear() {
    for (const spot of neighbours(state.hero.tx, state.hero.ty)) {
      const lm = landmarkAt(spot.x, spot.y);
      if (lm) return lm;
    }
    return null;
  }

  // --- Quests ---------------------------------------------------------------
  function checkQuest(qid) {
    const quest = QUESTS[qid];
    const qs = state.quests[qid];
    if (!quest || !qs || qs.status !== 'active') return;
    const req = quest.req;
    let progress = 0;
    if (req.type === 'kill') progress = state.questKills[req.target] || 0;
    else if (req.type === 'talk') progress = state.flags.graveTalks || 0;
    else progress = qs.progress || 0;
    qs.progress = Math.min(progress, req.count);
    if (qs.progress >= req.count) completeQuest(qid);
  }

  function completeQuest(qid) {
    const quest = QUESTS[qid];
    const qs = state.quests[qid];
    if (!quest || !qs || qs.status !== 'active') return;
    qs.status = 'done';
    const levelUps = grantXp(state.party, quest.reward.xp);
    state.gold += quest.reward.gold;
    const gained = [];
    if (quest.reward.equipment) {
      state.equipmentOwned[quest.reward.equipment] = true;
      gained.push(EQUIPMENT[quest.reward.equipment].name);
    }
    // Every other tier whose source names this quest (or 'mystery' for the
    // hidden one) is granted too.
    const sourceKey = quest.hidden ? 'mystery' : qid;
    for (const id of equipmentBySource(sourceKey)) {
      if (id === quest.reward.equipment) continue;
      state.equipmentOwned[id] = true;
      gained.push(EQUIPMENT[id].name);
    }
    const parts = [`Quest complete: ${quest.name}! +${quest.reward.xp} XP`];
    if (quest.reward.gold) parts.push(`+${quest.reward.gold} gold`);
    if (gained.length) parts.push(`Gained: ${gained.join(', ')}`);
    if (levelUps.length) parts.push(levelUps.map((l) => `${l.name} reaches Lv${l.level}`).join(', '));
    queueBanner(parts.join(' — '));
  }

  /** A battle ended: count the slain for kill quests, then check them. */
  function recordKills(slain) {
    for (const id of slain || []) {
      state.questKills[id] = (state.questKills[id] || 0) + 1;
    }
    checkQuest('sq_gale_bells');
  }

  /** Harvest one hidden item from a tile (tide seals, gravewax, lanterns). */
  function collectTile(tile, qid, itemName) {
    const key = `${tile.x},${tile.y}`;
    if (state.harvested.has(key)) return false;
    const qs = state.quests[qid];
    if (!qs || qs.status !== 'active') return false;
    state.harvested.add(key);
    qs.progress = (qs.progress || 0) + 1;
    setBanner(`Found ${itemName} (${qs.progress}/${QUESTS[qid].req.count}).`);
    checkQuest(qid);
    return true;
  }

  // --- The forge ------------------------------------------------------------
  /** The first blacksmith item the party can forge right now, or null.
   *  Needs 3x its monster material, and the previous tier owned for II/III. */
  function forgeable() {
    for (const id of Object.keys(EQUIPMENT)) {
      const item = EQUIPMENT[id];
      if (item.sourceKey !== 'blacksmith' || !item.forge) continue;
      if (state.equipmentOwned[id]) continue;
      if ((state.materials[item.forge.material] || 0) < item.forge.count) continue;
      if (item.tier > 1) {
        const prev = `${id.slice(0, id.lastIndexOf('_'))}_${item.tier === 2 ? 'i' : 'ii'}`;
        if (!state.equipmentOwned[prev]) continue;
      }
      return id;
    }
    return null;
  }

  function forgeOne() {
    const id = forgeable();
    if (!id) return null;
    const item = EQUIPMENT[id];
    state.materials[item.forge.material] -= item.forge.count;
    state.equipmentOwned[id] = true;
    return item;
  }

  // --- Interaction ----------------------------------------------------------
  function kindleBrazier(index) {
    const puzzle = state.braziers;
    if (puzzle.solved) return;
    if (index !== puzzle.lit.length) {
      puzzle.lit = [];
      setBanner('Wrong rune — all braziers go dark. Begin with I.');
      return;
    }
    puzzle.lit.push(index);
    puzzle.solved = puzzle.lit.length === 3;
    setBanner(puzzle.solved ? 'Three flames kindle. A shrine chest appears!' : 'Rune kindled. Follow I → II → III.');
  }

  function interact() {
    const brazier = state.braziers.spots.findIndex((b) =>
      b.x === state.hero.tx + DIRS[state.hero.dir].x && b.y === state.hero.ty + DIRS[state.hero.dir].y);
    if (brazier >= 0) { kindleBrazier(brazier); return null; }
    const npc = npcNear();
    if (npc) {
      // The Gravekeeper counts his talks BEFORE the lines are computed, so
      // the displayed talk matches the count; the quest completes after.
      if (npc.id === 'gravekeeper' && state.crystals.size >= 2) {
        if (!state.quests.mq_third_ember_shadow) {
          state.quests.mq_third_ember_shadow = { status: 'active', progress: 0 };
        }
        state.flags.graveTalks = (state.flags.graveTalks || 0) + 1;
        state.quests.mq_third_ember_shadow.progress = state.flags.graveTalks;
      }
      const lines = linesFor(npc.id, state.crystals.size, {
        quests: state.quests, flags: state.flags, kingDefeated: state.flags.kingDefeated,
      });
      // Pip's first talk: +2 potions, and he names the rare items the party
      // already carries (Elixir, Phoenix Tear) so the player knows them.
      if (npc.id === 'pip' && !state.flags.pipGift) {
        state.flags.pipGift = true;
        state.inventory.potion += 2;
        lines.push('Pip presses two potions into your hand. "You already carry an Elixir and a Phoenix Tear — spend them wisely. An Elixir mends a hero whole; a Phoenix Tear wakes the fallen."');
      }
      // Braska forges the first thing he can, one item per talk.
      if (npc.id === 'braska') {
        const forged = forgeOne();
        if (forged) {
          lines.push(`Braska takes your ${forged.forge.materialName} and hammers it into a ${forged.name}. "Wear it well."`);
          setBanner(`Braska forges ${forged.name}!`);
        }
      }
      // Edris hands over the Sealed Confession on the first talk.
      if (npc.id === 'edris' && !state.quests.sq_cinder_letter) {
        state.quests.sq_cinder_letter = { status: 'active', progress: 0 };
        state.flags.sealedConfession = true;
      }
      // Odo receives the letter: the delivery completes.
      if (npc.id === 'odo' && state.quests.sq_cinder_letter
        && state.quests.sq_cinder_letter.status === 'active' && state.flags.sealedConfession) {
        state.quests.sq_cinder_letter.progress = 1;
        state.flags.sealedConfession = false;
        completeQuest('sq_cinder_letter');
      }
      // The Gravekeeper's third talk, after two crystals, completes the
      // mystery quest (the lines above already told the player).
      if (npc.id === 'gravekeeper') checkQuest('mq_third_ember_shadow');
      // Quest givers accept their quest on the first talk (after the intro
      // lines above were computed, so the intro still shows).
      const quest = Object.values(QUESTS).find((qq) => qq.giver === npc.id);
      if (quest && !state.quests[quest.id] && !quest.hidden) {
        state.quests[quest.id] = { status: 'active', progress: 0 };
      }
      state.dialog = { name: npc.name, lines, index: 0 };
      return null;
    }
    const crystal = shrineNear();
    if (crystal) {
      if (state.crystals.has(crystal.id)) {
        setBanner(`The ${crystal.name} already burns. The shrine is quiet now.`);
        return null;
      }
      return { type: 'battle', enemies: [crystal.guardian], boss: true, crystal: crystal.id, final: false, sourceKey: crystal.id };
    }
    if (throneNear()) {
      if (state.crystals.size < 3) {
        setBanner(`Sealed. The Hollow King waits behind ${3 - state.crystals.size} more crystal${state.crystals.size === 2 ? '' : 's'}.`);
        return null;
      }
      return { type: 'battle', enemies: ['hollowking'], boss: true, crystal: null, final: true, sourceKey: null };
    }
    const hearth = tileNear('K');
    if (hearth) {
      saveGame();
      state.saveToast = { text: 'Progress saved', t: 0 };
      setBanner('Progress saved — the hearth remembers you.');
      return null;
    }
    const inn = neighbours(state.hero.tx, state.hero.ty).some((s) => INN_TILES.has(`${s.x},${s.y}`));
    if (inn) {
      for (const hero of activeHeroes()) {
        hero.hp = hero.maxHp;
        hero.mp = hero.maxMp;
        hero.poison = 0;
      }
      state.dialog = {
        name: 'The Inn',
        lines: [CODEX_DIALOGUE.maren.rest_dialogue, 'The party rests. HP and MP are fully restored.'],
        index: 0,
      };
      return null;
    }
    const flood = tileNear('P');
    if (flood && collectTile(flood, 'sq_tide_bloodwater', 'a Broken Tide Shrine Seal')) return null;
    const grave = tileNear('G');
    if (grave && collectTile(grave, 'sq_gravewax', 'Cold Gravewax')) return null;
    const lantern = tileNear('L');
    if (lantern && collectTile(lantern, 'sq_lost_lantern', 'a Watch Lantern')) return null;
    const lm = landmarkNear();
    if (lm) {
      if (lm.type === 'spirittree') {
        if (state.quests.mq_third_ember_shadow && state.quests.mq_third_ember_shadow.status === 'done') {
          return { type: 'battle', enemies: ['griefbelow'], boss: true, crystal: null, final: false, sourceKey: 'hidden' };
        }
        state.dialog = {
          name: 'The Great Spirit Tree',
          lines: ['The great spirit tree towers above you, its canopy lost in the dark. Its roots drink from a grave that has no stone.', 'Something beneath it breathes. No spirit dares to sing here.'],
          index: 0,
        };
        return null;
      }
      if (lm.type === 'cave') {
        state.dialog = {
          name: 'The Cave Mouth',
          lines: ['The cave mouth gapes, black as a throat. Stalactites hang like teeth, and two faint eyes glow in the dark within.', 'The cave wraiths nest here. Sister Maelin would want to know.'],
          index: 0,
        };
        return null;
      }
    }
    return null;
  }

  function startMove(walker, toX, toY, dir) {
    walker.fromX = walker.tx;
    walker.fromY = walker.ty;
    walker.toX = toX;
    walker.toY = toY;
    walker.dir = dir;
    walker.moving = true;
    walker.moveT = 0;
  }

  function finishMove(walker) {
    walker.tx = walker.toX;
    walker.ty = walker.toY;
    walker.px = walker.tx * TILE;
    walker.py = walker.ty * TILE;
    walker.moving = false;
  }

  function advanceMove(walker, dt) {
    if (!walker.moving) return;
    walker.moveT += dt * 1000;
    const t = Math.min(walker.moveT / MOVE_MS, 1);
    walker.px = (walker.fromX + (walker.toX - walker.fromX) * t) * TILE;
    walker.py = (walker.fromY + (walker.toY - walker.fromY) * t) * TILE;
    if (t >= 1) finishMove(walker);
  }

  function tryStep(dx, dy) {
    if (dx === 0 && dy === 0) return false;
    const dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
    const toX = state.hero.tx + dx;
    const toY = state.hero.ty + dy;
    state.hero.dir = dir;
    if (!isWalkable(map, toX, toY)) return false;
    // Every follower steps into the tile the walker ahead of it just left.
    const trail = [{ x: state.hero.tx, y: state.hero.ty }];
    for (const f of state.followers) trail.push({ x: f.tx, y: f.ty });
    startMove(state.hero, toX, toY, dir);
    for (let i = 0; i < state.followers.length; i += 1) {
      startMove(state.followers[i], trail[i].x, trail[i].y, state.followers[i].dir);
    }
    return true;
  }

  // --- The Party overlay ------------------------------------------------------
  const HERO_EQ_KEY = { Ash: 'ash', Mira: 'mira', Bram: 'bram', Rowan: 'marksman', Vex: 'assassin', Liora: 'healer' };

  function cycleEquipment(heroIndex, slotIndex) {
    const hero = state.party[heroIndex];
    const slot = EQUIP_SLOTS[slotIndex];
    const key = HERO_EQ_KEY[hero.name];
    const equippedByOther = new Set();
    for (const h of state.party) {
      if (h === hero) continue;
      if (h.equipment[slot]) equippedByOther.add(h.equipment[slot]);
    }
    const owned = Object.keys(state.equipmentOwned)
      .filter((id) => EQUIPMENT[id].slot === slot && id.startsWith(`eq_${key}_`) && !equippedByOther.has(id))
      .sort();
    const options = [null, ...owned];
    const idx = (options.indexOf(hero.equipment[slot]) + 1) % options.length;
    const next = options[idx];
    equipItem(hero, slot, next);
    if (next) setBanner(`${hero.name} equips ${EQUIPMENT[next].name}.`);
    else setBanner(`${hero.name} unequips the ${slot}.`);
    state.pendingSave = serializeSave();
  }

  function toggleParty() {
    state.partyOpen = !state.partyOpen;
    if (state.partyOpen) {
      state.partyMode = 'party';
      state.partyCursor = 0;
      state.partySelected = null;
    }
  }

  function update(dt, act) {
    state.time += dt;
    if (state.banner) {
      state.banner.t += dt;
      if (state.banner.t > 3) state.banner = null;
    }
    if (state.saveToast) {
      state.saveToast.t += dt;
      if (state.saveToast.t > 3) state.saveToast = null;
    }
    const region = regionAt(state.hero.tx, state.hero.ty);
    if (region !== state.region) {
      state.region = region;
      state.regionT = 0;
      setBanner(region);
    }
    state.regionT += dt;

    // The Party overlay freezes the field: dirs move the cursor, confirm
    // swaps or equips, Tab toggles party/equipment, Esc closes. Tab opens
    // it from the field; while open, P does not pause the game.
    if (act.partyToggle && !state.partyOpen) {
      toggleParty();
      return null;
    }
    if (state.partyOpen) {
      if (act.cancel) {
        state.partyOpen = false;
        state.partySelected = null;
        return null;
      }
      if (act.partyToggle) {
        state.partyMode = state.partyMode === 'party' ? 'equip' : 'party';
        state.partySelected = null;
        return null;
      }
      if (act.dir.y !== 0) {
        state.partyCursor = (((state.partyCursor + act.dir.y) % 6) + 6) % 6;
        return null;
      }
      if (state.partyMode === 'equip' && act.dir.x !== 0) {
        state.equipSlot = (((state.equipSlot + act.dir.x) % 3) + 3) % 3;
        return null;
      }
      if (act.confirm) {
        if (state.partyMode === 'party') {
          const hero = state.party[state.partyCursor];
          if (state.partySelected === null) {
            if (!hero.active) state.partySelected = state.partyCursor;
          } else {
            const selected = state.party[state.partySelected];
            if (hero.active && selected && !selected.active) {
              selected.active = true;
              hero.active = false;
              buildFollowers();
              state.pendingSave = serializeSave();
              setBanner(`${selected.name} joins the field. ${hero.name} waits in Aldermere.`);
            }
            state.partySelected = null;
          }
        } else {
          cycleEquipment(state.partyCursor, state.equipSlot);
        }
      }
      return null;
    }

    if (state.dialog) {
      if (act.confirm || act.click) {
        state.dialog.index += 1;
        if (state.dialog.index >= state.dialog.lines.length) {
          state.dialog = null;
          if (state.pendingBanner) {
            setBanner(state.pendingBanner);
            state.pendingBanner = null;
          }
        }
      }
      return null;
    }

    advanceMove(state.hero, dt);
    for (const f of state.followers) advanceMove(f, dt);
    if (state.hero.moving) return null;

    if (act.click) {
      // A click is handled on its own: on a nearby interactable it
      // interacts; on open ground it sets a walk target. (A pointerdown
      // also raises a confirm, which must NOT swallow the click.)
      const tx = Math.floor(act.click.x / TILE);
      const ty = Math.floor(act.click.y / TILE);
      const npc = NPCS.find((n) => n.x === tx && n.y === ty
        && !(n.minCrystals && state.crystals.size < n.minCrystals));
      const crystal = CRYSTALS.find((c) => c.shrine.x === tx && c.shrine.y === ty);
      const tile = tileAt(map, tx, ty);
      const lm = landmarkAt(tx, ty);
      const isInn = INN_TILES.has(`${tx},${ty}`);
      const near = Math.abs(tx - state.hero.tx) + Math.abs(ty - state.hero.ty) <= 1;
      if (near && state.braziers.spots.some((b) => b.x === tx && b.y === ty)) {
        kindleBrazier(state.braziers.spots.findIndex((b) => b.x === tx && b.y === ty));
        return null;
      }
      if (near && (npc || crystal || tile === 'X' || tile === 'K' || tile === 'P'
        || tile === 'G' || tile === 'L' || lm || isInn)) return interact();
      if (isWalkable(map, tx, ty)) state.walkTarget = { x: tx, y: ty };
      return null;
    }

    if (act.confirm) return interact();

    let dx = act.dir.x;
    let dy = act.dir.y;
    if (dx !== 0 || dy !== 0) state.walkTarget = null;
    if (dx === 0 && dy === 0 && state.walkTarget) {
      const t = state.walkTarget;
      if (t.x === state.hero.tx && t.y === state.hero.ty) {
        state.walkTarget = null;
      } else if (t.x !== state.hero.tx) {
        dx = Math.sign(t.x - state.hero.tx);
      } else {
        dy = Math.sign(t.y - state.hero.ty);
      }
    }
    if (dx !== 0 && dy !== 0) dy = 0;
    if (dx === 0 && dy === 0) return null;

    if (tryStep(dx, dy)) {
      const tile = tileAt(map, state.hero.toX, state.hero.toY);
      if (WILD_TILES.has(tile)) {
        state.steps += 1;
        if (state.steps >= state.encounterIn) {
          state.steps = 0;
          state.encounterIn = dice.range(ENCOUNTER_MIN_STEPS, ENCOUNTER_MAX_STEPS);
          state.battles += 1;
          return { type: 'encounter', enemies: groupFor(state.region, dice) };
        }
      }
    }
    return null;
  }

  function addCrystal(id) {
    state.crystals.add(id);
    const crystal = CRYSTALS.find((c) => c.id === id);
    setBanner(`${crystal.name} claimed! ${state.crystals.size}/3 Ember Crystals burn again.`);
    state.pendingSave = serializeSave();
  }

  // --- Save / load ------------------------------------------------------------
  /** Mark the current state for saving: boot.js writes pendingSave to
   *  localStorage after the update. (The hearthfire calls this directly.) */
  function saveGame() {
    state.pendingSave = serializeSave();
  }

  function serializeSave() {
    return {
      v: 1,
      crystals: [...state.crystals],
      heroes: state.party.map((h) => ({
        name: h.name, level: h.level, xp: h.xp, hp: h.hp, maxHp: h.maxHp,
        mp: h.mp, maxMp: h.maxMp, atk: h.atk, def: h.def, spd: h.spd,
        active: h.active, equipment: { ...h.equipment },
        equipBonus: h.equipBonus ? { ...h.equipBonus } : null,
      })),
      inventory: { ...state.inventory },
      materials: { ...state.materials },
      equipmentOwned: { ...state.equipmentOwned },
      quests: JSON.parse(JSON.stringify(state.quests)),
      questKills: { ...state.questKills },
      harvested: [...state.harvested],
      flags: { ...state.flags },
      gold: state.gold,
      time: state.time,
      battles: state.battles,
      hero: { tx: state.hero.tx, ty: state.hero.ty },
    };
  }

  function applySave(save) {
    if (!save || save.v !== 1 || !Array.isArray(save.heroes)) return false;
    state.crystals = new Set(save.crystals || []);
    for (const sh of save.heroes) {
      const hero = state.party.find((h) => h.name === sh.name);
      if (!hero) continue;
      Object.assign(hero, {
        level: sh.level, xp: sh.xp, hp: sh.hp, maxHp: sh.maxHp, mp: sh.mp, maxMp: sh.maxMp,
        atk: sh.atk, def: sh.def, spd: sh.spd, active: sh.active,
        equipment: { ...sh.equipment }, equipBonus: sh.equipBonus ? { ...sh.equipBonus } : null,
      });
    }
    state.inventory = { ...save.inventory };
    state.materials = { ...save.materials };
    state.equipmentOwned = { ...save.equipmentOwned };
    state.quests = JSON.parse(JSON.stringify(save.quests || {}));
    state.questKills = { ...save.questKills };
    state.harvested = new Set(save.harvested || []);
    state.flags = { ...save.flags };
    state.gold = save.gold;
    state.time = save.time || 0;
    state.battles = save.battles || 0;
    state.hero.tx = save.hero.tx;
    state.hero.ty = save.hero.ty;
    state.hero.px = save.hero.tx * TILE;
    state.hero.py = save.hero.ty * TILE;
    state.hero.moving = false;
    state.dialog = null;
    state.partyOpen = false;
    buildFollowers();
    return true;
  }

  function respawn() {
    state.hero.tx = 19;
    state.hero.ty = 26;
    state.hero.px = 19 * TILE;
    state.hero.py = 26 * TILE;
    state.hero.dir = 'down';
    state.hero.moving = false;
    for (const hero of state.party) {
      if (hero.hp <= 0) hero.hp = Math.max(1, Math.round(hero.maxHp * 0.5));
    }
    buildFollowers();
  }

  // Rowan and Vex wait in the village until the player swaps them in.
  setBanner('Rowan and Vex wait in Aldermere — reserves gain 50% XP.');

  return {
    state,
    update,
    heroTile,
    addCrystal,
    quest() {
      return questFor(state.crystals.size);
    },
    activeHeroes,
    recordKills,
    checkQuest,
    completeQuest,
    serializeSave,
    applySave,
    respawn,
    toggleParty,
    forgeable,
    swapActive(name) {
      const ok = swapActive(state.party, name);
      if (ok) {
        buildFollowers();
        state.pendingSave = serializeSave();
      }
      return ok;
    },
  };
}
