// ASHEN HOLLOW — the story's data: the map, its dark biomes, the people,
// the monsters, the skills, the items and the pixel sprites. No code here
// draws anything; painter.js turns this data into pictures, field.js and
// combat.js turn it into rules. Every name, place and creature is original
// to this game.

export const MAP_W = 40;
export const MAP_H = 30;

/** Tile legend: '.' scorched meadow, ',' wild grass, 'T' tree/crag,
 *  't' dead tree, '~' water, '#' path, 'H' house, 'S' shrine, 'X' throne,
 *  'F' flowers/mushrooms, 'R' rock/bone, 'B' bridge, 'G' tombstone,
 *  'U' ruin, 'L' lantern, 'W' well, 'C' cart, 'K' hearthfire (save point),
 *  'P' poison flood (the Venomfen overflowing its banks). */
export const WALKABLE = new Set(['.', ',', '#', 'F', 'B', 'S', 'X', 'K', 'P']);
export const WILD_TILES = new Set([',']);

/** The dark biomes of Ashen Hollow. Every tile belongs to one: the village
 *  is gothic dark, the north-west is a cave of crags, the north-east a
 *  wraithwood, the east a poison fen, the centre a bonefield, and the far
 *  north the scorched throne. */
export function biomeAt(x, y) {
  if (y <= 4 && x >= 16 && x <= 23) return 'throne';
  if (y <= 8 && x <= 13) return 'crags';
  if (y <= 8) return 'wraithwood';
  if (x >= 28 && y >= 9) return 'venomfen';
  if (x <= 13 && y >= 21) return 'village';
  return 'bonefields';
}

export function regionAt(x, y) {
  const b = biomeAt(x, y);
  if (b === 'throne') return 'Ashen Throne';
  if (b === 'crags') return 'Howling Crags';
  if (b === 'wraithwood') return 'Wraithwood';
  if (b === 'venomfen') return 'Venomfen';
  if (b === 'village') return 'Aldermere';
  return 'Bonefields';
}

/** Build the 40x30 map of Ashen Hollow. Deterministic: the same dice seed
 *  always dresses the same meadows. */
export function buildMap(dice) {
  const tiles = [];
  for (let y = 0; y < MAP_H; y += 1) {
    tiles.push(new Array(MAP_W).fill('.'));
  }
  const variants = {};
  const set = (x, y, ch) => {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) tiles[y][x] = ch;
  };
  // Border forest.
  for (let x = 0; x < MAP_W; x += 1) {
    set(x, 0, 'T');
    set(x, MAP_H - 1, 'T');
  }
  for (let y = 0; y < MAP_H; y += 1) {
    set(0, y, 'T');
    set(MAP_W - 1, y, 'T');
  }
  // The north band: crags west, wraithwood east, broken by the throne road.
  for (let y = 1; y <= 4; y += 1) {
    for (let x = 2; x <= 37; x += 1) {
      if (x === 19 || x === 20) continue;
      if (y === 2 && x >= 18 && x <= 21) continue;
      set(x, y, 'T');
    }
  }
  // The Venomfen: a poison river east, with a wooden bridge across it.
  for (let y = 15; y <= 21; y += 1) {
    for (let x = 30; x <= 36; x += 1) {
      const edge = (y === 15 || y === 21 || x === 30 || x === 36) && dice.chance(0.5);
      if (!edge) set(x, y, '~');
    }
  }
  for (let x = 29; x <= 37; x += 1) set(x, 18, 'B');
  // Roads: the throne road north-south, the market road east-west.
  for (let y = 3; y <= 28; y += 1) {
    set(19, y, '#');
    set(20, y, '#');
  }
  for (let x = 3; x <= 36; x += 1) {
    set(x, 11, '#');
    set(x, 12, '#');
  }
  // Aldermere village, south-west: five houses, no two alike. Each 2x2
  // block carries a variant id so the painter can dress it differently.
  const house = (hx, hy, v) => {
    set(hx, hy, 'H');
    set(hx + 1, hy, 'H');
    set(hx, hy + 1, 'H');
    set(hx + 1, hy + 1, 'H');
    variants[`${hx},${hy}`] = v;
  };
  house(4, 22, 0);
  house(9, 22, 1);
  house(4, 26, 2);
  house(12, 22, 3);
  house(14, 22, 4);
  // Village props: a well, a cart, street lanterns along the market road.
  set(7, 21, 'W');
  set(11, 23, 'C');
  set(6, 10, 'L');
  set(14, 10, 'L');
  set(26, 10, 'L');
  set(34, 10, 'L');
  // The graveyard, east of the village — six tombstones, so Della Vane's
  // gravewax (sq_gravewax) can be gathered one per stone. The Gravekeeper
  // stands in the middle, at (14,27); Silas digs at the western edge.
  set(12, 27, 'G');
  set(13, 27, 'G');
  set(15, 27, 'G');
  set(16, 27, 'G');
  set(17, 27, 'G');
  set(18, 27, 'G');
  // Cursed ruins standing in the Bonefields.
  set(16, 16, 'U');
  set(24, 14, 'U');
  set(28, 20, 'U');
  // Shrines and the throne.
  set(5, 5, 'S');
  set(34, 7, 'S');
  set(34, 24, 'S');
  set(19, 2, 'X');
  set(20, 2, 'X');
  // Hearthfires (save points): one in the village, one by each shrine.
  set(12, 24, 'K');
  set(6, 6, 'K');
  set(33, 8, 'K');
  set(33, 23, 'K');
  // The poison flood: the Venomfen overflowing its banks westward, sick
  // green water pooling onto the land. Wade it to pull out the Broken
  // Tide Shrine Seals (sq_tide_bloodwater).
  for (let y = 17; y <= 19; y += 1) {
    for (let x = 24; x <= 28; x += 1) set(x, y, 'P');
  }
  set(29, 16, 'P');
  set(29, 17, 'P');
  for (let x = 25; x <= 27; x += 1) set(x, 20, 'P');
  // The giant landmarks (LANDMARKS) stand on tree tiles, so the painter
  // can find them; drawLandmark paints the landmark art over them.
  for (const lm of LANDMARKS) {
    for (let y = lm.y; y < lm.y + lm.h; y += 1) {
      for (let x = lm.x; x < lm.x + lm.w; x += 1) set(x, y, 'T');
    }
  }
  // Wild grass meadows where monsters roam, and ember flowers / pale
  // mushrooms where they do not. Dead trees rise out of the dark meadows.
  for (let i = 0; i < 150; i += 1) {
    const x = 2 + dice.int(MAP_W - 4);
    const y = 5 + dice.int(MAP_H - 10);
    if (tiles[y][x] === '.') set(x, y, dice.chance(0.75) ? ',' : 'F');
  }
  for (let i = 0; i < 12; i += 1) {
    const x = 2 + dice.int(MAP_W - 4);
    const y = 2 + dice.int(MAP_H - 4);
    if (tiles[y][x] === '.') set(x, y, 'R');
  }
  for (let i = 0; i < 10; i += 1) {
    const x = 2 + dice.int(MAP_W - 4);
    const y = 9 + dice.int(MAP_H - 13);
    if (tiles[y][x] === '.') set(x, y, 't');
  }
  return { w: MAP_W, h: MAP_H, tiles, variants, landmarks: LANDMARKS };
}

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return 'T';
  return map.tiles[y][x];
}

export function isWalkable(map, x, y) {
  return WALKABLE.has(tileAt(map, x, y));
}

export const CRYSTALS = [
  { id: 'gale', name: 'Gale Crystal', shrine: { x: 5, y: 5 }, guardian: 'galehowl', hint: 'Howling Crags, north-west' },
  { id: 'dawn', name: 'Dawn Crystal', shrine: { x: 34, y: 7 }, guardian: 'dawnwing', hint: 'Wraithwood, north-east' },
  { id: 'tide', name: 'Tide Crystal', shrine: { x: 34, y: 24 }, guardian: 'tidecoil', hint: 'Venomfen, south-east' },
];

export function questFor(crystalCount) {
  if (crystalCount === 0) return 'Gather the 3 Ember Crystals — start at the Gale Shrine, Howling Crags, north-west';
  if (crystalCount === 1) return '1/3 crystals — the Dawn Shrine waits in the Wraithwood, north-east';
  if (crystalCount === 2) return '2/3 crystals — the Tide Shrine waits in the Venomfen, south-east';
  return 'All 3 crystals! Face the Hollow King at the Ashen Throne, far north';
}

export const NPCS = [
  { id: 'maren', name: 'Elder Maren', x: 7, y: 24, sprite: 'elder' },
  { id: 'pip', name: 'Pip', x: 10, y: 25, sprite: 'pip' },
  { id: 'wren', name: 'Wren', x: 33, y: 18, sprite: 'wren' },
  { id: 'odo', name: 'Hermit Odo', x: 6, y: 7, sprite: 'odo' },
  { id: 'torin', name: 'Torchwarden Torin', x: 11, y: 24, sprite: 'torin' },
  // Braska Veld, the blacksmith (Codex dialogue package): forges equipment
  // from monster materials at his anvil.
  { id: 'braska', name: 'Braska Veld', x: 16, y: 23, sprite: 'braska' },
  { id: 'silas', name: 'Gravedigger Silas', x: 11, y: 27, sprite: 'silas' },
  // Tilda hid inside her house until the first crystal burns again.
  { id: 'tilda', name: 'Tilda', x: 3, y: 25, sprite: 'tilda', minCrystals: 1 },
  // Sella Rook, a newcomer to the village (Codex dialogue package).
  { id: 'sella', name: 'Sella Rook', x: 8, y: 26, sprite: 'sella' },
  // The Hermes v2 quest givers (dev/hermes-quests-equipment.json).
  { id: 'maelin', name: 'Sister Maelin', x: 6, y: 25, sprite: 'maelin' },
  // Odran ferries the Venomfen crossing, by the bridge.
  { id: 'odran', name: 'Ferryman Odran', x: 28, y: 18, sprite: 'odran' },
  { id: 'della', name: 'Della Vane', x: 16, y: 25, sprite: 'della' },
  { id: 'tovin', name: 'Tovin Reed', x: 18, y: 26, sprite: 'tovin' },
  { id: 'edris', name: 'Edris Quill', x: 9, y: 23, sprite: 'edris' },
  // The silent gravekeeper, in the middle of the graveyard: the mystery
  // quest (mq_third_ember_shadow) — talk to him 3x after 2 crystals.
  { id: 'gravekeeper', name: 'The Gravekeeper', x: 14, y: 27, sprite: 'gravekeeper' },
];

