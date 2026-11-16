// ASHEN HOLLOW — everything the eye sees, drawn on one canvas. Tiles,
// sprites, HUD, menus and screens are all procedural: no image files
// anywhere. The world is dark: scorched earth, dead trees, poison water,
// torchlight and blood-red embers — every tile textured with seeded noise,
// every animation driven by game time.
// Part 1: sprites, tiles, the overworld and its HUD.

import { VIEW_W, VIEW_H, TILE, PALETTE, clamp } from './tuning.js';
import { SPRITES, NPCS, SKILLS, tileAt, biomeAt, landmarkAt, QUESTS, PARTY_TEMPLATE } from './story.js';
import { MENU, FOE_AREA, foeSlotPos, ELEMENT_COLORS, BATTLE_HERO_Y } from './combat.js';

export const SPRITE_COLORS = {
  H: '#5a3a22', S: '#e8b88a', C: '#c73e2c', V: '#7a5ac8', A: '#9aa4b5',
  W: '#e8e4d8', G: '#3e7a4a', B: '#3a6ac8', D: '#5a5a6a', P: '#3a2c22',
  K: '#3a2450', T: '#4a8a3a', O: '#e07830', M: '#5a8a3a', e: '#ffe9a8',
  Y: '#c8ccd4', R: '#8a1a1a', r: '#ff2a1a', u: '#8a3ad8', g: '#7ac74a',
  n: '#0b0811', k: '#211529', v: '#503052', b: '#96847a', f: '#b44b26',
};

export const SCREENS = {
  TITLE: 'title',
  FIELD: 'field',
  BATTLE: 'battle',
  PAUSED: 'paused',
  VICTORY: 'victory',
  GAMEOVER: 'gameover',
};

/** Deterministic per-tile hash in [0,1): the same tile always gets the
 *  same speckles, so the noise is stable across renders. */
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Gothic display text: a blood-red shadow, a dark outline, and (for big
 *  titles) deterministic drips falling from the letters. Drawn in code over
 *  the existing monospace font — no external font file, no network fetch.
 *  `drips` sets how many drip strokes fall; 0 keeps small text clean. */
function gothicText(ctx, text, x, y, font, color, drips = 0) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // The blood-red shadow, offset down-right.
  ctx.fillStyle = '#5a0f0f';
  ctx.fillText(text, x + 3, y + 3);
  // The dark outline: the same text, nudged in four directions.
  ctx.fillStyle = '#0d0508';
  ctx.fillText(text, x - 2, y);
  ctx.fillText(text, x + 2, y);
  ctx.fillText(text, x, y - 2);
  ctx.fillText(text, x, y + 2);
  // The face.
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  // Drips: deterministic per letter, falling from the baseline.
  if (drips > 0) {
    const w = ctx.measureText(text).width;
    for (let i = 0; i < drips; i += 1) {
      const dx = -w / 2 + hash2(i, text.length, 7) * w;
      const len = 6 + hash2(i, 3, 11) * 14;
      const top = y + 4 + hash2(i, 5, 13) * 10;
      ctx.fillStyle = color === PALETTE.gold ? '#c73e2c' : color;
      ctx.fillRect(x + dx, top, 3, len);
      ctx.fillRect(x + dx - 1, top + len, 5, 3);
    }
  }
}

function drawSprite(ctx, sprite, px, py, scale, flip) {
  const rows = SPRITES[sprite];
  if (!rows) return;
  const width = Math.max(...rows.map((r) => r.length));
  if (sprite === 'mira' || sprite === 'liora') {
    light(ctx, px + 15 * scale, py + scale, 8 * scale,
      sprite === 'liora' ? '255,216,135' : '159,81,210', 0.28);
    if (sprite === 'liora') {
      ctx.strokeStyle = 'rgba(255,221,159,0.38)'; ctx.lineWidth = scale / 2;
      ctx.beginPath(); ctx.ellipse(px + 7 * scale, py + scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = SPRITE_COLORS[ch];
      if (!color) continue;
      const dx = flip ? width - 1 - x : x;
      ctx.fillStyle = color;
      ctx.fillRect(px + dx * scale, py + y * scale, scale, scale);
    }
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 7, 16, 0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back || '#1a1024';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.round(w * clamp(frac, 0, 1))), h);
}

const BIOME_GROUND = {
  throne: '#17151a', crags: '#191820', wraithwood: '#131a13',
  venomfen: '#151a10', village: '#1a1610', bonefields: '#1c1a16',
};
const BIOME_GRASS = {
  throne: '#5a5a52', crags: '#4a5a4a', wraithwood: '#6a6a4a',
  venomfen: '#4a6a2a', village: '#2d4a2a', bonefields: '#5a4a2a',
};

function houseOrigin(map, tx, ty) {
  const variants = map.variants || {};
  for (const key of Object.keys(variants)) {
    const [hx, hy] = key.split(',').map(Number);
    if (tx >= hx && tx <= hx + 1 && ty >= hy && ty <= hy + 1) {
      return { hx, hy, v: variants[key] };
    }
  }
  return null;
}