/* CODEX-DIALOGUE-START */
/** Village dialogue, generated from the Codex dialogue package
 *  (dev/codex-npc-dialogue.json) — the canonical source. Two lines per
 *  progress state, plus a vague mystery hint and a rest line each.
 *  The inn rest shows Maren's rest line. */
export const CODEX_DIALOGUE = {
  "maren": {
    "name": "Elder Maren",
    "role": "village elder",
    "dialogue": {
      "0_crystals": [
        "The ash wind carries the Hollow King's whisper, and Aldermere's graves answer. Bring the three Ember Crystals before our last fires die.",
        "Gale, Dawn, and Tide were entrusted to distant shrines, each guarded by a wound the old songs refuse to name."
      ],
      "1_crystal": [
        "One ember burns in your keeping, yet the village still shivers beneath a roof of black clouds. Two more must be claimed before the King stirs.",
        "Do not mistake a single victory for salvation; the Hollow King has buried armies beneath our fields."
      ],
      "2_crystals": [
        "Two crystals throb like hearts in your pack, and every dog in Aldermere howls at dusk. Find the last ember, then march on the throne of bone.",
        "The final shrine lies where rain falls upward; return with its light, or let the darkness inherit our names."
      ],
      "king_defeated": [
        "The Hollow King is ash upon the wind, but his silence feels heavier than his reign. We will rebuild with hands that still remember the dead.",
        "Aldermere survives this night, though no elder should promise the dawn will be kind."
      ]
    },
    "mystery_hint": "Beneath the oldest well, a bell rings whenever someone lies about the first fire.",
    "rest_dialogue": "Sleep at the inn while you can; the straw is thin, but nightmares find less room when the living breathe nearby."
  },
  "pip": {
    "name": "Pip",
    "role": "potion seller",
    "dialogue": {
      "0_crystals": [
        "My bottles rattle whenever the Hollow King turns in his sleep, and lately they have not stopped. Bring those three crystals before my shelves become tombstones.",
        "I sell courage by the swallow, but courage will not mend a soul burned hollow; seek Gale, Dawn, and Tide while the roads remain open."
      ],
      "1_crystal": [
        "One crystal already glows in your satchel, bright enough to spoil my mixtures. Two more, and perhaps I can brew something that keeps the King from smelling your fear.",
        "Mind the marsh shrine; its water remembers every wound, and it may charge interest in blood."
      ],
      "2_crystals": [
        "Two embers means you are close, which is when travelers drink too fast and die proud. Find the last crystal, then save a draught for the Hollow King's welcome.",
        "If your shadow starts moving before you do, pour salt over your boots and keep walking."
      ],
      "king_defeated": [
        "The King is gone, and my potions have stopped curdling at midnight. I will name a new tonic after you, though it may taste of smoke.",
        "Victory leaves a bitter aftertaste; come back when the shaking starts, and I will pretend it is only the fever."
      ]
    },
    "mystery_hint": "Ask for the empty vial with no label; it once held a color the moon could not see.",
    "rest_dialogue": "An inn bed will not cure a curse, but a warm cup and a locked door can postpone one until morning."
  },
  "torin": {
    "name": "Torchwarden Torin",
    "role": "lantern keeper",
    "dialogue": {
      "0_crystals": [
        "I keep Aldermere's lanterns lit, yet their flames lean toward the Hollow King's road. Gather the three Ember Crystals before the dark learns our doorways.",
        "Gale rests beyond the cliff bells, Dawn beneath the red chapel, and Tide where drowned stones still glow; carry no unshielded flame there."
      ],
      "1_crystal": [
        "That ember shines like a captive star, but one light cannot guard a whole village. Two more must join it before I can relight the watchtowers.",
        "Every lantern you pass on the north road has been dead for thirteen years; if one burns, do not answer its call."
      ],
      "2_crystals": [
        "Two crystals now answer your hand, and the tower flames burn blue. Claim the last ember, then aim their combined fire at the Hollow King's crown.",
        "When the final shrine opens, extinguish your torch; some doors only reveal themselves to travelers who admit they are afraid."
      ],
      "king_defeated": [
        "The Hollow King has fallen, and our lanterns burn straight again. I will keep watch until the smoke clears, even if the smoke is all that remains.",
        "No shadow crossed the square tonight; I had forgotten how empty safety could feel."
      ]
    },
    "mystery_hint": "Count the lanterns after midnight; one more glows in the alley where no wall stands.",
    "rest_dialogue": "Rest at the inn and leave your boots by the hearth; a watchman sleeps poorly when his feet remember the road."
  },
  "braska": {
    "name": "Braska Veld",
    "role": "blacksmith",
    "dialogue": {
      "0_crystals": [
        "Iron cracks when the Hollow King dreams, and my forge has begun to scream. Bring me Gale, Dawn, and Tide, so I can hammer a weapon worthy of his end.",
        "The crystals are not ore; they are old promises hardened by fire, and promises cut deeper than steel."
      ],
      "1_crystal": [
        "One ember has warmed my anvil, but the metal still remembers winter. Two more will let me shape a blade that does not bend before the King's throne.",
        "Do not polish the crystal you found; every shine draws a hungry thing from the dark."
      ],
      "2_crystals": [
        "Two embers ring beneath my hammer, and the sound wakes things under the smithy floor. Find the last before those things learn my name.",
        "Bring the final crystal straight to the forge; the Hollow King must be faced with a weapon born in Aldermere's grief."
      ],
      "king_defeated": [
        "The King's crown shattered like cheap slag, and my anvil finally rests. I will forge plows again, though every furrow may uncover a shard of him.",
        "Your weapon held; that is praise enough in a world where most steel remembers how to fail."
      ]
    },
    "mystery_hint": "There is a fourth mark beneath my anvil, scratched by a hammer no living smith can lift.",
    "rest_dialogue": "Take a cot at the inn and loosen your hands; even a strong grip becomes a cage after too many battles."
  },
  "sella": {
    "name": "Sella Rook",
    "role": "new villager",
    "dialogue": {
      "0_crystals": [
        "I came to Aldermere seeking a quiet grave, but the Hollow King followed in the rain. Find the three crystals before this village becomes my second burial.",
        "The locals call the shrines cursed; I call them hungry. Either way, they are waiting for someone brave enough to knock."
      ],
      "1_crystal": [
        "You carry one ember, and now the crows circle less tightly. Do not stop; the King's servants notice every pause.",
        "I saw a pale road behind the mill last night, though there is no road there by day. It may lead toward the next crystal, or toward something that wants your face."
      ],
      "2_crystals": [
        "Two crystals make the air taste of copper, and the dead have started whispering my childhood name. Take the last ember before they remember yours.",
        "When you face the Hollow King, keep one hand empty; he cannot steal what you refuse to hold."
      ],
      "king_defeated": [
        "The Hollow King is dead, yet the rain still falls upward beyond the mill. I think victory only opened a door we have not learned to fear.",
        "I will stay in Aldermere now; someone must remember what this place cost to survive."
      ]
    },
    "mystery_hint": "A child with no shadow leaves wet footprints beneath the locked granary each dawn.",
    "rest_dialogue": "The inn's roof leaks, but its dreams are ordinary; sleep there and let the dark pass over you for one night."
  }
};
/* CODEX-DIALOGUE-END */

/** Dialogue for every NPC. The five Codex villagers (Maren, Pip, Torin,
 *  Braska, Sella) speak the package's exact lines, two per progress state;
 *  at two crystals their vague mystery hint surfaces as a third line. The
 *  Hermes v2 quest givers speak state-aware lines (intro / progress /
 *  done); the silent Gravekeeper answers in description, never in words.
 *  `extra` carries quests (status + progress), flags, and kingDefeated. */
export function linesFor(npcId, crystalCount, extra = {}) {
  const q = extra.quests || {};
  const flags = extra.flags || {};
  const king = extra.kingDefeated;
  const codex = CODEX_DIALOGUE[npcId];
  if (codex) {
    const state = king ? 'king_defeated' : crystalCount >= 2 ? '2_crystals' : crystalCount === 1 ? '1_crystal' : '0_crystals';
    const lines = codex.dialogue[state].slice();
    if (crystalCount >= 2 && !king) lines.push(codex.mystery_hint);
    return lines;
  }
  if (npcId === 'wren') {
    if (king) return ['Wren. He watches the poison river the way other men watch the weather.', '"The river will take years to heal. But it will heal. That is more than I could say yesterday."'];
    if (crystalCount >= 1) return ['Wren. "The river is lower than it was. Whatever you are doing out there, it is working."'];
    return ['Wren. He watches the poison river the way other men watch the weather.', '"The Venomfen was a river once. Now it is a wound. Do not drink from it, and do not fall in."'];
  }
  if (npcId === 'odo') {
    const letter = q.sq_cinder_letter;
    if (letter && letter.status === 'active' && flags.sealedConfession) {
      return ['Hermit Odo. He takes the sealed confession, reads it by the cold fire, and says nothing for a long time.', 'Then: "Tell Edris the ash keeps its word. The letter is delivered."'];
    }
    if (king) return ['Hermit Odo. He is still here, and so are you.', '"The dead feared nothing," he says, "and now neither do we."'];
    return ['Hermit Odo. The ash has kept him alive this long, and he does not ask it for more.', '"The King never feared the dead," he says, "because the dead never feared him back. Remember that when you stand before him."'];
  }
  if (npcId === 'silas') {
    if (king) return ['Gravedigger Silas. "No new graves today. First time in years. I might take up gardening."'];
    if (crystalCount >= 1) return ['Silas. "Fewer new graves since you started. Keep it that way."'];
    return ['Gravedigger Silas. He leans on his shovel and does not hurry. The dead are patient, and so is he.', '"I dig the graves. You dig the King. Fair trade."'];
  }
  if (npcId === 'tilda') {
    if (king) return ['Tilda. Her garden is already sprouting — too fast, and too green, and she does not care at all.'];
    return ['Tilda. She came out of her house the moment the first crystal burned again.', '"I hid for weeks. Now I am going to plant something. Anything. Just to watch it grow."'];
  }
  // Hermes v2 quest givers.
  if (npcId === 'maelin') {
    const quest = q.sq_gale_bells;
    if (king) return ['Sister Maelin. The King is dead, and the Crags are quiet at last. The bells ring true again — thank you, Ash.'];
    if (quest && quest.status === 'done') return ['Eight wraiths, silenced. The Gale Shrine can breathe again — and Mira\'s Galeweave Staff is yours, as promised.'];
    if (quest && quest.status === 'active') return [`${quest.progress} of 8 wraiths broken. Their echo still crawls down from the Crags — break their throats before it reaches Aldermere.`];
    return ['Sister Maelin. The wind shrine has fallen silent, and something in the Howling Crags answers with a child\'s voice.', 'Break the throats of eight cave wraiths before their echo reaches Aldermere. I will pay you in steel and gold — a Galeweave Staff for Mira, and more besides.'];
  }
  if (npcId === 'odran') {
    const quest = q.sq_tide_bloodwater;
    if (king) return ['Ferryman Odran. The river runs clear again, or clear enough. You ferried us all across, Ash.'];
    if (quest && quest.status === 'done') return ['Five seals, safe from the black water. The Tide Crystal will not be swallowed today — take this Tideward Plate, and my thanks.'];
    if (quest && quest.status === 'active') return [`${quest.progress} of 5 seals recovered. The Venomfen carries teeth and bones — wade the poison flood and pull the seals from the current.`];
    return ['Ferryman Odran. The Venomfen has turned black around the old shrine, carrying teeth, bones, and the names of the drowned.', 'Recover five Broken Tide Shrine Seals before the Tide Crystal is swallowed by the poisoned current. A Tideward Plate for Bram waits on the other side.'];
  }
  if (npcId === 'della') {
    const quest = q.sq_gravewax;
    if (king) return ['Della Vane. The graves are still at last. Whatever you did out there, the dead felt it.'];
    if (quest && quest.status === 'done') return ['Six gravewax, before nightfall. The dead will sleep quiet tonight — you have my thanks, and my blessing.'];
    if (quest && quest.status === 'active') return [`${quest.progress} of 6 gravewax gathered. The graves burn without flame — take the wax from the tombstones before nightfall seals the coffins.`];
    return ['Della Vane. The village graves burn without flame, and the dead have begun to knock from within.', 'Gather six Cold Gravewax before nightfall seals the coffins from the living side.'];
  }
  if (npcId === 'tovin') {
    const quest = q.sq_lost_lantern;
    if (king) return ['Tovin Reed. The lanterns burn steady now. A lit road is a safe road — you proved that.'];
    if (quest && quest.status === 'done') return ['Four lanterns, back on their hooks. The Wraithwood road is lit again — the spirits will not learn it tonight.'];
    if (quest && quest.status === 'active') return [`${quest.progress} of 4 lanterns found. They vanished along the Wraithwood path — follow the wet footprints beneath the trees.`];
    return ['Tovin Reed. My watch lanterns vanished along the Wraithwood path, leaving only wet footprints beneath the trees.', 'Retrieve four of them before the spirits learn the road home.'];
  }
  if (npcId === 'edris') {
    const quest = q.sq_cinder_letter;
    if (king) return ['Edris Quill. The confession reached the hermit, and the King is dead. Whatever it said, it is ash now.'];
    if (quest && quest.status === 'done') return ['The hermit read it, then burned it without a word. Some confessions only need to be carried, not answered. Thank you.'];
    if (quest && quest.status === 'active' && flags.sealedConfession) return ['You carry it still. Cross the Bonefields to the ashbound hermit — Odo, north of the village — before the fire inside the seal goes cold.'];
    return ['Edris Quill. A sealed confession lies in my hand, but no courier will cross the Bonefields.', 'Deliver it to the ashbound hermit — Odo, north of the village — before the fire inside the seal goes cold. Take it.'];
  }
  if (npcId === 'gravekeeper') {
    const quest = q.mq_third_ember_shadow;
    if (king) return ['The Gravekeeper nods once, slowly. The dead are at rest, and so, at last, is he.'];
    if (quest && quest.status === 'done') return ['The Gravekeeper has said all he will ever say. He returns to his graves, and the earth is quiet — for now.'];
    if (crystalCount < 2) return ['The Gravekeeper. He does not speak. He only tends the graves, and watches you with eyes like cold embers.', 'Something about him waits. Perhaps he will speak when the hearth burns brighter.'];
    const talks = flags.graveTalks || 0;
    if (talks >= 3) return ['The Gravekeeper speaks at last — one word, a name, and the ground beneath the great spirit tree shudders. The Grief Below stirs.', 'The Name Under the Hearth is yours. The Warmth Charm burns in your pack.'];
    if (talks === 2) return ['The Gravekeeper opens his palm. A name is carved into it, old and black: the name the village buried beneath its first hearth.', 'Once more. He is almost ready to speak it aloud.'];
    return ['The Gravekeeper leans close. Behind his teeth, a cold ember glows. He presses a withered finger to his lips, then points at the great spirit tree, far to the east.', 'Ask him again. He has more to show you.'];
  }
  return ['A villager, watching the dark.'];
}

export const SKILLS = {
  emberSlash: { name: 'Ember Slash', mp: 4, power: 1.5, kind: 'fire', element: 'fire', desc: 'Emberblade burns — a sword strike. 1.5x damage.' },
  hearthGuard: { name: 'Hearth Guard', mp: 3, power: 0, kind: 'guard', element: 'fire', desc: 'Raise own defence for 3 turns.' },
  ashenRequiem: { name: 'Ashen Requiem', mp: 14, power: 0, kind: 'ultimate', element: 'fire', hits: 5, hitPower: 1.0, unlock: 2, ultMsg: 'five burning slashes', desc: 'ULTIMATE — five burning slashes. Once per battle.' },
  sparkburst: { name: 'Sparkburst', mp: 5, power: 1.9, kind: 'fire', element: 'fire', desc: 'The Galeweave Staff bursts with ember sparks. 1.9x damage.' },
  kindle: { name: 'Kindle', mp: 6, power: 0, kind: 'heal', element: 'fire', desc: 'Mend an ally for 35 HP.' },
  hollowfireCataclysm: { name: 'Hollowfire Cataclysm', mp: 20, power: 3.0, kind: 'ultimate', element: 'shadow', aoe: true, unlock: 2, ultMsg: 'hollow fire swallows the field', desc: 'ULTIMATE — hollow fire hits ALL foes. Once per battle.' },
  shieldBash: { name: 'Shield Bash', mp: 4, power: 1.3, kind: 'bash', element: 'steel', desc: 'The Gravehammer slams a foe. 1.3x damage. 35% chance to stun.' },
  bulwark: { name: 'Bulwark', mp: 5, power: 0, kind: 'partyGuard', element: 'steel', desc: 'Raise the whole party defence for 3 turns.' },
  hearthwallJudgment: { name: 'Hearthwall Judgment', mp: 12, power: 2.8, kind: 'ultimate', element: 'steel', unlock: 2, stunChance: 0.5, ultMsg: 'the wall itself strikes back', desc: 'ULTIMATE — a shield slam. 2.8x damage, guards the party, may stun. Once per battle.' },
  piercingShot: { name: 'Piercing Shot', mp: 5, power: 1.6, kind: 'fire', element: 'steel', desc: 'The Marrowbow looses a piercing arrow. 1.6x damage.' },
  arrowRain: { name: 'Arrow Rain', mp: 8, power: 1.3, kind: 'fire', element: 'fire', aoe: true, desc: 'Burning arrows rain on ALL foes. 1.3x damage.' },
  galefangVolley: { name: 'Galefang Volley', mp: 14, power: 0, kind: 'ultimate', element: 'steel', hits: 5, hitPower: 1.0, unlock: 2, ultMsg: 'a deadly volley of arrows', desc: 'ULTIMATE — five arrows, one storm. Once per battle.' },
  venomStab: { name: 'Venom Stab', mp: 5, power: 1.7, kind: 'fire', element: 'shadow', desc: 'The Griefsplitter Daggers bite deep with venom. 1.7x damage.' },
  shadowStep: { name: 'Shadow Step', mp: 7, power: 2.0, kind: 'fire', element: 'shadow', desc: 'Strike from the dark. 2.0x damage.' },
  umbralFlurry: { name: 'Umbral Flurry', mp: 16, power: 0, kind: 'ultimate', element: 'shadow', hits: 6, hitPower: 0.9, unlock: 2, ultMsg: 'a flurry of shadow slashes', desc: 'ULTIMATE — six slashes from the dark. Once per battle.' },
  mendingLight: { name: 'Mending Light', mp: 6, power: 0, kind: 'heal', element: 'fire', desc: 'The Sunlit Staff mends an ally for 35 HP.' },
  radiantMend: { name: 'Radiant Mend', mp: 10, power: 0, kind: 'partyHeal', element: 'fire', desc: 'Mend ALL allies for 20 HP and cleanse poison.' },
  sanctumOfDawn: { name: 'Sanctum of Dawn', mp: 18, power: 0, kind: 'ultimate', element: 'fire', reviveHeal: true, unlock: 2, ultMsg: 'the dawn itself answers', desc: 'ULTIMATE — heal the whole party fully and wake the fallen. Once per battle.' },
};

/** The party: six heroes, four active and two in reserve. The party's
 *  classes are adapted from the Agent Cards program pattern
 *  (archetype-archetype-finisher: turtle-tinker, charger, assassin, mage,
 *  warrior): each hero is a program of two archetypes plus a finisher role,
 *  with one passive perk that really runs in combat.js, a named weapon that
 *  shows in the HUD, the battle screen and the title, and an `active` flag
 *  (only the four active heroes walk, fight and gain full XP; reserves gain
 *  half XP and wait in Aldermere). */