function drawTile(ctx, ch, px, py, t, seed, tx, ty, map, lit = 0) {
  const s = TILE;
  const biome = biomeAt(tx, ty);
  const ground = BIOME_GROUND[biome] || '#1c1a16';
  if (ch === '.' || ch === ',') {
    ctx.fillStyle = hash2(tx, ty, 1) > 0.5 ? ground : '#141210';
    ctx.fillRect(px, py, s, s);
    // Seeded speckles: ash, bone flecks and scorched patches, stable per tile.
    for (let i = 0; i < 5; i += 1) {
      const hx = hash2(tx, ty, 10 + i);
      const hy = hash2(tx, ty, 20 + i);
      ctx.fillStyle = hx > 0.66 ? '#2a2620' : hx > 0.33 ? '#100e12' : '#232019';
      ctx.fillRect(px + 3 + hx * 24, py + 3 + hy * 24, 3, 3);
    }
    // Ground cracks: dark jagged lines, one or two per tile.
    const cracks = hash2(tx, ty, 60) > 0.5 ? 2 : 1;
    ctx.fillStyle = '#0d0a0e';
    for (let i = 0; i < cracks; i += 1) {
      const cx = px + 4 + hash2(tx, ty, 61 + i) * 20;
      const cy = py + 4 + hash2(tx, ty, 65 + i) * 18;
      ctx.fillRect(cx, cy, 10, 2);
      ctx.fillRect(cx + 4, cy + 2, 2, 8);
      ctx.fillRect(cx + 8, cy - 2, 2, 4);
    }
    // Dark moss patches and mossy stones.
    if (hash2(tx, ty, 70) > 0.45) {
      ctx.fillStyle = '#1c2a16';
      ctx.fillRect(px + 6 + hash2(tx, ty, 71) * 14, py + 6 + hash2(tx, ty, 72) * 14, 10, 6);
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(px + 10 + hash2(tx, ty, 73) * 10, py + 10 + hash2(tx, ty, 74) * 10, 5, 4);
    }
    // Exposed roots snaking across the ground.
    if (hash2(tx, ty, 80) > 0.6) {
      ctx.fillStyle = '#3a2c1e';
      ctx.fillRect(px + 2, py + 22 + hash2(tx, ty, 81) * 4, 28, 3);
      ctx.fillRect(px + 8 + hash2(tx, ty, 82) * 12, py + 24, 3, 5);
    }
    // A dark puddle, catching no light.
    if (hash2(tx, ty, 90) > 0.72) {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(px + 8 + hash2(tx, ty, 91) * 10, py + 8 + hash2(tx, ty, 92) * 10, 12, 5);
    }
    if (biome === 'throne' || biome === 'bonefields') {
      ctx.fillStyle = '#3a3630';
      ctx.fillRect(px + 8 + hash2(tx, ty, 31) * 14, py + 10 + hash2(tx, ty, 32) * 10, 4, 2);
    }
    const grass = BIOME_GRASS[biome] || '#2d4a2a';
    ctx.fillStyle = '#1a2418';
    const sway = Math.sin(t * 1.5 + seed) * 1;
    ctx.fillRect(px + 6 + sway, py + 8, 2, 8);
    ctx.fillRect(px + 18 - sway, py + 14, 2, 7);
    if (ch === ',') {
      ctx.fillStyle = grass;
      ctx.fillRect(px + 4, py + 4, 3, 10);
      ctx.fillRect(px + 12, py + 10, 3, 12);
      ctx.fillRect(px + 22, py + 5, 3, 9);
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(px + 15, py + 18, 2, 6);
    }
    return;
  }
  if (ch === '#') {
    // Cobblestone: dark stones with seeded shade and mortar gaps.
    ctx.fillStyle = '#2e2318';
    ctx.fillRect(px, py, s, s);
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        const h = hash2(tx, ty, 40 + r * 2 + c);
        ctx.fillStyle = h > 0.66 ? '#4a3826' : h > 0.33 ? '#3a2c1e' : '#2a2016';
        ctx.fillRect(px + 2 + c * 15, py + 2 + r * 15, 13, 13);
      }
    }
    ctx.fillStyle = '#241a12';
    ctx.fillRect(px + 5, py + 7, 6, 3);
    ctx.fillRect(px + 20, py + 20, 7, 3);
    return;
  }
  if (ch === 'T') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    if (biome === 'crags') {
      // A stone crag: grey rock with spikes.
      ctx.fillStyle = '#2a2a34';
      ctx.fillRect(px + 6, py + 4, 20, 24);
      ctx.fillStyle = '#3a3a48';
      ctx.fillRect(px + 9, py + 6, 14, 18);
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(px + 4, py + 2, 4, 8);
      ctx.fillRect(px + 24, py + 2, 4, 8);
      ctx.fillRect(px + 14, py + 24, 4, 8);
      return;
    }
    if (biome === 'wraithwood' || biome === 'throne') {
      // A dead tree: bare grey-brown branches.
      ctx.fillStyle = '#3a322a';
      ctx.fillRect(px + 14, py + 10, 4, 22);
      ctx.fillRect(px + 6, py + 8, 20, 3);
      ctx.fillRect(px + 4, py + 14, 10, 3);
      ctx.fillRect(px + 20, py + 6, 8, 3);
      ctx.fillRect(px + 8, py + 18, 4, 6);
      return;
    }
    // A dark pine: near-black canopy, faint green light.
    ctx.fillStyle = PALETTE.leafDark;
    ctx.fillRect(px + 4, py + 2, 24, 18);
    ctx.fillStyle = PALETTE.leaf;
    ctx.fillRect(px + 7, py + 5, 18, 12);
    ctx.fillStyle = '#2a1f16';
    ctx.fillRect(px + 14, py + 20, 4, 12);
    return;
  }
  if (ch === 't') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#453a2e';
    ctx.fillRect(px + 14, py + 8, 4, 24);
    ctx.fillRect(px + 5, py + 6, 22, 3);
    ctx.fillRect(px + 3, py + 13, 11, 3);
    ctx.fillRect(px + 20, py + 4, 9, 3);
    ctx.fillStyle = '#2a241c';
    ctx.fillRect(px + 9, py + 20, 3, 6);
    return;
  }
  if (ch === '~') {
    if (biome === 'venomfen') {
      // Poison river: sick green water, purple bubbles, poison glint.
      ctx.fillStyle = '#232d12';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#3a5a1a';
      const wob = Math.sin(t * 2 + seed * 3) * 2;
      ctx.fillRect(px + 3, py + 8 + wob, 26, 3);
      ctx.fillRect(px + 6, py + 20 - wob, 20, 3);
      ctx.fillStyle = '#8a3ad8';
      ctx.fillRect(px + 8 + hash2(tx, ty, 51) * 14, py + 12, 3, 3);
      ctx.fillRect(px + 18, py + 16 + wob, 3, 3);
      ctx.fillStyle = '#7ac74a';
      ctx.fillRect(px + 10, py + 14, 10, 2);
      return;
    }
    ctx.fillStyle = PALETTE.waterDark;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#1a3a4a';
    const wob = Math.sin(t * 2 + seed * 3) * 2;
    ctx.fillRect(px + 3, py + 8 + wob, 26, 3);
    ctx.fillRect(px + 6, py + 20 - wob, 20, 3);
    return;
  }
  if (ch === 'H') {
    const origin = houseOrigin(map, tx, ty);
    const v = origin ? origin.v : 0;
    const qx = origin ? tx - origin.hx : 0;
    const qy = origin ? ty - origin.hy : 0;
    const roofColors = ['#5a1f24', '#3a2450', '#2a2a34', '#4a2a1a', '#3a3a44'];
    const roof = roofColors[v % roofColors.length];
    const flicker = 0.65 + 0.35 * Math.abs(Math.sin(t * 1.7 + seed * 2.1));
    if (qy === 0) {
      // Roof row.
      ctx.fillStyle = '#241c18';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = roof;
      if (v === 1) {
        ctx.fillRect(px + 2, py + 2, 28, 12);
        ctx.fillStyle = '#241832';
        ctx.fillRect(px + 10, py + 2, 12, 12);
      } else if (v === 3) {
        ctx.fillRect(px + 2, py + 8, 28, 10);
        ctx.fillRect(px + 6, py + 4, 20, 6);
      } else {
        ctx.fillRect(px, py + 4, s, 12);
        ctx.fillStyle = '#1a1214';
        ctx.fillRect(px + 2, py + 14, 28, 3);
      }
      // Chimneys on variants 0 and 2, with rising smoke.
      if (v === 0 || v === 2) {
        const cx = v === 0 ? px + 22 : px + 6;
        ctx.fillStyle = '#2a2a30';
        ctx.fillRect(cx, py - 2, 6, 10);
        for (let i = 0; i < 3; i += 1) {
          const prog = (t * 0.22 + i / 3 + seed * 0.13) % 1;
          ctx.globalAlpha = 0.28 * (1 - prog);
          ctx.fillStyle = '#8a8a96';
          const sw = 4 + prog * 6;
          ctx.fillRect(cx + 1 + Math.sin(t + i * 2) * 2 - sw / 2, py - 6 - prog * 24, sw, sw);
          ctx.globalAlpha = 1;
        }
      }
      return;
    }
    // Wall row: dark stone, a lit window, a door. The village grows
    // brighter as crystals are won: windows glow warmer with each one.
    ctx.fillStyle = v === 4 ? '#3a3630' : '#2e2824';
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#1a1512';
    ctx.fillRect(px, py + 26, s, 6);
    const winX = qx === 0 ? px + 5 : px + 20;
    ctx.globalAlpha = Math.min(1, flicker + lit * 0.15);
    ctx.fillStyle = lit >= 2 ? '#ffd27a' : '#ffb347';
    ctx.fillRect(winX, py + 8, 7, 8);
    ctx.globalAlpha = 1;
    if (lit >= 1) {
      ctx.globalAlpha = 0.25 + lit * 0.12;
      ctx.fillStyle = '#ff8a3c';
      ctx.fillRect(winX - 3, py + 5, 13, 14);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#1a1214';
    ctx.fillRect(winX + 3, py + 8, 1, 8);
    if ((v === 0 && qx === 1) || (v === 1 && qx === 0) || (v === 2 && qx === 1) || (v === 3 && qx === 0) || (v === 4 && qx === 1)) {
      ctx.fillStyle = '#241a12';
      ctx.fillRect(px + (qx === 0 ? 20 : 6), py + 14, 8, 18);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(px + (qx === 0 ? 25 : 11), py + 20, 2, 2);
    }
    if (v === 3 && qx === 1) {
      // A lantern by the crooked hut's door.
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3 + seed);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(px + 2, py + 6, 4, 5);
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (ch === 'S') {
    ctx.fillStyle = '#1e1a2e';
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#3a3450';
    ctx.fillRect(px + 6, py + 18, 20, 14);
    ctx.fillRect(px + 10, py + 8, 12, 12);
    const glow = tx === 5 && ty === 5 ? '#9ac8ff' : tx === 34 && ty === 7 ? '#e8a33d' : '#5ad8c8';
    const pulse = 0.6 + Math.sin(t * 3 + seed) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = glow;
    ctx.fillRect(px + 13, py + 11, 6, 6);
    ctx.globalAlpha = 1;
    return;
  }
  if (ch === 'X') {
    ctx.fillStyle = '#120e1a';
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#241a30';
    ctx.fillRect(px + 4, py + 4, 24, 10);
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(px + 12, py + 14, 8, 18);
    ctx.fillStyle = PALETTE.ember;
    ctx.fillRect(px + 14, py + 6, 4, 6);
    ctx.fillStyle = '#c8ccd4';
    ctx.fillRect(px + 5, py + 2, 2, 6);
    ctx.fillRect(px + 25, py + 2, 2, 6);
    return;
  }
  if (ch === 'F') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    if (biome === 'wraithwood') {
      // Pale mushrooms that glow faintly in the wraithwood.
      ctx.fillStyle = '#7ac74a';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + seed);
      ctx.fillRect(px + 7, py + 9, 4, 4);
      ctx.fillRect(px + 20, py + 16, 4, 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(px + 8, py + 13, 2, 4);
      ctx.fillRect(px + 21, py + 20, 2, 4);
      return;
    }
    // Ember flowers: dim orange sparks in the dark grass.
    ctx.fillStyle = '#c73e2c';
    ctx.fillRect(px + 7, py + 9, 4, 4);
    ctx.fillRect(px + 20, py + 16, 4, 4);
    ctx.fillStyle = '#e8a33d';
    ctx.fillRect(px + 14, py + 5, 4, 4);
    return;
  }
  if (ch === 'R') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    if (biome === 'bonefields' || biome === 'throne') {
      // Bones in the ash.
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(px + 6, py + 14, 16, 3);
      ctx.fillRect(px + 9, py + 11, 4, 4);
      ctx.fillRect(px + 18, py + 11, 4, 4);
      ctx.fillRect(px + 12, py + 20, 8, 3);
      return;
    }
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(px + 6, py + 10, 20, 16);
    ctx.fillStyle = '#4a4a56';
    ctx.fillRect(px + 9, py + 12, 10, 6);
    return;
  }
  if (ch === 'B') {
    ctx.fillStyle = PALETTE.waterDark;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#4a3423';
    ctx.fillRect(px, py + 6, s, 20);
    ctx.fillStyle = '#2e2015';
    ctx.fillRect(px, py + 6, s, 3);
    ctx.fillRect(px, py + 23, s, 3);
    ctx.fillRect(px + 8, py + 12, 2, 8);
    ctx.fillRect(px + 22, py + 12, 2, 8);
    return;
  }
  if (ch === 'G') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(px + 10, py + 10, 12, 18);
    ctx.fillRect(px + 14, py + 4, 4, 8);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(px + 14, py + 16, 4, 6);
    ctx.fillStyle = '#2d4a2a';
    ctx.fillRect(px + 8, py + 24, 4, 3);
    return;
  }
  if (ch === 'U') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#33303c';
    ctx.fillRect(px + 8, py + 6, 16, 22);
    ctx.fillStyle = '#241f2a';
    ctx.fillRect(px + 8, py + 6, 16, 4);
    ctx.fillRect(px + 14, py + 14, 3, 14);
    ctx.fillStyle = '#4a4456';
    ctx.fillRect(px + 10, py + 10, 6, 4);
    return;
  }
  if (ch === 'L') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#2a2015';
    ctx.fillRect(px + 14, py + 10, 4, 22);
    ctx.fillStyle = '#3a2c1e';
    ctx.fillRect(px + 10, py + 6, 12, 4);
    const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * 3 + seed * 1.3));
    ctx.globalAlpha = flick;
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(px + 13, py + 8, 6, 6);
    ctx.globalAlpha = flick * 0.35;
    ctx.fillStyle = '#ff8a3c';
    ctx.fillRect(px + 8, py + 3, 16, 16);
    ctx.globalAlpha = 1;
    return;
  }
  if (ch === 'W') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(px + 7, py + 12, 18, 16);
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(px + 10, py + 15, 12, 10);
    ctx.fillStyle = '#4a2a1a';
    ctx.fillRect(px + 5, py + 6, 22, 5);
    ctx.fillRect(px + 7, py + 11, 3, 6);
    ctx.fillRect(px + 22, py + 11, 3, 6);
    return;
  }
  if (ch === 'K') {
    // A hearthfire: a stone ring, crossed logs, and a flame that warms
    // the tile. Interact here to save the game.
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(px + 4, py + 22, 6, 5);
    ctx.fillRect(px + 22, py + 22, 6, 5);
    ctx.fillRect(px + 8, py + 26, 6, 4);
    ctx.fillRect(px + 18, py + 26, 6, 4);
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(px + 6, py + 24, 20, 4);
    ctx.fillRect(px + 8, py + 22, 16, 3);
    const flame = 8 + Math.sin(t * 7 + seed) * 3;
    ctx.fillStyle = PALETTE.emberDeep;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 22);
    ctx.lineTo(px + 16, py + 22 - flame);
    ctx.lineTo(px + 22, py + 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(px + 13, py + 22);
    ctx.lineTo(px + 16, py + 22 - flame * 0.6);
    ctx.lineTo(px + 19, py + 22);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff8a3c';
    ctx.fillRect(px + 6, py + 8, 20, 12);
    ctx.globalAlpha = 1;
    return;
  }
  if (ch === 'P') {
    // The poison flood: sick-green water pooling onto the land, big
    // bubbles, toxic fog, dead banks and scattered bones. The water is
    // bright enough to read as a flooding river, not dark ground.
    ctx.fillStyle = '#2a4a16';
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#3f6a20';
    const wob = Math.sin(t * 1.6 + seed * 2) * 2;
    ctx.fillRect(px + 2, py + 10 + wob, 28, 4);
    ctx.fillRect(px + 4, py + 22 - wob, 24, 3);
    ctx.fillStyle = '#7ac74a';
    ctx.fillRect(px + 6, py + 12, 14, 2);
    ctx.fillRect(px + 12, py + 20, 10, 2);
    // Big poison bubbles, rising and popping.
    const b1 = (t * 0.4 + hash2(tx, ty, 95)) % 1;
    ctx.globalAlpha = 0.7 * (1 - b1);
    ctx.fillStyle = '#8a3ad8';
    ctx.fillRect(px + 8 + hash2(tx, ty, 96) * 12, py + 24 - b1 * 20, 5, 5);
    ctx.fillRect(px + 18, py + 22 - ((b1 + 0.5) % 1) * 18, 4, 4);
    ctx.globalAlpha = 1;
    // Dead bank: a bone and a withered stalk at the edge.
    if (hash2(tx, ty, 97) > 0.5) {
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(px + 4, py + 26, 10, 2);
      ctx.fillStyle = '#3a322a';
      ctx.fillRect(px + 24, py + 20, 2, 8);
    }
    return;
  }
  if (ch === 'C') {
    ctx.fillStyle = ground;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#4a3423';
    ctx.fillRect(px + 5, py + 12, 22, 10);
    ctx.fillStyle = '#2e2015';
    ctx.fillRect(px + 7, py + 24, 5, 5);
    ctx.fillRect(px + 20, py + 24, 5, 5);
    ctx.fillStyle = '#6a5a2a';
    ctx.fillRect(px + 8, py + 8, 14, 5);
    return;
  }
  ctx.fillStyle = ground;
  ctx.fillRect(px, py, s, s);
}