export const PARTY_TEMPLATE = [
  {
    name: 'Ash', cls: 'Hearthwarden', role: 'Vanguard', program: 'charger-vanguard',
    perk: { id: 'riposte', name: 'Ember Riposte', desc: '40% chance to counter when struck.' },
    weapon: 'Emberblade', active: true,
    equipment: { weapon: 'eq_ash_emberblade_i', armor: null, accessory: null },
    classColor: '#ff5a2a', sprite: 'ash', level: 1, xp: 0,
    hp: 42, maxHp: 42, mp: 12, maxMp: 12, atk: 9, def: 5, spd: 7,
    skills: ['emberSlash', 'hearthGuard', 'ashenRequiem'], growth: { hp: 8, mp: 2, atk: 2, def: 1 },
  },
  {
    name: 'Mira', cls: 'Embercaller', role: 'Arcane', program: 'tinker-arcane',
    perk: { id: 'emberwell', name: 'Emberwell', desc: 'Regain 3 MP at the start of each turn.' },
    weapon: 'Galeweave Staff', active: true,
    equipment: { weapon: 'eq_mira_galeweave_staff_i', armor: null, accessory: null },
    classColor: '#8a3ad8', sprite: 'mira', level: 1, xp: 0,
    hp: 30, maxHp: 30, mp: 20, maxMp: 20, atk: 6, def: 3, spd: 9,
    skills: ['sparkburst', 'kindle', 'hollowfireCataclysm'], growth: { hp: 5, mp: 4, atk: 2, def: 1 },
  },
  {
    name: 'Bram', cls: 'Bulwark', role: 'Sentinel', program: 'turtle-sentinel',
    perk: { id: 'aegis', name: 'Aegis Guard', desc: 'Guarded damage is cut to 40% instead of 60%.' },
    weapon: 'Gravehammer', active: true,
    equipment: { weapon: 'eq_bram_gravehammer_i', armor: null, accessory: null },
    classColor: '#c8ccd4', sprite: 'bram', level: 1, xp: 0,
    hp: 52, maxHp: 52, mp: 10, maxMp: 10, atk: 9, def: 5, spd: 4,
    skills: ['shieldBash', 'bulwark', 'hearthwallJudgment'], growth: { hp: 10, mp: 2, atk: 2, def: 2 },
  },
  {
    name: 'Liora', cls: 'Dawncaller', role: 'Healer', program: 'cleric-healer',
    perk: { id: 'grace', name: 'Grace', desc: 'Healing is 25% stronger; allies regain 2 HP each round.' },
    weapon: 'Sunlit Staff', active: true,
    equipment: { weapon: 'eq_healer_sunlit_staff_i', armor: null, accessory: null },
    classColor: '#ffd97a', sprite: 'liora', level: 1, xp: 0,
    hp: 32, maxHp: 32, mp: 21, maxMp: 21, atk: 6, def: 4, spd: 6,
    skills: ['mendingLight', 'radiantMend', 'sanctumOfDawn'], growth: { hp: 6, mp: 4, atk: 1, def: 1 },
  },
  {
    name: 'Rowan', cls: 'Deadeye', role: 'Marksman', program: 'hunter-marksman',
    perk: { id: 'hawkeye', name: 'Hawkeye', desc: 'Critical hits land 25% of the time.' },
    weapon: 'Marrowbow', active: false,
    equipment: { weapon: 'eq_marksman_marrowbow_i', armor: null, accessory: null },
    classColor: '#7ac74a', sprite: 'rowan', level: 1, xp: 0,
    hp: 34, maxHp: 34, mp: 14, maxMp: 14, atk: 8, def: 4, spd: 8,
    skills: ['piercingShot', 'arrowRain', 'galefangVolley'], growth: { hp: 6, mp: 2, atk: 2, def: 1 },
  },
  {
    name: 'Vex', cls: 'Nightblade', role: 'Assassin', program: 'shadow-assassin',
    perk: { id: 'executioner', name: 'Executioner', desc: 'Damage +50% against foes below 30% HP.' },
    weapon: 'Griefsplitter Daggers', active: false,
    equipment: { weapon: 'eq_assassin_griefsplitters_i', armor: null, accessory: null },
    classColor: '#b45ad8', sprite: 'vex', level: 1, xp: 0,
    hp: 32, maxHp: 32, mp: 16, maxMp: 16, atk: 10, def: 3, spd: 9,
    skills: ['venomStab', 'shadowStep', 'umbralFlurry'], growth: { hp: 6, mp: 3, atk: 3, def: 1 },
  },
];

export function xpNext(level) {
  return 25 * level + 10;
}

export const ITEMS = {
  potion: { name: 'Potion', desc: 'Restores 45 HP to one ally.', heal: 45, mp: 0 },
  ether: { name: 'Ether', desc: 'Restores 25 MP to one ally.', heal: 0, mp: 25 },
  elixir: { name: 'Elixir', desc: 'Restores one ally to full HP and MP. Rare.', full: true },
  phoenixTear: { name: 'Phoenix Tear', desc: 'Wakes a fallen ally with 50% HP.', revive: true },
  antidote: { name: 'Antidote', desc: 'Cures poison on one ally.', cure: 'poison' },
};

/** Monster leavings: every foe drops one of its material when it falls.
 *  Smith Aldric reforges signature weapons with them (3 for tier II, 5 for
 *  tier III). */
export const MATERIALS = {
  gloomAsh: { name: 'Gloomshade Ash', from: 'gloomshade' },
  graveDust: { name: 'Grave Dust', from: 'gravebat' },
  wispLight: { name: 'Wisp Light', from: 'palewisp' },
  acidSlime: { name: 'Acid Slime', from: 'acidmire' },
  ashFang: { name: 'Ash Fang', from: 'ashenhound' },
  venomGland: { name: 'Venom Gland', from: 'venomcoil' },
  boneShard: { name: 'Bone Shard', from: 'rattlebones' },
  rotFlesh: { name: 'Rot Flesh', from: 'rotshambler' },
};

/* HERMES-EQUIPMENT-START */
/** Equipment, generated from the Hermes content package v2
 *  (dev/hermes-quests-equipment.json) — the canonical source. Do not
 *  hand-edit: re-run dev/generate_hermes_equipment.py instead.
 *  Six heroes x weapon/armor/accessory x tiers I/II/III = 54 entries.
 *  Tier-I WEAPONS start equipped; armour and accessory start empty and
 *  are forged at Braska Veld (3x a monster material, named in `forge`).
 *  Tier II/III blacksmith items need the previous tier owned first.
 *  Quest/boss/mystery tiers come from equipmentBySource(sourceKey).
 *  V2 fixes applied here: Bram accessory id renamed to
 *  eq_bram_oathbound_shield (it is a shield, not a ring); Assassin
 *  Griefsplitter tier I moved from the hidden boss to the blacksmith. */
export const EQUIPMENT = {
  eq_ash_emberblade_i: { name: 'Emberblade I', slot: 'weapon', tier: 1, stats: { atk: 12, spd: 1 }, source: 'blacksmith + Cinder Iron', sourceKey: 'blacksmith', desc: 'Emberblade, tier I. blacksmith + Cinder Iron.', forge: { material: 'ashFang', count: 3, materialName: 'Cinder Iron' } },
  eq_ash_emberblade_ii: { name: 'Emberblade II', slot: 'weapon', tier: 2, stats: { atk: 24, spd: 2 }, source: 'shrine boss', sourceKey: 'gale', desc: 'Emberblade, tier II. shrine boss.' },
  eq_ash_emberblade_iii: { name: 'Emberblade III', slot: 'weapon', tier: 3, stats: { atk: 40, def: 2, spd: 3 }, source: 'blacksmith + Crown Ash', sourceKey: 'blacksmith', desc: 'Emberblade, tier III. blacksmith + Crown Ash.', forge: { material: 'ashFang', count: 3, materialName: 'Crown Ash' } },
  eq_ash_hearthguard_mail_i: { name: 'Hearthguard Mail I', slot: 'armor', tier: 1, stats: { atk: 1, def: 10, hp: 18 }, source: 'blacksmith + Cinder Iron', sourceKey: 'blacksmith', desc: 'Hearthguard Mail, tier I. blacksmith + Cinder Iron.', forge: { material: 'ashFang', count: 3, materialName: 'Cinder Iron' } },
  eq_ash_hearthguard_mail_ii: { name: 'Hearthguard Mail II', slot: 'armor', tier: 2, stats: { atk: 2, def: 21, hp: 36 }, source: 'blacksmith + Coffin Rivets', sourceKey: 'blacksmith', desc: 'Hearthguard Mail, tier II. blacksmith + Coffin Rivets.', forge: { material: 'boneShard', count: 3, materialName: 'Coffin Rivets' } },
  eq_ash_hearthguard_mail_iii: { name: 'Hearthguard Mail III', slot: 'armor', tier: 3, stats: { atk: 4, def: 35, hp: 62, spd: 1 }, source: 'shrine boss', sourceKey: 'tide', desc: 'Hearthguard Mail, tier III. shrine boss.' },
  eq_ash_warmth_charm_i: { name: 'Warmth Charm I', slot: 'accessory', tier: 1, stats: { atk: 2, def: 2, hp: 8, mp: 4 }, source: 'blacksmith + Hearthglass', sourceKey: 'blacksmith', desc: 'Warmth Charm, tier I. blacksmith + Hearthglass.', forge: { material: 'wispLight', count: 3, materialName: 'Hearthglass' } },
  eq_ash_warmth_charm_ii: { name: 'Warmth Charm II', slot: 'accessory', tier: 2, stats: { atk: 4, def: 4, hp: 16, mp: 8, spd: 1 }, source: 'blacksmith + Hearthglass', sourceKey: 'blacksmith', desc: 'Warmth Charm, tier II. blacksmith + Hearthglass.', forge: { material: 'wispLight', count: 3, materialName: 'Hearthglass' } },
  eq_ash_warmth_charm_iii: { name: 'Warmth Charm III', slot: 'accessory', tier: 3, stats: { atk: 7, def: 7, hp: 28, mp: 14, spd: 2 }, source: 'mystery quest', sourceKey: 'mystery', desc: 'Warmth Charm, tier III. mystery quest.' },
  eq_mira_galeweave_staff_i: { name: 'Galeweave Staff I', slot: 'weapon', tier: 1, stats: { atk: 7, mp: 14, spd: 1 }, source: 'blacksmith + Whisperwood', sourceKey: 'blacksmith', desc: 'Galeweave Staff, tier I. blacksmith + Whisperwood.', forge: { material: 'wispLight', count: 3, materialName: 'Whisperwood' } },
  eq_mira_galeweave_staff_ii: { name: 'Galeweave Staff II', slot: 'weapon', tier: 2, stats: { atk: 14, mp: 28, spd: 2 }, source: 'side quest sq_gale_bells', sourceKey: 'sq_gale_bells', desc: 'Galeweave Staff, tier II. side quest sq_gale_bells.' },
  eq_mira_galeweave_staff_iii: { name: 'Galeweave Staff III', slot: 'weapon', tier: 3, stats: { atk: 26, def: 1, mp: 48, spd: 4 }, source: 'shrine boss', sourceKey: 'tide', desc: 'Galeweave Staff, tier III. shrine boss.' },
  eq_mira_veilwoven_robe_i: { name: 'Veilwoven Robe I', slot: 'armor', tier: 1, stats: { def: 5, hp: 6, mp: 12, spd: 1 }, source: 'blacksmith + Veil Thread', sourceKey: 'blacksmith', desc: 'Veilwoven Robe, tier I. blacksmith + Veil Thread.', forge: { material: 'gloomAsh', count: 3, materialName: 'Veil Thread' } },
  eq_mira_veilwoven_robe_ii: { name: 'Veilwoven Robe II', slot: 'armor', tier: 2, stats: { atk: 1, def: 11, hp: 12, mp: 24, spd: 2 }, source: 'shrine boss', sourceKey: 'tide', desc: 'Veilwoven Robe, tier II. shrine boss.' },
  eq_mira_veilwoven_robe_iii: { name: 'Veilwoven Robe III', slot: 'armor', tier: 3, stats: { atk: 2, def: 19, hp: 22, mp: 42, spd: 3 }, source: 'blacksmith + Spirit Silk', sourceKey: 'blacksmith', desc: 'Veilwoven Robe, tier III. blacksmith + Spirit Silk.', forge: { material: 'wispLight', count: 3, materialName: 'Spirit Silk' } },
  eq_mira_eye_of_dawn_i: { name: 'Eye of Dawn I', slot: 'accessory', tier: 1, stats: { atk: 3, def: 1, mp: 8, spd: 1 }, source: 'blacksmith + Sunken Amber', sourceKey: 'blacksmith', desc: 'Eye of Dawn, tier I. blacksmith + Sunken Amber.', forge: { material: 'venomGland', count: 3, materialName: 'Sunken Amber' } },
  eq_mira_eye_of_dawn_ii: { name: 'Eye of Dawn II', slot: 'accessory', tier: 2, stats: { atk: 6, def: 2, mp: 16, spd: 2 }, source: 'shrine boss', sourceKey: 'dawn', desc: 'Eye of Dawn, tier II. shrine boss.' },
  eq_mira_eye_of_dawn_iii: { name: 'Eye of Dawn III', slot: 'accessory', tier: 3, stats: { atk: 11, def: 4, mp: 30, spd: 3 }, source: 'blacksmith + Dawn Shard', sourceKey: 'blacksmith', desc: 'Eye of Dawn, tier III. blacksmith + Dawn Shard.', forge: { material: 'wispLight', count: 3, materialName: 'Dawn Shard' } },
  eq_bram_gravehammer_i: { name: 'Gravehammer I', slot: 'weapon', tier: 1, stats: { atk: 14, def: 3, hp: 4, spd: -1 }, source: 'blacksmith + Tombsteel', sourceKey: 'blacksmith', desc: 'Gravehammer, tier I. blacksmith + Tombsteel.', forge: { material: 'boneShard', count: 3, materialName: 'Tombsteel' } },
  eq_bram_gravehammer_ii: { name: 'Gravehammer II', slot: 'weapon', tier: 2, stats: { atk: 28, def: 6, hp: 10, spd: -1 }, source: 'shrine boss', sourceKey: 'gale', desc: 'Gravehammer, tier II. shrine boss.' },
  eq_bram_gravehammer_iii: { name: 'Gravehammer III', slot: 'weapon', tier: 3, stats: { atk: 46, def: 10, hp: 18 }, source: 'blacksmith + Titan Bone', sourceKey: 'blacksmith', desc: 'Gravehammer, tier III. blacksmith + Titan Bone.', forge: { material: 'boneShard', count: 3, materialName: 'Titan Bone' } },
  eq_bram_tideward_plate_i: { name: 'Tideward Plate I', slot: 'armor', tier: 1, stats: { atk: 1, def: 14, hp: 28, spd: -1 }, source: 'blacksmith + Fensteel', sourceKey: 'blacksmith', desc: 'Tideward Plate, tier I. blacksmith + Fensteel.', forge: { material: 'acidSlime', count: 3, materialName: 'Fensteel' } },
  eq_bram_tideward_plate_ii: { name: 'Tideward Plate II', slot: 'armor', tier: 2, stats: { atk: 2, def: 28, hp: 56, spd: -1 }, source: 'side quest sq_tide_bloodwater', sourceKey: 'sq_tide_bloodwater', desc: 'Tideward Plate, tier II. side quest sq_tide_bloodwater.' },
  eq_bram_tideward_plate_iii: { name: 'Tideward Plate III', slot: 'armor', tier: 3, stats: { atk: 4, def: 46, hp: 92 }, source: 'shrine boss', sourceKey: 'tide', desc: 'Tideward Plate, tier III. shrine boss.' },
  eq_bram_oathbound_shield_i: { name: 'Oathbound Tower Shield I', slot: 'accessory', tier: 1, stats: { atk: 1, def: 4, hp: 16 }, source: 'blacksmith + Grave Silver', sourceKey: 'blacksmith', desc: 'Oathbound Tower Shield, tier I. blacksmith + Grave Silver.', forge: { material: 'graveDust', count: 3, materialName: 'Grave Silver' } },
  eq_bram_oathbound_shield_ii: { name: 'Oathbound Tower Shield II', slot: 'accessory', tier: 2, stats: { atk: 2, def: 8, hp: 32 }, source: 'blacksmith + Drowned Brass', sourceKey: 'blacksmith', desc: 'Oathbound Tower Shield, tier II. blacksmith + Drowned Brass.', forge: { material: 'venomGland', count: 3, materialName: 'Drowned Brass' } },
  eq_bram_oathbound_shield_iii: { name: 'Oathbound Tower Shield III', slot: 'accessory', tier: 3, stats: { atk: 4, def: 14, hp: 56, spd: 1 }, source: 'blacksmith + Kingbone', sourceKey: 'blacksmith', desc: 'Oathbound Tower Shield, tier III. blacksmith + Kingbone.', forge: { material: 'boneShard', count: 3, materialName: 'Kingbone' } },
  eq_marksman_marrowbow_i: { name: 'Marrowbow I', slot: 'weapon', tier: 1, stats: { atk: 10, spd: 3 }, source: 'blacksmith + Bonewood', sourceKey: 'blacksmith', desc: 'Marrowbow, tier I. blacksmith + Bonewood.', forge: { material: 'boneShard', count: 3, materialName: 'Bonewood' } },
  eq_marksman_marrowbow_ii: { name: 'Marrowbow II', slot: 'weapon', tier: 2, stats: { atk: 21, spd: 5 }, source: 'shrine boss', sourceKey: 'gale', desc: 'Marrowbow, tier II. shrine boss.' },
  eq_marksman_marrowbow_iii: { name: 'Marrowbow III', slot: 'weapon', tier: 3, stats: { atk: 36, def: 1, spd: 8 }, source: 'blacksmith + Wraithstring', sourceKey: 'blacksmith', desc: 'Marrowbow, tier III. blacksmith + Wraithstring.', forge: { material: 'gloomAsh', count: 3, materialName: 'Wraithstring' } },
  eq_marksman_miststalker_coat_i: { name: 'Miststalker Coat I', slot: 'armor', tier: 1, stats: { atk: 1, def: 6, hp: 8, spd: 2 }, source: 'blacksmith + Fenhide', sourceKey: 'blacksmith', desc: 'Miststalker Coat, tier I. blacksmith + Fenhide.', forge: { material: 'acidSlime', count: 3, materialName: 'Fenhide' } },
  eq_marksman_miststalker_coat_ii: { name: 'Miststalker Coat II', slot: 'armor', tier: 2, stats: { atk: 2, def: 13, hp: 16, spd: 4 }, source: 'shrine boss', sourceKey: 'gale', desc: 'Miststalker Coat, tier II. shrine boss.' },
  eq_marksman_miststalker_coat_iii: { name: 'Miststalker Coat III', slot: 'armor', tier: 3, stats: { atk: 4, def: 22, hp: 30, spd: 6 }, source: 'blacksmith + Ghosthide', sourceKey: 'blacksmith', desc: 'Miststalker Coat, tier III. blacksmith + Ghosthide.', forge: { material: 'gloomAsh', count: 3, materialName: 'Ghosthide' } },
  eq_marksman_farwatch_quiver_i: { name: 'Farwatch Quiver I', slot: 'accessory', tier: 1, stats: { atk: 3, spd: 2 }, source: 'blacksmith + Black Fletching', sourceKey: 'blacksmith', desc: 'Farwatch Quiver, tier I. blacksmith + Black Fletching.', forge: { material: 'graveDust', count: 3, materialName: 'Black Fletching' } },
  eq_marksman_farwatch_quiver_ii: { name: 'Farwatch Quiver II', slot: 'accessory', tier: 2, stats: { atk: 6, def: 1, spd: 4 }, source: 'blacksmith + Drowned Brass', sourceKey: 'blacksmith', desc: 'Farwatch Quiver, tier II. blacksmith + Drowned Brass.', forge: { material: 'venomGland', count: 3, materialName: 'Drowned Brass' } },
  eq_marksman_farwatch_quiver_iii: { name: 'Farwatch Quiver III', slot: 'accessory', tier: 3, stats: { atk: 11, def: 2, spd: 7 }, source: 'shrine boss', sourceKey: 'tide', desc: 'Farwatch Quiver, tier III. shrine boss.' },
  eq_assassin_griefsplitters_i: { name: 'Griefsplitter Daggers I', slot: 'weapon', tier: 1, stats: { atk: 11, spd: 4 }, source: 'blacksmith + Griefsteel', sourceKey: 'blacksmith', desc: 'Griefsplitter Daggers, tier I. blacksmith + Griefsteel.', forge: { material: 'boneShard', count: 3, materialName: 'Griefsteel' } },
  eq_assassin_griefsplitters_ii: { name: 'Griefsplitter Daggers II', slot: 'weapon', tier: 2, stats: { atk: 23, spd: 7 }, source: 'hidden boss', sourceKey: 'hidden', desc: 'Griefsplitter Daggers, tier II. hidden boss.' },
  eq_assassin_griefsplitters_iii: { name: 'Griefsplitter Daggers III', slot: 'weapon', tier: 3, stats: { atk: 42, def: 1, spd: 11 }, source: 'hidden boss', sourceKey: 'hidden', desc: 'Griefsplitter Daggers, tier III. hidden boss.' },
  eq_assassin_shadeleather_i: { name: 'Shadeleather I', slot: 'armor', tier: 1, stats: { atk: 1, def: 4, hp: 6, spd: 3 }, source: 'blacksmith + Nighthide', sourceKey: 'blacksmith', desc: 'Shadeleather, tier I. blacksmith + Nighthide.', forge: { material: 'gloomAsh', count: 3, materialName: 'Nighthide' } },
  eq_assassin_shadeleather_ii: { name: 'Shadeleather II', slot: 'armor', tier: 2, stats: { atk: 2, def: 9, hp: 12, spd: 6 }, source: 'shrine boss', sourceKey: 'dawn', desc: 'Shadeleather, tier II. shrine boss.' },
  eq_assassin_shadeleather_iii: { name: 'Shadeleather III', slot: 'armor', tier: 3, stats: { atk: 4, def: 16, hp: 24, spd: 10 }, source: 'hidden boss', sourceKey: 'hidden', desc: 'Shadeleather, tier III. hidden boss.' },
  eq_assassin_silent_thorn_i: { name: 'Silent Thorn I', slot: 'accessory', tier: 1, stats: { atk: 2, spd: 3 }, source: 'blacksmith + Thornglass', sourceKey: 'blacksmith', desc: 'Silent Thorn, tier I. blacksmith + Thornglass.', forge: { material: 'acidSlime', count: 3, materialName: 'Thornglass' } },
  eq_assassin_silent_thorn_ii: { name: 'Silent Thorn II', slot: 'accessory', tier: 2, stats: { atk: 5, spd: 6 }, source: 'side quest sq_gale_bells', sourceKey: 'sq_gale_bells', desc: 'Silent Thorn, tier II. side quest sq_gale_bells.' },
  eq_assassin_silent_thorn_iii: { name: 'Silent Thorn III', slot: 'accessory', tier: 3, stats: { atk: 9, def: 1, spd: 10 }, source: 'mystery quest', sourceKey: 'mystery', desc: 'Silent Thorn, tier III. mystery quest.' },
  eq_healer_sunlit_staff_i: { name: 'Sunlit Staff I', slot: 'weapon', tier: 1, stats: { atk: 5, def: 1, mp: 16 }, source: 'blacksmith + Dawnwood', sourceKey: 'blacksmith', desc: 'Sunlit Staff, tier I. blacksmith + Dawnwood.', forge: { material: 'wispLight', count: 3, materialName: 'Dawnwood' } },
  eq_healer_sunlit_staff_ii: { name: 'Sunlit Staff II', slot: 'weapon', tier: 2, stats: { atk: 11, def: 2, mp: 32, spd: 1 }, source: 'shrine boss', sourceKey: 'dawn', desc: 'Sunlit Staff, tier II. shrine boss.' },
  eq_healer_sunlit_staff_iii: { name: 'Sunlit Staff III', slot: 'weapon', tier: 3, stats: { atk: 21, def: 4, mp: 56, spd: 2 }, source: 'blacksmith + White Cinder', sourceKey: 'blacksmith', desc: 'Sunlit Staff, tier III. blacksmith + White Cinder.', forge: { material: 'ashFang', count: 3, materialName: 'White Cinder' } },
  eq_healer_whitegold_raiment_i: { name: 'Whitegold Raiment I', slot: 'armor', tier: 1, stats: { def: 5, hp: 8, mp: 10 }, source: 'blacksmith + Pale Thread', sourceKey: 'blacksmith', desc: 'Whitegold Raiment, tier I. blacksmith + Pale Thread.', forge: { material: 'gloomAsh', count: 3, materialName: 'Pale Thread' } },
  eq_healer_whitegold_raiment_ii: { name: 'Whitegold Raiment II', slot: 'armor', tier: 2, stats: { atk: 1, def: 11, hp: 16, mp: 20, spd: 1 }, source: 'shrine boss', sourceKey: 'dawn', desc: 'Whitegold Raiment, tier II. shrine boss.' },
  eq_healer_whitegold_raiment_iii: { name: 'Whitegold Raiment III', slot: 'armor', tier: 3, stats: { atk: 2, def: 20, hp: 30, mp: 38, spd: 2 }, source: 'blacksmith + Saintglass', sourceKey: 'blacksmith', desc: 'Whitegold Raiment, tier III. blacksmith + Saintglass.', forge: { material: 'wispLight', count: 3, materialName: 'Saintglass' } },
  eq_healer_mercy_amulet_i: { name: 'Mercy Amulet I', slot: 'accessory', tier: 1, stats: { def: 2, hp: 8, mp: 8 }, source: 'blacksmith + River Pearl', sourceKey: 'blacksmith', desc: 'Mercy Amulet, tier I. blacksmith + River Pearl.', forge: { material: 'wispLight', count: 3, materialName: 'River Pearl' } },
  eq_healer_mercy_amulet_ii: { name: 'Mercy Amulet II', slot: 'accessory', tier: 2, stats: { atk: 1, def: 4, hp: 16, mp: 16, spd: 1 }, source: 'side quest sq_tide_bloodwater', sourceKey: 'sq_tide_bloodwater', desc: 'Mercy Amulet, tier II. side quest sq_tide_bloodwater.' },
  eq_healer_mercy_amulet_iii: { name: 'Mercy Amulet III', slot: 'accessory', tier: 3, stats: { atk: 2, def: 8, hp: 30, mp: 30, spd: 2 }, source: 'mystery quest', sourceKey: 'mystery', desc: 'Mercy Amulet, tier III. mystery quest.' },
};