/** A giant landmark, drawn across its whole tile rect and beyond — the
 *  features that dominate the frame. `lm` is a LANDMARKS entry
 *  {type, x, y, w, h}. All geometry is fixed or hash2-seeded: no dice. */
function drawLandmark(ctx, lm, camX, camY, time) {
  const x0 = lm.x * TILE - camX;
  const y0 = lm.y * TILE - camY;
  const w = lm.w * TILE;
  const h = lm.h * TILE;
  if (lm.type === 'spirittree') {
    // A towering spirit tree: the canopy covers the top of the screen,
    // the trunk is twisted and wide, giant roots burst from the ground,
    // and ghost wisps drift around it. The canopy is lit pale green from
    // within, so the tree reads against the dark ground — never a black
    // smudge.
    ctx.fillStyle = '#22401f';
    ctx.fillRect(x0 - 20, y0 - 60, w + 40, 70);
    ctx.fillStyle = '#2f5a2a';
    ctx.fillRect(x0 - 8, y0 - 40, w + 16, 44);
    ctx.fillStyle = '#41703a';
    ctx.fillRect(x0 + 6, y0 - 28, w - 12, 26);
    // Pale lit leaves, speckled across the canopy.
    ctx.fillStyle = '#5a9a4a';
    for (let i = 0; i < 14; i += 1) {
      const lx = x0 - 14 + hash2(i, 1, 7) * (w + 28);
      const ly = y0 - 56 + hash2(i, 2, 7) * 52;
      ctx.fillRect(lx, ly, 5, 4);
    }
    // The twisted trunk, pale bark catching the green light.
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(x0 + w / 2 - 9, y0 - 10, 18, h + 10);
    ctx.fillStyle = '#7a6242';
    ctx.fillRect(x0 + w / 2 - 6, y0 - 10, 6, h + 10);
    ctx.fillRect(x0 + w / 2 - 14, y0 + 10, 8, 14);
    ctx.fillRect(x0 + w / 2 + 8, y0 + 22, 8, 12);
    // Giant roots, bursting from the ground.
    ctx.fillStyle = '#4a3826';
    ctx.fillRect(x0 - 6, y0 + h - 12, 22, 8);
    ctx.fillRect(x0 + w - 16, y0 + h - 12, 22, 8);
    ctx.fillRect(x0 + w / 2 - 16, y0 + h - 8, 32, 8);
    // Ghost wisps, drifting — bright, so they read at a glance.
    for (let i = 0; i < 5; i += 1) {
      const wy = y0 + 10 + ((time * 14 + i * 26) % (h - 10));
      ctx.globalAlpha = 0.7 * (1 - (wy - y0) / h);
      ctx.fillStyle = '#dff2ff';
      ctx.fillRect(x0 + 8 + i * 10, wy, 6, 10);
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (lm.type === 'cave') {
    // A giant cave mouth: several tiles wide, great stalactites hanging,
    // pitch darkness inside, and faint glowing eyes within.
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(x0 - 8, y0 - 8, w + 16, h + 8);
    ctx.fillStyle = '#050308';
    ctx.fillRect(x0 + 8, y0 + 6, w - 16, h - 6);
    // Stalactites, hanging from the mouth.
    ctx.fillStyle = '#2a2a34';
    for (let i = 0; i < 5; i += 1) {
      const sx = x0 + 12 + i * 22;
      const sl = 14 + hash2(i, lm.x, 3) * 16;
      ctx.beginPath();
      ctx.moveTo(sx, y0 + 6);
      ctx.lineTo(sx + 6, y0 + 6 + sl);
      ctx.lineTo(sx + 12, y0 + 6);
      ctx.closePath();
      ctx.fill();
    }
    // Big rocks around the mouth.
    ctx.fillStyle = '#24242e';
    ctx.fillRect(x0 - 4, y0 + h - 16, 18, 16);
    ctx.fillRect(x0 + w - 14, y0 + h - 14, 18, 14);
    // Faint glowing eyes, deep inside.
    const blink = 0.4 + 0.3 * Math.abs(Math.sin(time * 0.8));
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(x0 + w / 2 - 12, y0 + h - 26, 4, 3);
    ctx.fillRect(x0 + w / 2 + 8, y0 + h - 26, 4, 3);
    ctx.globalAlpha = 1;
    return;
  }
  if (lm.type === 'giantbones') {
    // The ribs of an ancient creature, rising out of the ash.
    ctx.fillStyle = '#c8ccd4';
    for (let i = 0; i < 4; i += 1) {
      const bx = x0 + 10 + i * 28;
      ctx.fillRect(bx, y0 + 6, 8, h - 6);
      ctx.fillRect(bx + 4, y0 + 2, 4, 8);
    }
    ctx.fillStyle = '#8a8a92';
    ctx.fillRect(x0 + 6, y0 + h - 10, w - 12, 8);
    ctx.fillRect(x0 + 2, y0 + h - 18, 12, 8);
    return;
  }
  if (lm.type === 'statue') {
    // A giant broken statue: a headless torso, one arm reaching up.
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(x0 + w / 2 - 14, y0 + 20, 28, h - 20);
    ctx.fillStyle = '#4a4a56';
    ctx.fillRect(x0 + w / 2 - 10, y0 + 24, 20, 16);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(x0 + w / 2 - 16, y0 + 8, 32, 12);
    ctx.fillRect(x0 + w / 2 + 10, y0 - 8, 8, 28);
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(x0 + w / 2 - 4, y0 + 30, 8, 10);
    return;
  }
  if (lm.type === 'thorns') {
    // Giant thorns, jutting from the ground like black spears.
    ctx.fillStyle = '#1a1a20';
    for (let i = 0; i < 4; i += 1) {
      const tx0 = x0 + 8 + i * 16;
      const th = 40 + hash2(i, lm.y, 5) * 30;
      ctx.beginPath();
      ctx.moveTo(tx0, y0 + h);
      ctx.lineTo(tx0 + 7, y0 + h - th);
      ctx.lineTo(tx0 + 14, y0 + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#5a0f0f';
    ctx.fillRect(x0 + 12, y0 + h - 12, 4, 4);
    ctx.fillRect(x0 + 40, y0 + h - 20, 4, 4);
    return;
  }
}

function drawHud(ctx, field, muted, showQuest = true) {
  const { party, gold, crystals } = field.state;
  const active = party.filter((h) => h.active);
  panel(ctx, 12, 12, 280, 224);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  active.forEach((hero, i) => {
    const y = 20 + i * 50;
    ctx.fillStyle = hero.hp <= 0 ? '#8a7a6a' : PALETTE.ink;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${hero.name} Lv${hero.level}`, 22, y);
    const nameW = ctx.measureText(`${hero.name} Lv${hero.level}`).width;
    ctx.fillStyle = hero.classColor || PALETTE.gold;
    ctx.font = '11px monospace';
    ctx.fillText(hero.cls, 22 + nameW + 8, y + 1);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '10px monospace';
    ctx.fillText(`${hero.role} · ${hero.weapon}`, 22, y + 15);
    bar(ctx, 22, y + 28, 160, 8, hero.hp / hero.maxHp, hero.hp / hero.maxHp < 0.3 ? PALETTE.hpLow : PALETTE.hp);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '11px monospace';
    ctx.fillText(`${hero.hp}/${hero.maxHp}`, 188, y + 26);
    bar(ctx, 22, y + 38, 160, 6, hero.mp / hero.maxMp, PALETTE.mp);
    ctx.fillText(`${hero.mp}/${hero.maxMp}`, 188, y + 36);
  });
  panel(ctx, VIEW_W - 190, 12, 178, 68);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`◆ ${crystals.size}/3  `, VIEW_W - 178, 20);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(`Gold ${gold}`, VIEW_W - 178, 38);
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '11px monospace';
  ctx.fillText(muted ? 'M: sound off' : 'M: sound on', VIEW_W - 178, 56);
  // Quest tracker along the bottom — hidden on the end screens, where the
  // quest is over and its text would contradict the result panel.
  if (showQuest) {
    panel(ctx, 12, VIEW_H - 34, VIEW_W - 24, 24);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`QUEST: ${field.quest()}`, 22, VIEW_H - 27);
  }
}

function drawParty(ctx, field) {
  const { party, partyMode, partyCursor, partySelected, equipSlot } = field.state;
  const equip = partyMode === 'equip';
  ctx.fillStyle = 'rgba(5, 3, 10, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, 80, 36, 800, 468);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(equip ? 'EQUIPMENT' : 'PARTY', 100, 50);
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '12px monospace';
  ctx.fillText(equip ? 'Choose a hero, then a slot — Enter cycles what they wear.' : 'Four fight. Two wait in Aldermere and gain 50% XP.', 100, 80);
  party.forEach((hero, i) => {
    const y = 108 + i * 58;
    const selected = partyCursor === i;
    const picking = partySelected === i;
    if (selected) {
      ctx.strokeStyle = picking ? PALETTE.ember : PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(96, y - 6, 768, 54);
    }
    drawSprite(ctx, hero.sprite, 104, y, 2, false);
    ctx.fillStyle = hero.hp <= 0 ? '#8a7a6a' : PALETTE.ink;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${hero.name} Lv${hero.level}`, 150, y);
    ctx.fillStyle = hero.classColor || PALETTE.gold;
    ctx.font = '11px monospace';
    ctx.fillText(`${hero.cls} · ${hero.role}`, 150, y + 18);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '11px monospace';
    ctx.fillText(hero.weapon, 150, y + 32);
    // Active / reserve label, dimmed for reserves.
    ctx.globalAlpha = hero.active ? 1 : 0.55;
    ctx.fillStyle = hero.active ? PALETTE.gold : PALETTE.inkDim;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(hero.active ? 'ACTIVE' : 'RESERVE', 856, y + 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    bar(ctx, 380, y + 4, 150, 8, hero.hp / hero.maxHp, hero.hp / hero.maxHp < 0.3 ? PALETTE.hpLow : PALETTE.hp);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '11px monospace';
    ctx.fillText(`${hero.hp}/${hero.maxHp}`, 536, y + 2);
    bar(ctx, 380, y + 16, 150, 6, hero.mp / hero.maxMp, PALETTE.mp);
    ctx.fillText(`${hero.mp}/${hero.maxMp}`, 536, y + 14);
    if (equip) {
      const slots = ['weapon', 'armor', 'accessory'];
      slots.forEach((slot, si) => {
        const item = hero.equipment[slot];
        const slotX = 580 + si * 92;
        if (equipSlot === si && selected) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.lineWidth = 1;
          ctx.strokeRect(slotX - 2, y + 24, 88, 20);
        }
        ctx.fillStyle = item ? PALETTE.ink : PALETTE.inkDim;
        ctx.font = '10px monospace';
        ctx.fillText(item ? item.name : '—', slotX, y + 28);
      });
    } else {
      ctx.fillStyle = PALETTE.inkDim;
      ctx.font = '11px monospace';
      const eq = [hero.equipment.weapon, hero.equipment.armor, hero.equipment.accessory].filter(Boolean).map((e) => e.name).join(' · ');
      ctx.fillText(eq || 'No equipment', 580, y + 28);
    }
  });
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '12px monospace';
  ctx.fillText('Tab — Party / Equipment    ↑ ↓ — hero    ← → — slot    Enter — swap / equip    Esc — close', 100, 478);
}

function drawDialog(ctx, dialog) {
  const boxY = VIEW_H - 150;
  panel(ctx, 40, boxY, VIEW_W - 80, 104);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(dialog.name, 58, boxY + 10);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '15px monospace';
  const lines = wrapText(ctx, dialog.lines[dialog.index], VIEW_W - 140);
  lines.forEach((line, i) => ctx.fillText(line, 58, boxY + 34 + i * 20));
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '11px monospace';
  ctx.fillText('E / Space / Click: continue', VIEW_W - 220, boxY + 84);
}

// Render-only scenery: coordinates never participate in movement or encounters.
function light(ctx, x, y, radius, rgb, alpha) {
  // Stepped flat discs, not a smooth radial gradient: flat bands compress
  // far better in the screenshot PNG (the smooth gradients were the field
  // shot's biggest cost — the environment pass alone added ~110 KiB), and
  // three steps still read as a soft falloff. Drawn largest-first so the
  // centre is the brightest.
  for (const [f, a] of [[1, 0.3], [0.62, 0.6], [0.32, 1]]) {
    ctx.fillStyle = `rgba(${rgb},${(alpha * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * f, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnvironment(ctx, map, cx, cy, t) {
  const line = (points, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };
  const shape = (points, color) => {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  ctx.save(); ctx.translate(-cx, -cy);
  // Floodwater spreads far beyond the original river, with the bridge left legible.
  for (let i = 0; i < 26; i++) {
    const x = 935 + Math.sin(i * 2.7) * 28;
    const y = 414 + i * 13;
    if (Math.abs(y - 590) < 22) continue;
    ctx.fillStyle = 'rgba(44,65,30,0.58)';
    ctx.beginPath(); ctx.ellipse(x + 100, y, 144 + Math.sin(i) * 22, 22, 0, 0, Math.PI * 2); ctx.fill();
    const by = y - ((t * 9 + i * 7) % 20);
    ctx.strokeStyle = '#66794a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + 30 + (i * 29) % 140, by, 2 + (i % 4), 0, Math.PI * 2); ctx.stroke();
    if (i % 3 === 0) light(ctx, x + 80, y, 65, '103,62,135', 0.07);
  }
  // Seeded biome dressing; cosmetic props never replace map tiles.
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const ch = tileAt(map, x, y), b = biomeAt(x, y), h = hash2(x, y, 77);
    if (ch === 'L' || ch === 'S') light(ctx, x * TILE + 16, y * TILE + 10, ch === 'L' ? 85 : 60, ch === 'L' ? '255,108,35' : '148,80,185', 0.22 + Math.sin(t * 3 + x) * 0.035);
    if (!['.', ',', 'F'].includes(ch) || h < 0.82) continue;
    const px = x * TILE + 8, py = y * TILE + 18;
    if (b === 'bonefields' || b === 'venomfen') {
      line([[px,py],[px+12,py+5]], '#80766a', 2);
      ctx.fillStyle = '#938779'; ctx.fillRect(px+4,py-5,7,6);
      ctx.fillStyle = '#16111c'; ctx.fillRect(px+5,py-4,2,2); ctx.fillRect(px+9,py-3,2,2);
    } else if (b === 'wraithwood') {
      line([[px,py+10],[px+3,py-5],[px+12,py-9]], '#443448', 2);
      ctx.fillStyle = '#a294b9'; ctx.fillRect(px+11,py-11,3,2);
    } else if (b === 'village') {
      line([[px,py+8],[px,py-8]], '#403133', 3);
      line([[px-5,py-4],[px+5,py-4]], '#59434a', 2);
    } else {
      shape([[px-6,py+9],[px,py-14],[px+11,py+6]], '#342b3d');
      line([[px,py-10],[px+3,py+4]], '#504052', 1);
    }
  }
  // Monumental cliffs and a fanged cave, spanning most of the western skyline.
  shape([[0,0],[420,0],[446,70],[412,150],[358,174],[306,127],[265,191],[204,150],[135,180],[70,145],[0,180]], '#26222e');
  for (let i=0;i<12;i++) line([[i*38,0],[i*38+14,70],[i*38-3,135]], '#39303f', 3);
  shape([[36,145],[45,86],[87,42],[190,30],[274,63],[310,145]], '#09060e');
  for(let i=0;i<9;i++) {
    const x=50+i*27;
    shape([[x,68-Math.sin(i)*15],[x+22,66],[x+12,110+(i%3)*14]], '#514555');
    shape([[x,149],[x+17,149],[x+9,123-(i%2)*9]], '#3a303e');
  }
  for(const x of [124,155,217,241]) { light(ctx,x,121,25,'210,34,29',0.34); ctx.fillStyle='#ec543d'; ctx.fillRect(x,120,7,3); }
  // Ancient spirit trees: crowns extend above the map; roots reach across the earth.
  // (Trunk kept narrow so the tree reads as a tree, not a wall; the
  // landmark statue and ribcage already stand in the Bonefields below,
  // so this pass draws no second ribcage or idol there.)
  for(const [x,y] of [[805,230],[1140,170]]) {
    for(let i=0;i<7;i++) {
      const dx=(i-3)*29;
      line([[x,y-80],[x+dx*.4,y-180],[x+dx*1.6,-60]], '#29202f', 8-i%3*2);
      line([[x,y-25],[x+dx*.6,y+10],[x+dx*1.7,y+42]], '#3f3047', 9-i%3);
    }
    shape([[x-26,y+12],[x-18,y-75],[x-12,-40],[x+20,-40],[x+16,y-65],[x+30,y+18],[x,y-5]], '#302636');
    for(let i=0;i<6;i++) line([[x-14+i*7,-20],[x-10+i*6,y-72],[x-22+i*9,y]], '#524052', 2);
    light(ctx,x,y-70,75,'118,76,162',0.23);
    for(let i=0;i<4;i++) { const wx=x+Math.sin(t*.6+i*2)*85, wy=y-20-i*36+Math.sin(t+i*2)*8; light(ctx,wx,wy,19,'182,136,225',0.22); ctx.fillStyle='#b6a0c4';ctx.fillRect(wx,wy,3,4); }
  }
  // Thorn crown above the throne and a ruined village bell tower.
  for(let i=0;i<6;i++) {
    const x=530+i*35;
    line([[x,95],[x-22,30],[x+8,-40]], '#39202e', 13);
    shape([[x-12,50],[x+22,15],[x-6,27]], '#692d3b');
  }
  shape([[36,865],[44,672],[62,611],[80,669],[96,866]], '#302833');
  shape([[49,679],[62,648],[76,680],[75,716],[49,716]], '#0c0911');
  ctx.fillStyle='#75645a';ctx.fillRect(58,681,10,18);
  // Giant hooked brambles mark the drowned eastern bank.
  for (let i=0;i<5;i++) {
    const x=1200+i*13, y=770-i*26;
    line([[x+30,870],[x-18,y+35],[x-50,y-70],[x-23,y-100]], '#302033', 12);
    shape([[x-30,y],[x-83,y-35],[x-43,y-24]], '#653143');
  }
  // Two depths of drifting ground mist, spatially fixed to each biome.
  // (Kept to two thin layers: smooth gradients are the screenshot's
  // biggest cost, and three layers pushed the field shot over 256 KiB.)
  for(let layer=0;layer<2;layer++) for(let i=0;i<6;i++) {
    const x=(i*257+t*(5+layer*4))%(map.w*TILE+260)-130;
    const y=70+(i*173+layer*61)%(map.h*TILE);
    const b=biomeAt(Math.floor(Math.max(0,x)/TILE),Math.floor(y/TILE));
    const g=ctx.createRadialGradient(x,y,0,x,y,110);
    g.addColorStop(0,b==='venomfen'?'rgba(107,94,121,0.09)':'rgba(117,89,142,0.065)');g.addColorStop(1,'rgba(42,24,55,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,110,16+layer*9,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawField(ctx, field, time, muted, opts = {}) {
  const { map, hero, followers } = field.state;
  const camX = clamp(hero.px + TILE / 2 - VIEW_W / 2, 0, map.w * TILE - VIEW_W);
  const camY = clamp(hero.py + TILE / 2 - VIEW_H / 2, 0, map.h * TILE - VIEW_H);
  const lit = field.state.crystals.size;
  const x0 = Math.max(0, Math.floor(camX / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE));
  const x1 = Math.min(map.w - 1, Math.ceil((camX + VIEW_W) / TILE));
  const y1 = Math.min(map.h - 1, Math.ceil((camY + VIEW_H) / TILE));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      // Landmark tiles get only their ground: the giant feature is drawn
      // over them afterwards, so a regular tree never pokes through it.
      if (landmarkAt(x, y)) {
        const biome = biomeAt(x, y);
        ctx.fillStyle = BIOME_GROUND[biome] || '#1c1a16';
        ctx.fillRect(x * TILE - camX, y * TILE - camY, TILE, TILE);
        continue;
      }
      drawTile(ctx, tileAt(map, x, y), x * TILE - camX, y * TILE - camY, time, x * 7 + y * 13, x, y, map, lit);
    }
  }
  drawEnvironment(ctx, map, camX, camY, time);
  // The giant landmarks dominate their zones, drawn after the tiles and
  // before the people, so they read as part of the world.
  for (const lm of map.landmarks || []) {
    if (lm.x + lm.w < x0 - 2 || lm.x > x1 + 2 || lm.y + lm.h < y0 - 2 || lm.y > y1 + 2) continue;
    drawLandmark(ctx, lm, camX, camY, time);
  }
  // NPCs stand on the map, bobbing gently. Torin carries a torch. Tilda
  // hides indoors until the first crystal is won, then comes out.
  for (const npc of NPCS) {
    if (npc.minCrystals && lit < npc.minCrystals) continue;
    const bob = Math.sin(time * 2 + npc.x) * 1.5;
    const nx = npc.x * TILE - camX + 4;
    const ny = npc.y * TILE - camY - 8 + bob;
    if (npc.id === 'torin') {
      const glow = ctx.createRadialGradient(nx + 24, ny + 10, 2, nx + 24, ny + 10, 44);
      glow.addColorStop(0, 'rgba(255, 150, 60, 0.35)');
      glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(nx - 20, ny - 34, 88, 88);
    }
    drawSprite(ctx, npc.sprite, nx, ny, 2, false);
  }
  // The active party walks: the hero, then the active followers.
  const walkers = [
    ...followers.map((w, i) => ({ sprite: w.sprite, w })),
    { sprite: 'ash', w: hero },
  ];
  for (const { sprite, w } of walkers) {
    const bob = w.moving ? Math.sin(time * 18) * 1.5 : 0;
    drawSprite(ctx, sprite, w.px - camX + 4, w.py - camY - 8 + bob, 2, false);
  }
  // Drifting fog, layered: near bands and far wisps, all driven by game time.
  for (let i = 0; i < 6; i += 1) {
    const fx = ((i * 197 + time * 7) % 1200) - 120;
    const fy = 30 + i * 88;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(150, 140, 180, 0.06)' : 'rgba(120, 110, 160, 0.04)';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 150 + (i % 3) * 40, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ambient embers drift up from the hearths, faint and warm.
  for (let i = 0; i < 10; i += 1) {
    const ex = (i * 97 + time * 9) % VIEW_W;
    const ey = VIEW_H - ((time * 22 + i * 53) % (VIEW_H + 40));
    ctx.globalAlpha = 0.2 + 0.2 * Math.abs(Math.sin(time + i * 1.7));
    ctx.fillStyle = i % 3 === 0 ? '#ff5a2a' : '#e8a33d';
    ctx.fillRect(ex, ey, 2, 2);
    ctx.globalAlpha = 1;
  }
  // The party's lantern light: a warm glow near the hero that fades to
  // nothing — it lights the party, it never veils the whole map.
  // Warm light falls off smoothly over the ground.
  const hx = hero.px - camX + TILE / 2;
  const hy = hero.py - camY + TILE / 2;
  light(ctx, hx, hy, 180, '255,110,42', 0.17);
  // A dark vignette closes the edges of the screen, as stepped frame bands
  // that fade toward the centre and leave the map readable.
  const vigSteps = [
    [0, 'rgba(3, 2, 7, 0.35)'],
    [30, 'rgba(3, 2, 7, 0.27)'],
    [65, 'rgba(3, 2, 7, 0.19)'],
    [105, 'rgba(3, 2, 7, 0.12)'],
    [150, 'rgba(3, 2, 7, 0.07)'],
    [200, 'rgba(3, 2, 7, 0.03)'],
  ];
  for (const [inset, col] of vigSteps) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.rect(inset, inset, VIEW_W - inset * 2, VIEW_H - inset * 2);
    ctx.fill('evenodd');
  }
  // Region banner fades in over the map, centred so it never covers the HUD.
  if (field.state.banner && field.state.banner.t < 2.2) {
    const alpha = field.state.banner.t < 0.4 ? field.state.banner.t / 0.4 : field.state.banner.t > 1.8 ? (2.2 - field.state.banner.t) / 0.4 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(7, 5, 12, 0.85)';
    ctx.fillRect(VIEW_W / 2 - 240, 120, 480, 44);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(field.state.banner.text, VIEW_W / 2, 142);
    ctx.globalAlpha = 1;
  }
  // The save toast, just above the quest tracker.
  if (field.state.saveToast && field.state.saveToast.t < 2) {
    const a = field.state.saveToast.t < 0.3 ? field.state.saveToast.t / 0.3 : field.state.saveToast.t > 1.6 ? (2 - field.state.saveToast.t) / 0.4 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(7, 5, 12, 0.85)';
    ctx.fillRect(VIEW_W / 2 - 130, VIEW_H - 66, 260, 26);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(field.state.saveToast.text, VIEW_W / 2, VIEW_H - 59);
    ctx.globalAlpha = 1;
  }
  drawHud(ctx, field, muted, opts.quest !== false);
  if (field.state.partyOpen) drawParty(ctx, field);
  if (field.state.dialog) drawDialog(ctx, field.state.dialog);
}

// Part 2: the battle, the title, victory, game over, pause — and the
// painter itself, which picks the right screen and scales the canvas.

function drawBattle(ctx, combat, time, muted) {
  const { foes, heroes, fx } = combat.state;
  const boss = foes.find((f) => f.boss && f.hp > 0);
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  if (boss) {
    grad.addColorStop(0, '#050308');
    grad.addColorStop(0.55, '#1a0d24');
    grad.addColorStop(1, '#0d0714');
  } else {
    grad.addColorStop(0, '#0d0819');
    grad.addColorStop(0.55, '#241536');
    grad.addColorStop(1, '#120c20');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // The element of the last skill tints the whole battlefield.
  if (fx.bgElement) {
    const alpha = (0.28 + 0.1 * Math.exp(-fx.bgT * 8)) * Math.max(0, 1 - fx.bgT / 2.2);
    ctx.fillStyle = ELEMENT_COLORS[fx.bgElement] || '#ffc857';
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  ctx.save();
  if (fx.shake > 0.2) {
    ctx.translate(fx.shake * Math.sin(time * 47), fx.shake * Math.cos(time * 39));
  }
  ctx.fillStyle = '#0c0918';
  ctx.beginPath();
  ctx.moveTo(0, 330);
  ctx.lineTo(240, 250);
  ctx.lineTo(480, 330);
  ctx.lineTo(720, 260);
  ctx.lineTo(960, 330);
  ctx.lineTo(960, 392);
  ctx.lineTo(0, 392);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1226';
  ctx.fillRect(0, 330, VIEW_W, 62);
  // Impact fractures spread across the ground and cool on game time.
  for (const crack of fx.cracks || []) {
    const growth = Math.min(1, crack.age * 9);
    ctx.globalAlpha = Math.max(0, 1 - crack.age / crack.life);
    ctx.beginPath();
    ctx.moveTo(crack.x, 354);
    for (let j = 1; j <= 5; j += 1) {
      const reach = crack.length * j / 5 * growth;
      ctx.lineTo(crack.x + Math.cos(crack.angle) * reach,
        354 + Math.sin(crack.angle) * reach * 0.27 + (j % 2 ? 3 : -3));
    }
    ctx.strokeStyle = '#060309';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = crack.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Foes, bobbing; a hit foe flashes white and is knocked back.
  foes.forEach((foe) => {
    if (foe.hp <= 0) return;
    const pos = foeSlotPos(foe.slot, foes.length);
    // Bosses draw four scales bigger than their data scale, so they dominate
    // the frame (the data scale stays untouched — unit tests pin it). The
    // Hermes boss sprites are compact (8-9 rows), so +1 left Galehowl a
    // speck lost inside its own ultimate burst; +4 restores its presence.
    const scale = (foe.scale || (foe.boss ? 5 : 4)) + (foe.boss ? 4 : 0);
    const bob = Math.sin(time * 2 + foe.slot * 1.7) * 3;
    const rows = SPRITES[foe.sprite] || [];
    const w = Math.max(14, ...rows.map((r) => r.length)) * scale;
    const h = rows.length * scale;
    const dx = pos.x + (foe.knock || 0) * 26;
    if (foe.boss) {
      // A billowing dark aura around the boss.
      const pulse = 0.4 + 0.18 * Math.sin(time * 2.4 + foe.slot);
      const aura = ctx.createRadialGradient(dx, pos.y, 10, dx, pos.y, 140);
      aura.addColorStop(0, `rgba(90, 40, 160, ${pulse})`);
      aura.addColorStop(0.6, 'rgba(20, 8, 32, 0.35)');
      aura.addColorStop(1, 'rgba(20, 8, 32, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(dx - 150, pos.y - 150, 300, 300);
      for (let i = 0; i < 12; i += 1) {
        const wy = pos.y - 40 - ((time * 24 + i * 40 + foe.slot * 13) % 120);
        ctx.globalAlpha = 0.25 * (1 - (pos.y - 40 - wy) / 120);
        ctx.fillStyle = '#5a2a8a';
        ctx.fillRect(dx + Math.sin(i * 2.4 + time * 0.7) * (w * 0.5 + 10), wy, 4 + i % 3, 12);
        ctx.globalAlpha = 1;
      }
    }
    drawSprite(ctx, foe.sprite, dx - w / 2, pos.y - h / 2 + bob, scale, false);
    if (foe.boss) {
      ctx.save();
      ctx.shadowColor = '#ff241c';
      ctx.shadowBlur = 12 + Math.sin(time * 3) * 3;
      ctx.fillStyle = '#ff3624';
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) if (row[x] === 'r') {
          ctx.fillRect(dx - w / 2 + x * scale, pos.y - h / 2 + bob + y * scale, scale, scale);
        }
      });
      ctx.restore();
    }
    if (foe.flash > 0) {
      // Flash the sprite's own pixels white, not a solid box, so a hit
      // boss keeps its silhouette instead of whiting out into a rectangle.
      ctx.globalAlpha = foe.flash * 0.6;
      ctx.fillStyle = '#ffffff';
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
          if (row[x] !== '.' && row[x] !== ' ') {
            ctx.fillRect(dx - w / 2 + x * scale, pos.y - h / 2 + bob + y * scale, scale, scale);
          }
        }
      });
      ctx.globalAlpha = 1;
    }
    bar(ctx, pos.x - 34, pos.y + h / 2 + 8, 68, 7, foe.hp / foe.maxHp, foe.hp / foe.maxHp < 0.3 ? PALETTE.hpLow : PALETTE.hp);
    ctx.fillStyle = foe.boss ? '#ff5a2a' : PALETTE.ink;
    ctx.font = foe.boss ? 'bold 13px monospace' : 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(foe.name, pos.x, pos.y + h / 2 + 18);
    if (combat.state.menu.mode === 'target' && combat.state.menu.target === foe.slot && combat.state.phase === 'command') {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - h / 2 - 22);
      ctx.lineTo(pos.x - 8, pos.y - h / 2 - 34);
      ctx.lineTo(pos.x + 8, pos.y - h / 2 - 34);
      ctx.closePath();
      ctx.fill();
    }
  });
  // Heroes on the right, backs to the foes, each lit by their class colour.
  // Only the four active heroes fight — reserves wait in the village.
  const heroRows = BATTLE_HERO_Y;
  heroes.filter((h) => h.active).forEach((hero, i) => {
    const y = heroRows[i];
    const dead = hero.hp <= 0;
    const glow = ctx.createRadialGradient(716, y, 4, 716, y, 52);
    glow.addColorStop(0, `${hero.classColor || '#ffc857'}44`);
    glow.addColorStop(1, `${hero.classColor || '#ffc857'}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(660, y - 56, 112, 112);
    ctx.globalAlpha = dead ? 0.35 : 1;
    drawSprite(ctx, hero.sprite, 700, y - 20, 3, false);
    ctx.globalAlpha = 1;
    ctx.fillStyle = dead ? '#8a7a6a' : PALETTE.ink;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${hero.name} Lv${hero.level}`, 752, y - 34);
    ctx.fillStyle = hero.classColor || PALETTE.gold;
    ctx.font = '11px monospace';
    ctx.fillText(`${hero.cls} · ${hero.role}`, 752, y - 20);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.fillText(hero.weapon, 752, y - 8);
    if (hero.poison > 0) {
      const wW = ctx.measureText(hero.weapon).width;
      ctx.fillStyle = '#7ac74a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('POISONED', 752 + wW + 8, y - 8);
    }
    bar(ctx, 752, y + 2, 150, 9, hero.hp / hero.maxHp, hero.hp / hero.maxHp < 0.3 ? PALETTE.hpLow : PALETTE.hp);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '11px monospace';
    ctx.fillText(`${hero.hp}/${hero.maxHp}`, 906, y);
    bar(ctx, 752, y + 15, 150, 6, hero.mp / hero.maxMp, PALETTE.mp);
    ctx.fillText(`${hero.mp}/${hero.maxMp}`, 906, y + 13);
    const currentActor = combat.state.order[combat.state.actorIndex - 1];
    if (combat.state.phase === 'command' && currentActor && currentActor.ref === hero) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(694, y - 48);
      ctx.lineTo(686, y - 60);
      ctx.lineTo(702, y - 60);
      ctx.closePath();
      ctx.fill();
    }
    if (combat.state.menu.mode === 'ally' && combat.state.menu.target === i && combat.state.phase === 'command') {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(696, y - 34, 244, 68);
    }
  });
  ctx.restore();
  // The boss's name, big and menacing, while the fight opens.
  if (boss && combat.state.phase === 'intro') {
    const a = combat.state.phaseT < 0.2 ? combat.state.phaseT / 0.2 : 1;
    ctx.globalAlpha = a;
    gothicText(ctx, boss.name.toUpperCase(), VIEW_W / 2, 84, 'bold 40px monospace', '#ff5a2a', 5);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.id === 'hollowking' ? 'THE COLD THAT STOLE THE HEARTH' : `GUARDIAN OF THE ${boss.id === 'galehowl' ? 'GALE' : boss.id === 'dawnwing' ? 'DAWN' : boss.id === 'griefbelow' ? 'GRIEF' : 'TIDE'} SHRINE`, VIEW_W / 2, 132);
    ctx.globalAlpha = 1;
  }
  // Boss health across the top.
  if (boss) {
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name, VIEW_W / 2, 14);
    bar(ctx, VIEW_W / 2 - 200, 34, 400, 10, boss.hp / boss.maxHp, PALETTE.ember);
  }
  // Command menu (left) and message (right).
  panel(ctx, MENU.x, MENU.y, MENU.w, MENU.h);
  const items = combat.menuItems();
  const menu = combat.state.menu;
  const listX = MENU.x + 18;
  const listY = MENU.y + 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (combat.state.phase === 'command') {
    const key = menu.mode === 'main' ? 'index' : menu.mode;
    const label = menu.mode === 'main' ? '' : menu.mode === 'skill' ? 'SKILL — ' : menu.mode === 'item' ? 'ITEM — ' : menu.mode === 'target' ? 'TARGET — ' : 'ALLY — ';
    if (label) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(label, listX, listY - 2);
    }
    items.forEach((item, i) => {
      const y = listY + (label ? 16 : 0) + i * MENU.itemH;
      const selected = menu[key] === i;
      ctx.fillStyle = selected ? PALETTE.gold : PALETTE.ink;
      ctx.font = `${selected ? 'bold ' : ''}15px monospace`;
      ctx.fillText(`${selected ? '▶ ' : '  '}${item}`, listX, y);
    });
    if (menu.mode === 'skill') {
      const currentActor = combat.state.order[combat.state.actorIndex - 1];
      const hero = currentActor ? currentActor.ref : null;
      const skill = hero ? SKILLS[hero.skills[menu.skill]] : null;
      ctx.fillStyle = PALETTE.inkDim;
      ctx.font = '12px monospace';
      ctx.fillText(skill ? skill.desc : '', listX, listY + 16 + items.length * MENU.itemH);
    }
    if (menu.mode === 'target' || menu.mode === 'ally') {
      ctx.fillStyle = PALETTE.inkDim;
      ctx.font = '12px monospace';
      ctx.fillText('← → choose, Enter: confirm, Esc: back', listX, listY + 16 + items.length * MENU.itemH);
    }
  }
  // Message text, wrapped, on the right of the menu.
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '15px monospace';
  const msgLines = wrapText(ctx, combat.state.message, MENU.w - 320);
  msgLines.forEach((line, i) => ctx.fillText(line, MENU.x + 300, MENU.y + 14 + i * 20));
  // Ambient embers drift up through the battlefield, faint and warm.
  for (let i = 0; i < 14; i += 1) {
    const ex = (i * 73 + time * 11) % VIEW_W;
    const ey = VIEW_H - ((time * 26 + i * 41) % (VIEW_H + 30));
    ctx.globalAlpha = 0.18 + 0.18 * Math.abs(Math.sin(time + i * 1.3));
    ctx.fillStyle = i % 3 === 0 ? '#ff5a2a' : '#e8a33d';
    ctx.fillRect(ex, ey, 2, 2);
    ctx.globalAlpha = 1;
  }
  // Rings spreading from the explosion point — each ring draws a second,
  // larger, fainter echo, so the shockwave reads as layered.
  for (const ring of fx.rings) {
    const frac = ring.age / ring.life;
    ctx.globalAlpha = Math.max(0, 0.8 * (1 - frac));
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = (ring.width || 4) * (1 - frac * 0.7);
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, 12 + Math.sqrt(frac) * (ring.size || 170), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, 0.35 * (1 - frac));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, 20 + frac * 220, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // A glare at the explosion point, and cracked ground beneath it.
    if (frac < 0.6) {
      const glare = ctx.createRadialGradient(ring.x, ring.y, 2, ring.x, ring.y, 90);
      glare.addColorStop(0, `rgba(255, 220, 140, ${0.5 * (1 - frac)})`);
      glare.addColorStop(1, 'rgba(255, 220, 140, 0)');
      ctx.fillStyle = glare;
      ctx.fillRect(ring.x - 90, ring.y - 90, 180, 180);
    }
    if (frac < 0.4) {
      ctx.strokeStyle = '#0d0a0e';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const ang = hash2(i, Math.round(ring.x), 21) * Math.PI * 2;
        const len = 30 + hash2(i, Math.round(ring.y), 22) * 40;
        ctx.beginPath();
        ctx.moveTo(ring.x, ring.y + 90);
        ctx.lineTo(ring.x + Math.cos(ang) * len, ring.y + 90 + Math.abs(Math.sin(ang)) * len * 0.4);
        ctx.stroke();
      }
    }
  }
  // Particles: embers, shadow shards, steel sparks.
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    if (p.layer === 2) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
    }
    if (p.layer === 1) {
      ctx.globalAlpha *= 0.2;
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    }
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // Damage numbers float up and fade; crits are bigger and gold. Each
  // number gets a dark outline so it reads over the fire.
  for (const float of combat.state.floats) {
    ctx.globalAlpha = Math.max(0, 1 - float.t / float.dur);
    ctx.fillStyle = float.color;
    const pop = 1 + 0.4 * Math.max(0, 1 - float.t / 0.18);
    ctx.font = `bold ${Math.round((float.size || 22) * 1.25 * pop)}px monospace`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#08040e';
    ctx.lineWidth = 5;
    ctx.strokeText(float.text, float.x, float.y - float.t * 44);
    ctx.fillText(float.text, float.x, float.y - float.t * 44);
    ctx.globalAlpha = 1;
  }
  // The skill-name card: it sits at the bottom left, below the boss and
  // clear of the hero rows, so the boss is never covered by it.
  if (fx.nameCard) {
    const card = fx.nameCard;
    const fadeIn = Math.min(1, card.t / 0.15);
    const fadeOut = card.t > card.dur - 0.3 ? Math.max(0, (card.dur - card.t) / 0.3) : 1;
    const cardH = card.ultimate ? 58 : 48;
    const cardY = 330;
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    ctx.fillStyle = 'rgba(7, 5, 12, 0.82)';
    ctx.fillRect(40, cardY, 520, cardH);
    ctx.strokeStyle = card.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, cardY, 520, cardH);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (card.ultimate) {
      ctx.fillStyle = card.color;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('★  ULTIMATE  ★', 300, cardY + 6);
    }
    ctx.fillStyle = card.color;
    ctx.font = card.ultimate ? 'bold 28px monospace' : 'bold 22px monospace';
    ctx.fillText(card.text.toUpperCase(), 300, card.ultimate ? cardY + 20 : cardY + 8);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '12px monospace';
    ctx.fillText(card.sub, 300, card.ultimate ? cardY + 46 : cardY + 32);
    ctx.globalAlpha = 1;
  }
  // A full-screen flash in the element's colour.
  if (fx.flash > 0) {
    ctx.globalAlpha = fx.flash * 0.5;
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Battle speed x${combat.state.speed} (press 1 / 2)   ${muted ? 'M: sound off' : 'M: sound on'}`, VIEW_W - 14, 12);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, best, showControls, time, hasSave = false) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#030207');
  grad.addColorStop(0.6, '#160a20');
  grad.addColorStop(1, '#241028');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // A blood moon hangs over Ashen Hollow.
  const moon = ctx.createRadialGradient(820, 92, 10, 820, 92, 110);
  moon.addColorStop(0, 'rgba(160, 32, 32, 0.4)');
  moon.addColorStop(1, 'rgba(160, 32, 32, 0)');
  ctx.fillStyle = moon;
  ctx.fillRect(700, -20, 240, 240);
  ctx.fillStyle = '#a02020';
  ctx.beginPath();
  ctx.arc(820, 92, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a1414';
  ctx.beginPath();
  ctx.arc(800, 78, 14, 0, Math.PI * 2);
  ctx.arc(838, 104, 10, 0, Math.PI * 2);
  ctx.arc(818, 116, 7, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 50; i += 1) {
    const sx = (i * 137) % VIEW_W;
    const sy = (i * 89) % 260;
    const tw = 0.25 + 0.45 * Math.abs(Math.sin(time * 0.7 + i));
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#c8b898';
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // A few embers rise from Torin's torch, the only warm light left.
  for (let i = 0; i < 10; i += 1) {
    const ex = 70 + ((i * 17 + time * 6) % 60);
    const ey = 400 - ((time * 18 + i * 31) % 160);
    ctx.globalAlpha = 0.25 + 0.2 * Math.abs(Math.sin(time + i));
    ctx.fillStyle = i % 3 === 0 ? '#c73e2c' : '#e8a33d';
    ctx.fillRect(ex, ey, 2, 2);
  }
  ctx.globalAlpha = 1;
  // Torchwarden Torin tends his torch at the far left, the only warm
  // light on the title screen.
  const tx0 = 40;
  const tGlow = ctx.createRadialGradient(tx0 + 24, 360, 2, tx0 + 24, 360, 60);
  tGlow.addColorStop(0, 'rgba(255, 150, 60, 0.35)');
  tGlow.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = tGlow;
  ctx.fillRect(tx0 - 36, 300, 120, 120);
  drawSprite(ctx, 'torin', tx0, 348, 3, false);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e07830';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('Torchwarden Torin', tx0 + 24, 402);
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '10px monospace';
  ctx.fillText('Keeper of the torch', tx0 + 24, 418);
  // The party: six heroes, four active and two in reserve, each named
  // with class, role and weapon — a role readable at a glance. The
  // ACTIVE / RESERVE tag sits above each hero; reserves are dimmed.
  const fy = 400;
  PARTY_TEMPLATE.forEach((hero, i) => {
    const x = VIEW_W / 2 - 300 + i * 130;
    ctx.globalAlpha = hero.active ? 1 : 0.55;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = hero.active ? PALETTE.gold : PALETTE.inkDim;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(hero.active ? 'ACTIVE' : 'RESERVE', x + 24, fy - 66);
    drawSprite(ctx, hero.sprite, x, fy - 52, 3, false);
    ctx.fillStyle = hero.classColor || PALETTE.gold;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(hero.name, x + 24, fy + 2);
    ctx.fillStyle = PALETTE.inkDim;
    ctx.font = '10px monospace';
    ctx.fillText(`${hero.cls} · ${hero.role}`, x + 24, fy + 18);
    ctx.fillStyle = hero.active ? PALETTE.ink : PALETTE.inkDim;
    ctx.fillText(hero.weapon, x + 24, fy + 34);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  gothicText(ctx, 'ASHEN HOLLOW', VIEW_W / 2, 58, 'bold 76px monospace', PALETTE.gold, 8);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '20px monospace';
  ctx.fillText('—  The Hearth Has Gone Cold  —', VIEW_W / 2, 148);
  ctx.font = '15px monospace';
  ctx.fillStyle = PALETTE.inkDim;
  ctx.fillText('The hearth is dead. Three Ember Crystals can wake it.', VIEW_W / 2, 184);
  ctx.fillText('Walk Ashen Hollow, speak to its people, and fight for the flame.', VIEW_W / 2, 206);
  const blink = Math.sin(time * 4) > -0.2;
  if (blink) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(hasSave ? '▶  Press Enter to Continue' : '▶  Press Enter or Click to Begin the Quest', VIEW_W / 2, 452);
  }
  ctx.fillStyle = PALETTE.inkDim;
  ctx.font = '13px monospace';
  ctx.fillText(hasSave ? 'N — New Game    H: how to play    M: mute' : 'H: how to play    M: mute', VIEW_W / 2, 486);
  if (best) ctx.fillText(best, VIEW_W / 2, 510);
  if (showControls) {
    panel(ctx, VIEW_W / 2 - 260, 240, 520, 150);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 15px monospace';
    ctx.fillText('HOW TO PLAY', VIEW_W / 2, 254);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '14px monospace';
    const lines = [
      'WASD / Arrows — walk    Click — walk to a tile',
      'E / Space — talk, open shrines, advance dialog',
      'Battles — menus with Arrows + Enter, or click',
      'Attack / Skill / Item / Run — win to earn XP',
      'Gather 3 crystals, then face the Hollow King',
      'P — pause    M — mute    1 / 2 — battle speed',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 282 + i * 20));
  }
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawEndScreen(ctx, title, lines, accent, time) {
  ctx.fillStyle = 'rgba(5, 3, 10, 0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 300, 120, 600, 300);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  gothicText(ctx, title, VIEW_W / 2, 150, 'bold 34px monospace', accent, 4);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '16px monospace';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 216 + i * 28));
  // Same deterministic blink as the title screen: driven by game time, so
  // a staged screenshot always shows the prompt.
  const blink = Math.sin(time * 4) > -0.2;
  if (blink) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('▶  Press Enter or Click to continue', VIEW_W / 2, 372);
  }
}

export function fieldCamera(field) {
  const { map, hero } = field.state;
  return {
    x: clamp(hero.px + TILE / 2 - VIEW_W / 2, 0, map.w * TILE - VIEW_W),
    y: clamp(hero.py + TILE / 2 - VIEW_H / 2, 0, map.h * TILE - VIEW_H),
  };
}

export function createPainter(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX / rect.width) * VIEW_W,
      y: (clientY / rect.height) * VIEW_H,
    };
  }
  function draw(game) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (game.screen === SCREENS.TITLE) {
      drawTitle(ctx, game.bestText, game.showControls, game.time, game.hasSave);
      return;
    }
    if (game.screen === SCREENS.BATTLE) {
      drawBattle(ctx, game.combat, game.time, game.muted);
      return;
    }
    if (game.screen === SCREENS.VICTORY) {
      drawField(ctx, game.field, game.time, game.muted, { quest: false });
      drawEndScreen(ctx, 'THE HEARTH BURNS AGAIN', [
        `The Hollow King is gone. Aldermere is warm once more.`,
        `Time ${fmtTime(game.stats.time)}   •   Battles won ${game.stats.battles}`,
        `Party level ${game.stats.level}   •   Gold ${game.stats.gold}`,
        `Ember Crystals 3 / 3   •   Reserves gain 50% XP`,
      ], PALETTE.gold, game.time);
      return;
    }
    if (game.screen === SCREENS.GAMEOVER) {
      drawField(ctx, game.field, game.time, game.muted, { quest: false });
      drawEndScreen(ctx, 'THE PARTY HAS FALLEN', [
        'The hearth grows colder still...',
        'But a warden always rises again.',
        'Press Enter to return to Aldermere, healed and ready.',
      ], PALETTE.ember, game.time);
      return;
    }
    drawField(ctx, game.field, game.time, game.muted);
    if (game.screen === SCREENS.PAUSED) {
      ctx.fillStyle = 'rgba(5, 3, 10, 0.8)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.textAlign = 'center';
      gothicText(ctx, 'PAUSED', VIEW_W / 2, 120, 'bold 40px monospace', PALETTE.gold, 3);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = '15px monospace';
      const lines = [
        'WASD / Arrows — walk    Click — walk to a tile',
        'E / Space — talk and interact',
        'Battles — Arrows + Enter, or click the menu',
        'Tab — Party & Equipment    P / Esc — resume    M — mute    1 / 2 — battle speed',
      ];
      lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 190 + i * 26));
      // The quest log: active quests with progress, then completed ones.
      const qs = game.field.state.quests;
      const activeQ = Object.values(QUESTS).filter((q) => qs[q.id] && qs[q.id].status === 'active');
      const doneQ = Object.values(QUESTS).filter((q) => qs[q.id] && qs[q.id].status === 'done');
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 15px monospace';
      ctx.fillText('QUEST LOG', VIEW_W / 2, 310);
      ctx.font = '13px monospace';
      let qy = 334;
      for (const q of activeQ) {
        const prog = qs[q.id].progress || 0;
        const need = q.require.count || 1;
        ctx.fillStyle = PALETTE.ink;
        ctx.fillText(`${q.name} — ${prog}/${need}   (${q.giver})`, VIEW_W / 2, qy);
        qy += 20;
      }
      for (const q of doneQ) {
        ctx.fillStyle = PALETTE.inkDim;
        ctx.fillText(`✓ ${q.name}`, VIEW_W / 2, qy);
        qy += 20;
      }
      if (activeQ.length === 0 && doneQ.length === 0) {
        ctx.fillStyle = PALETTE.inkDim;
        ctx.fillText('No quests yet — talk to the people of Aldermere.', VIEW_W / 2, qy);
      }
    }
  }
  return { draw, toLogical };
}