/** All equipment whose tier source matches `key` (a quest id, gale,
 *  dawn, tide, mystery, hidden, blacksmith). Completing a quest or
 *  beating a boss grants every item sourced from it. */
export function equipmentBySource(key) {
  return Object.keys(EQUIPMENT).filter((id) => EQUIPMENT[id].sourceKey === key);
}
/* HERMES-EQUIPMENT-END */

/* HERMES-QUESTS-START */
/** Side quests + the mystery quest, generated from the Hermes content
 *  package v2 (dev/hermes-quests-equipment.json) — the canonical source.
 *  req types: kill (foe id), collect (hidden item), deliver (carry an
 *  item to an NPC), talk (speak to an NPC n times, after minCrystals).
 *  Hidden quests do not appear in the quest log until discovered. */
export const QUESTS = {
  sq_gale_bells: { id: 'sq_gale_bells', giver: 'maelin', name: 'The Bells Beneath the Crags', desc: 'The wind shrine has fallen silent, and something in the Howling Crags answers with a child\'s voice. Break the throats of the cave wraiths before their echo reaches Aldermere.', req: { type: 'kill', target: 'cavewraith', count: 8 }, reward: { xp: 420, gold: 180, equipment: 'eq_mira_galeweave_staff_ii' } },
  sq_tide_bloodwater: { id: 'sq_tide_bloodwater', giver: 'odran', name: 'What the River Carries', desc: 'The Venomfen has turned black around the old shrine, carrying teeth, bones, and the names of the drowned. Recover the shrine seals before the Tide Crystal is swallowed by the poisoned current.', req: { type: 'collect', target: 'tideSeal', count: 5 }, reward: { xp: 560, gold: 240, equipment: 'eq_bram_tideward_plate_ii' } },
  sq_gravewax: { id: 'sq_gravewax', giver: 'della', name: 'Wax for the Dead', desc: 'The village graves burn without flame, and the dead have begun to knock from within. Gather gravewax before nightfall seals the coffins from the living side.', req: { type: 'collect', target: 'gravewax', count: 6 }, reward: { xp: 180, gold: 0 } },
  sq_lost_lantern: { id: 'sq_lost_lantern', giver: 'tovin', name: 'Lanterns in the Mist', desc: 'Tovin\'s watch lanterns vanished along the Wraithwood path, leaving only wet footprints beneath the trees. Retrieve them before the spirits learn the road home.', req: { type: 'collect', target: 'watchLantern', count: 4 }, reward: { xp: 160, gold: 0 } },
  sq_cinder_letter: { id: 'sq_cinder_letter', giver: 'edris', name: 'A Letter Through Ash', desc: 'A sealed confession lies in Edris\'s hand, but no courier will cross the Bonefields. Deliver it to the ashbound hermit before the fire inside the seal goes cold.', req: { type: 'deliver', target: 'sealedConfession', count: 1 }, reward: { xp: 140, gold: 0 } },
  mq_third_ember_shadow: { id: 'mq_third_ember_shadow', giver: 'gravekeeper', name: 'The Name Under the Hearth', desc: 'The gravekeeper finally speaks a name that the village buried beneath its first hearth. Follow the memory into the dark and learn why the Hollow King never feared the dead.', req: { type: 'talk', target: 'gravekeeper', count: 3, minCrystals: 2 }, reward: { xp: 150, gold: 0, equipment: 'eq_ash_warmth_charm_iii' }, hidden: true },
};
/* HERMES-QUESTS-END */

/** Giant landmarks: one or two per zone, drawn large enough to dominate the
 *  frame. Their tiles are blocked in the map and drawn as overlays. */
export const LANDMARKS = [
  { type: 'spirittree', x: 17, y: 20, w: 2, h: 3 },
  { type: 'cave', x: 3, y: 3, w: 4, h: 2 },
  { type: 'giantbones', x: 21, y: 15, w: 4, h: 3 },
  { type: 'statue', x: 26, y: 14, w: 2, h: 3 },
  { type: 'thorns', x: 30, y: 8, w: 2, h: 3 },
];

/** The landmark covering tile (x, y), or null. The painter skips the
 *  regular tree draw on landmark tiles and paints the landmark art over
 *  them instead. */
export function landmarkAt(x, y) {
  for (const lm of LANDMARKS) {
    if (x >= lm.x && x < lm.x + lm.w && y >= lm.y && y < lm.y + lm.h) return lm;
  }
  return null;
}

/** Equipment helpers (pure, shared by field.js and the unit tests).
 *  Template stats are the base WITHOUT equipment; the tier-I signature
 *  weapon brings the effective values back to the old numbers. */
export function equipStats(hero) {
  const total = { atk: 0, def: 0, hp: 0, mp: 0, spd: 0 };
  if (!hero.equipment) return total;
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const id = hero.equipment[slot];
    const item = id && EQUIPMENT[id];
    if (!item) continue;
    for (const k of Object.keys(total)) total[k] += item.stats[k] || 0;
  }
  return total;
}
export function applyEquipBonus(hero) {
  const bonus = equipStats(hero);
  hero.atk += bonus.atk; hero.def += bonus.def; hero.spd += bonus.spd;
  hero.maxHp += bonus.hp; hero.hp += bonus.hp;
  hero.maxMp += bonus.mp; hero.mp += bonus.mp;
  hero.equipBonus = bonus;
  return bonus;
}
export function removeEquipBonus(hero) {
  const bonus = hero.equipBonus || { atk: 0, def: 0, hp: 0, mp: 0, spd: 0 };
  hero.atk -= bonus.atk; hero.def -= bonus.def; hero.spd -= bonus.spd;
  hero.maxHp -= bonus.hp; hero.hp = Math.min(hero.hp, hero.maxHp);
  hero.maxMp -= bonus.mp; hero.mp = Math.min(hero.mp, hero.maxMp);
  hero.equipBonus = { atk: 0, def: 0, hp: 0, mp: 0, spd: 0 };
  return bonus;
}
/** Change one equipment slot. Returns the previously equipped item id. */
export function equipItem(hero, slot, itemId) {
  removeEquipBonus(hero);
  const prev = hero.equipment ? hero.equipment[slot] : null;
  if (!hero.equipment) hero.equipment = { weapon: null, armor: null, accessory: null };
  hero.equipment[slot] = itemId;
  applyEquipBonus(hero);
  return prev;
}

/** Grant XP to the whole party: active heroes gain the full amount,
 *  reserves gain half. Dead heroes gain nothing. Returns the level-ups. */
export function grantXp(heroes, xp) {
  const levelUps = [];
  for (const hero of heroes) {
    if (hero.hp <= 0) continue;
    const gain = hero.active === false ? Math.floor(xp / 2) : xp;
    hero.xp += gain;
    while (hero.xp >= xpNext(hero.level)) {
      hero.xp -= xpNext(hero.level);
      hero.level += 1;
      hero.maxHp += hero.growth.hp;
      hero.maxMp += hero.growth.mp;
      hero.atk += hero.growth.atk;
      hero.def += hero.growth.def;
      hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.25));
      levelUps.push({ name: hero.name, level: hero.level });
    }
  }
  return levelUps;
}

/** The dark roster: nothing cute, nothing bright. Low mobs are small and
 *  simple, but bone, acid, venom and ghost-light. Bosses are bigger, with
 *  a draw scale of their own. */
export const ENEMIES = {
  gloomshade: { name: 'Gloomshade', hp: 22, atk: 7, def: 2, spd: 6, xp: 12, gold: 8, sprite: 'gloomshade', material: 'gloomAsh', desc: 'A wisp of living shadow.' },
  gravebat: { name: 'Gravebat', hp: 16, atk: 9, def: 1, spd: 10, xp: 14, gold: 10, sprite: 'gravebat', material: 'graveDust', desc: 'A bat with bone-white wings.' },
  palewisp: { name: 'Pale Wisp', hp: 18, atk: 8, def: 1, spd: 7, xp: 16, gold: 9, sprite: 'palewisp', material: 'wispLight', desc: 'A small ghost that never found rest.' },
  acidmire: { name: 'Acidmire', hp: 26, atk: 10, def: 2, spd: 5, xp: 18, gold: 11, sprite: 'acidmire', material: 'acidSlime', desc: 'A bubbling pool of acid dark.' },
  ashenhound: { name: 'Ashen Hound', hp: 30, atk: 11, def: 3, spd: 8, xp: 20, gold: 14, sprite: 'ashenhound', material: 'ashFang', desc: 'A hound of ash and bone, ember-eyed.' },
  venomcoil: { name: 'Venomcoil', hp: 24, atk: 12, def: 2, spd: 9, xp: 22, gold: 13, sprite: 'venomcoil', material: 'venomGland', poison: 0.35, desc: 'A serpent with venom scales.' },
  rattlebones: { name: 'Rattlebones', hp: 28, atk: 10, def: 4, spd: 6, xp: 20, gold: 12, sprite: 'rattlebones', material: 'boneShard', desc: 'A skeleton that refuses to lie down.' },
  rotshambler: { name: 'Rotshambler', hp: 42, atk: 9, def: 6, spd: 3, xp: 24, gold: 12, sprite: 'rotshambler', material: 'rotFlesh', desc: 'An old corpse, still walking.' },
  // The Cave Wraith (Hermes v2, sq_gale_bells): kill 8 in the Crags.
  cavewraith: { name: 'Cave Wraith', hp: 26, atk: 11, def: 3, spd: 7, xp: 18, gold: 10, sprite: 'cavewraith', material: 'gloomAsh', desc: 'A throat that learned to sing like a child.' },
  galehowl: { name: 'Galehowl', hp: 110, atk: 14, def: 4, spd: 7, xp: 90, gold: 60, sprite: 'galehowl', desc: 'Guardian of the Gale Shrine.', boss: true, scale: 5 },
  tidecoil: { name: 'Tidecoil', hp: 130, atk: 15, def: 5, spd: 6, xp: 110, gold: 70, sprite: 'tidecoil', desc: 'Guardian of the Tide Shrine.', boss: true, scale: 5 },
  dawnwing: { name: 'Dawnwing', hp: 150, atk: 17, def: 5, spd: 9, xp: 130, gold: 80, sprite: 'dawnwing', desc: 'Guardian of the Dawn Shrine.', boss: true, scale: 5 },
  hollowking: { name: 'Hollow King', hp: 260, atk: 20, def: 7, spd: 8, xp: 0, gold: 0, sprite: 'hollowking', desc: 'The cold that stole the hearth.', boss: true, scale: 6 },
  // The hidden boss (Hermes v2, hb_the_grief_below): HP 240, the strongest
  // thing in the game short of the Hollow King. Behind the great spirit
  // tree, once the mystery quest is done. Drops the Griefsplitter Daggers.
  griefbelow: { name: 'The Grief Below', hp: 240, atk: 24, def: 9, spd: 9, xp: 250, gold: 150, sprite: 'griefbelow', desc: 'A body of fused corpses, crowned in ribs.', boss: true, scale: 7 },
};

export function groupFor(region, dice) {
  if (region === 'Venomfen') return dice.shuffle(['venomcoil', 'acidmire', 'rotshambler']).slice(0, dice.int(2) + 1);
  if (region === 'Wraithwood') return dice.shuffle(['palewisp', 'gloomshade', 'gravebat']).slice(0, dice.int(2) + 1);
  if (region === 'Howling Crags') return dice.shuffle(['cavewraith', 'rattlebones', 'acidmire', 'gloomshade']).slice(0, dice.int(2) + 1);
  if (region === 'Bonefields') return dice.shuffle(['rattlebones', 'rotshambler', 'ashenhound']).slice(0, dice.int(2) + 1);
  return dice.shuffle(['gloomshade', 'palewisp', 'gravebat']).slice(0, dice.int(2) + 1);
}

// Pixel sprites, drawn as rows of characters. '.' is transparent; every
// other letter is a colour in painter.js's SPRITE_COLORS. Rows are padded
// to the widest row when drawn, so a stray short row is harmless.
export const SPRITES = {
  ash: [
    '................YY..',
    '...............YYY..',
    '.....HHHH.....YYY...',
    '....HSSSHH...YYY....',
    '....HSeSH...YYY.....',
    '...RRSSAA..YYY......',
    '..RRAAYAAA.YY.......',
    '..RRAAAAYASO........',
    '...RAAAAAA.O........',
    '...RAAYAAA..........',
    '....AAAAAAA.........',
    '....PP..AAA.........',
    '...BB....BB.........',
    '..BBB.....BBB.......',
  ],
  mira: [
    '...............u....',
    '.....VVV......uOu...',
    '....VVVVV......u....',
    '...VVKKVV......H....',
    '...VKeSKV......H....',
    '....VSSVV......H....',
    '...VVYVVVS.....H....',
    '..VVVuVVV.SSS..H....',
    '..VVYVVVVV.....H....',
    '...VVVuVVVV....H....',
    '..VVVVYVVVVV...H....',
    '.VVVuVVVVVVVV..H....',
    'VVVVVVYVVVVVVV.H....',
    '...BB....BB.........',
  ],
  bram: [
    '.....AAAAAA.........',
    '....AYYYYYAA........',
    '....AAKKKKAA....YYYY',
    '....AYeYeYAA....YYYY',
    '..AAAAAAAAAAAA...HH.',
    '.AYYYYYYAAAAAAS..HH.',
    '.AYRRRRYAAAAYASSSHH.',
    '.AYRYRRYAAAAAAA..HH.',
    '.AYRYRRYAAAAAAA..HH.',
    '.AYRRRRYAAAAYAA..HH.',
    '.AYYYYYYAAAAAAA.....',
    '..YYYYYY.AAAAA......',
    '...AAAA...AAAA......',
    '..BBBBB...BBBBB.....',
  ],
  rowan: [
    '................H...',
    '.....GGG.........H..',
    '....GGKGG........HH.',
    '..Y.GKeSG.........HH',
    '..YYGGSSG.........HH',
    '...YGGGGGSSSSSSSS.HH',
    '...HGGGGS....Y...YHH',
    '...HGGGGG.....YYYYHH',
    '....GGGGGG.......HH.',
    '....GGGGGG......HH..',
    '....PPPPPP.....HH...',
    '...BB...BB....H.....',
    '..BBB....BBB.H......',
    '....................',
  ],
  vex: [
    '....................',
    '....................',
    '......KKKK..........',
    '.....KKKKKK.........',
    '.....KKeSKK.........',
    '.....KRRRRK.........',
    '...RRRRKKKKK........',
    '..RR.KKKKKKSS....Y..',
    '....SKKKKKKK.S..YY..',
    '...YY.KKKKKKK.SYY...',
    '..YYY..KKKKKKK.O....',
    '.YY....BB..KKBB.....',
    '.......BBB...BBB....',
    '....................',
  ],
  liora: [
    '.....YYYYY.....e....',
    '....Y.....Y...eOe...',
    '.....WWWWW.....e....',
    '....WWSSWW.....Y....',
    '....WSeSWW.....H....',
    '.....WSSW...S..H....',
    '....WWYWW..SS..H....',
    '...WWWWWWSS....H....',
    '..WWWWYWW......H....',
    '...WWWWWWW.....H....',
    '..WWWYWWWWW....H....',
    '.WWWWWWYWWWW...H....',
    'WWWWYWWWWWYWW..H....',
    '....BB..BB..........',
  ],
  torin: [
    '....AAAA....',
    '...AAAAAA...',
    '...AeSSeA...',
    '...ASSSSA...',
    '....SSSS....',
    '...AAAAAA...',
    '..AAAAAAAA..',
    '..AAAAAAAA..',
    '..AA.AA.AA..',
    '..AAAAAAAA.O',
    '...AAAAAA..H',
    '....PPPP...H',
    '...BBBBBB...',
  ],
  elder: [
    '....WWWW....',
    '...WWWWWW...',
    '...WSSSSSW..',
    '...WSeSSeW..',
    '...WSSSSSW..',
    '....WWWW....',
    '...WWWWWW...',
    '..WWWWWWWW..',
    '..WWWWWWWW..',
    '...WWWWWW...',
    '....WWWW....',
    '....PPPP....',
    '...BBBBBB...',
  ],
  pip: [
    '....GGGG....',
    '...GGGGGG...',
    '...GSSSSSG..',
    '...GSeSSeG..',
    '...GSSSSSG..',
    '....SSSS....',
    '...GGGGGG...',
    '..GGGGGGGG..',
    '..GGGGGGGG..',
    '..G.G..G.G..',
    '...GGGGGG...',
    '....PPPP....',
    '...BBBBBB...',
  ],
  wren: [
    '....BBBB....',
    '...BBBBBB...',
    '..BBBBBBBB..',
    '...BSSSSSB..',
    '...BSeSSeB..',
    '...BSSSSSB..',
    '....SSSS....',
    '...BBBBBB...',
    '..BBBBBBBB..',
    '..BBBBBBBB..',
    '...BBBBBB...',
    '....PPPP....',
    '...BBBBBB...',
  ],
  odo: [
    '....DDDD....',
    '...DDDDDD...',
    '...DSSSSSD..',
    '...DSeSSeD..',
    '...DSSSSSD..',
    '....SSSS....',
    '...DDDDDD...',
    '..DDDDDDDD..',
    '..DDDDDDDD..',
    '..D.D..D.D..',
    '...DDDDDD...',
    '....DDDD....',
    '...BBBBBB...',
  ],
  silas: [
    '....DDDD....',
    '...DDDDDD...',
    '...DSSSSSD..',
    '...DSeSSeD..',
    '...DSSSSSD..',
    '....SSSS....',
    '..DDDDDDDDY.',
    '..DDDDDDDDY.',
    '..DDDDDDDDY.',
    '...DDDDDD.Y.',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  tilda: [
    '....RRRR....',
    '...RRRRRR...',
    '...RSSSSSR..',
    '...RSeSSeR..',
    '...RSSSSSR..',
    '....SSSS....',
    '..GGGGGGGG..',
    '..GGGGGGGG..',
    '..GGGGGGGG..',
    '...GGGGGG...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  braska: [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSSH..',
    '...HSeSSeH..',
    '...HSSSSSH..',
    '....SSSS....',
    '..YYHHHHHH..',
    '..Y.HHHHHH..',
    '..Y.HHHHHH..',
    '..HHHHHHHH..',
    '...PPPPPP...',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  sella: [
    '....GGGG....',
    '...GGGGGG...',
    '...GSSSSSG..',
    '...GSeSSeG..',
    '...GSSSSSG..',
    '....SSSS....',
    '..GGGGGGGG..',
    '..GGGGGGGGH.',
    '..GGGGGGGGH.',
    '...GGGGGG...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  maelin: [
    '....WWWW....',
    '...WWWWWW...',
    '...WSSSSSW..',
    '...WSeSSeW..',
    '...WSSSSSW..',
    '....SSSS....',
    '..WWWWWWWW..',
    '..WWWWWWWW.O',
    '..WWWWWWWW.O',
    '...WWWWWW...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  odran: [
    '....KKKK....',
    '...KKKKKK...',
    '...KKKKKK...',
    '...KKKKKK...',
    '...KKKKKK...',
    '....KKKK....',
    '..H.KKKKKK..',
    '..H.KKKKKK..',
    '..H.KKKKKK..',
    '..H.KKKKKK..',
    '....PPPP..e.',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  della: [
    '....RRRR....',
    '...RRRRRR...',
    '...RRRRRR...',
    '...RRRRRR...',
    '...RRRRRR...',
    '....RRRR....',
    '..RRRRRRRR..',
    '..RRRRRRRR..',
    '..RRRRRRRR..',
    '...RRRRRR...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  tovin: [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSSH..',
    '...HSeSSeH..',
    '...HSSSSSH..',
    '....SSSS....',
    '..HHHHHHHH..',
    '..HHHHHHHHe.',
    '..HHHHHHHH..',
    '...HHHHHH...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  edris: [
    '....DDDD....',
    '...DDDDDD...',
    '...DSSSSSD..',
    '...DSeSSeD..',
    '...DSSSSSD..',
    '....SSSS....',
    '..DDDDDDDD..',
    '..DDDDDDWDY.',
    '..DDDDDDDD..',
    '...DDDDDD...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  gravekeeper: [
    '....DDDD....',
    '...DDDDDD...',
    '...DSSSSSD..',
    '...DSSSSSD..',
    '...DSSSSSD..',
    '....SSSS....',
    '..DDDDDDDD.O',
    '..DDDDDDDD.O',
    '..YDDDDDDD.H',
    '..YDDDDDD...',
    '....PPPP....',
    '...BBBBBB...',
    '...BB..BB...',
  ],
  gloomshade: ['....k....','..kkvkk..','.kknnnkk.','kknrnrnkk','.knnnnnnk.','..kvvvk..','..k...k..','k......k.'],
  gravebat: ['b........b','bb..b..bb.','bvvbkbbvvb','.bvvkrvvb.','..bknnkb..','...kkkk...','..b....b..'],
  palewisp: ['....v....','...bvb...','..bWnWb..','.bWnWnWb.','..bWWWb..','...bvb...','..b...vb.'],
  acidmire: ['...v...v...','..vkkkv..','vkkkrkkkv.','kkknbnkkk.','kkkkkkkkk.','vkk.v.kkv.'],
  ashenhound: ['..b...k..','..bkrkk..','kkknnkkkk','bkkvvvkkb','..kkffkk.','..kk.kk..','..b...b..'],
  venomcoil: ['..b..b..','..krk...','...vkk..','....vkk.','..kkvkk.','.kvvkvkk','..kkkk..'],
  cavewraith: [
    '....WWWW....',
    '...WWWWWW...',
    '...WWKWWK...',
    '...WWrWWr...',
    '...WWWWWW...',
    '....WWWW....',
    '..WWWWWWWW..',
    '..WW.WW.WW..',
    '..W..WW..W..',
    '.W...WW...W.',
  ],
  rattlebones: ['...bbbb...','..bnrrnb..','...bnnb...','.bb.b.bb.','b.bbbbb.b','b..b.b..b','...b.b...','..bb.bb..'],
  rotshambler: ['...kkk...','..kvrrk..','.kkvbvkk.','kkkvvvkkk','kkvRvvkk.','.kkk.kk..','..bb.bb..'],
  galehowl: ['...b...b...','..bk.kb...','..kkkkk...','.kkvrnvkk.','kkknnnkkk.','kkkffvkkk','..kkkkkk..','.bbkkkbb.'],
  tidecoil: ['...b...b...','..bkvvkb..','..kknnrkk.','...knnk...','....vkk...','..kkvvkk..','.kkvvvvkk.','..kkkkkk..'],
  dawnwing: ['b.......b','bb..b..bb','.bvvkrvvb.','..bvvv b..','..kvffvk.','.kvvffvk.','..kvvvk..','...kvk...'],
  hollowking: ['...b.b.b...','..bbbbbbb..','..kvrrrvk..','.kkvnnn vkk.','kkkvvvvkkk','kvvRRRRvvk','kvvRRRRvvk','kkvvnnvvkk','..kk..kk..'],
  griefbelow: ['..b..b..b..','..bbbbbbb..','..kvnrvnk..','.kknnnnnkk.','kkvvvvvvvkk','kkvRRRRvkk.','.kkvvvvkk..','..kk..kk...','..bb..bb...'],
};
