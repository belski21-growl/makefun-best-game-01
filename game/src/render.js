// Everything the player sees, painted on one canvas. The garden is drawn from code:
// a gradient night sky with twinkling stars and a low moon, dark hills and grass with
// glowing flowers, the lantern's warm light, golden wisps, violet moths, sparks, and
// the HUD and screens. The playfield is a fixed 1280x720 logical area, letterboxed
// into whatever window holds it, so the game looks the same at any size.

import { FIELD, FONT, LANTERN, NIGHTS, PALETTE, PULSE, WISP } from './config.js';
import { createRandom, range } from './random.js';

/** The screens the game moves between. */
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_NIGHT = 'night';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The garden's fixed scenery: stars, grass tufts and flowers, drawn once from a seed. */
const sceneryRandom = createRandom(20261116);
const STARS = [];
for (let i = 0; i < 120; i += 1) {
  STARS.push({
    x: range(sceneryRandom, 0, FIELD.width),
    y: range(sceneryRandom, 0, FIELD.height * 0.55),
    size: range(sceneryRandom, 0.6, 2.1),
    twinkle: range(sceneryRandom, 0.5, 2.4),
    phase: range(sceneryRandom, 0, Math.PI * 2),
  });
}
const TUFTS = [];
for (let i = 0; i < 46; i += 1) {
  TUFTS.push({
    x: range(sceneryRandom, 0, FIELD.width),
    y: range(sceneryRandom, FIELD.height * 0.82, FIELD.height - 6),
    height: range(sceneryRandom, 14, 34),
    lean: range(sceneryRandom, -0.4, 0.4),
  });
}
const FLOWERS = [];
for (let i = 0; i < 22; i += 1) {
  FLOWERS.push({
    x: range(sceneryRandom, 20, FIELD.width - 20),
    y: range(sceneryRandom, FIELD.height * 0.86, FIELD.height - 10),
    colour: sceneryRandom() < 0.5 ? PALETTE.flower : PALETTE.flowerAlt,
    size: range(sceneryRandom, 3, 6),
    phase: range(sceneryRandom, 0, Math.PI * 2),
  });
}

/** Create the renderer for a canvas; it letterboxes the 1280x720 playfield into it. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  /** Fit the canvas to its window, keeping the playfield's shape. */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  /** Convert a client point (mouse) into playfield coordinates. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  /** A deterministic shake offset: the same time always shakes the same way. */
  function shakeOffset(state) {
    if (state.shake <= 0) return { x: 0, y: 0 };
    const amount = state.shake * 9;
    return {
      x: Math.sin(state.time * 91.7) * amount,
      y: Math.cos(state.time * 113.3) * amount,
    };
  }

  /** The night sky: gradient, stars, a low moon and the garden's dark hills. */
  function drawBackground(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyBottom);
    gradient.addColorStop(1, PALETTE.horizon);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    for (const star of STARS) {
      const alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * star.twinkle + star.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e8ecff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The low moon, glowing over the hills.
    const moonX = 1090;
    const moonY = 118;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 120);
    moonGlow.addColorStop(0, 'rgba(244, 234, 208, 0.5)');
    moonGlow.addColorStop(1, 'rgba(244, 234, 208, 0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - 120, moonY - 120, 240, 240);
    ctx.fillStyle = PALETTE.moon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 175, 140, 0.55)';
    ctx.beginPath();
    ctx.arc(moonX - 14, moonY - 8, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 12, moonY + 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // Two dark hills roll across the garden's back.
    ctx.fillStyle = '#141c36';
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.quadraticCurveTo(320, 470, 640, 545);
    ctx.quadraticCurveTo(960, 620, 1280, 520);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();

    // The foreground grass, tufts and small glowing flowers.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 620, FIELD.width, 100);
    ctx.strokeStyle = PALETTE.grass;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const tuft of TUFTS) {
      ctx.beginPath();
      ctx.moveTo(tuft.x, tuft.y);
      ctx.quadraticCurveTo(tuft.x + tuft.lean * 20, tuft.y - tuft.height * 0.7, tuft.x + tuft.lean * 30, tuft.y - tuft.height);
      ctx.stroke();
    }
    for (const flower of FLOWERS) {
      const glow = 0.5 + 0.5 * Math.sin(state.time * 1.4 + flower.phase);
      ctx.globalAlpha = 0.55 + 0.4 * glow;
      ctx.fillStyle = flower.colour;
      ctx.beginPath();
      ctx.arc(flower.x, flower.y, flower.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** The soft ambient motes that drift behind the title screen. */
  function drawAmbient(state) {
    for (const mote of state.ambient) {
      const alpha = 0.35 + 0.35 * Math.sin(state.time * 1.6 + mote.phase);
      ctx.globalAlpha = Math.max(0.08, alpha);
      ctx.fillStyle = PALETTE.wisp;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The lantern's warm pool of light, drawn under everything it lights. */
  function drawGlowAt(x, y) {
    const glow = ctx.createRadialGradient(x, y, 10, x, y, LANTERN.glowRadius + 50);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.30)');
    glow.addColorStop(0.55, 'rgba(255, 170, 70, 0.12)');
    glow.addColorStop(1, 'rgba(255, 170, 70, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - LANTERN.glowRadius - 60, y - LANTERN.glowRadius - 60, (LANTERN.glowRadius + 60) * 2, (LANTERN.glowRadius + 60) * 2);
    ctx.strokeStyle = 'rgba(255, 205, 120, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(x, y, LANTERN.glowRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGlow(state) {
    drawGlowAt(state.lantern.x, state.lantern.y);
  }

  /** A golden wisp: a bright core, a soft halo, and a short fading trail. */
  function drawWisps(state) {
    for (const wisp of state.wisps) {
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 5 + wisp.phase);
      const halo = ctx.createRadialGradient(wisp.x, wisp.y, 1, wisp.x, wisp.y, 26);
      halo.addColorStop(0, `rgba(255, 217, 77, ${0.55 * pulse})`);
      halo.addColorStop(1, 'rgba(255, 217, 77, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(wisp.x, wisp.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.wispCore;
      ctx.beginPath();
      ctx.arc(wisp.x, wisp.y, WISP.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.wisp;
      ctx.beginPath();
      ctx.arc(wisp.x, wisp.y, WISP.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A shadow moth: violet wings that flap, a dark body, two red eyes. */
  function drawMoths(state) {
    for (const moth of state.moths) {
      const flap = Math.sin(moth.flap) * 0.7;
      const angle = Math.atan2(state.lantern.y - moth.y, state.lantern.x - moth.x);
      ctx.save();
      ctx.translate(moth.x, moth.y);
      ctx.rotate(angle);
      ctx.fillStyle = PALETTE.mothWing;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * flap * 0.5);
        ctx.beginPath();
        ctx.ellipse(side * 2, -11 * side + 6 * side, 13, 7, side * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = PALETTE.moth;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.mothEye;
      ctx.beginPath();
      ctx.arc(8, -3, 2, 0, Math.PI * 2);
      ctx.arc(8, 3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** The lantern itself: brass cap and base, glass panes, a flickering flame. */
  function drawLanternAt(x, y, tilt, invuln, time) {
    const flicker = 1 + 0.08 * Math.sin(time * 11) + 0.05 * Math.sin(time * 23);
    const blink = invuln > 0 && Math.floor(time * 12) % 2 === 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    if (blink) ctx.globalAlpha = 0.35;
    // The hanging ring and brass cap.
    ctx.strokeStyle = PALETTE.lanternBrass;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -30, 8, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = PALETTE.lanternBrass;
    ctx.beginPath();
    ctx.moveTo(-16, -22);
    ctx.lineTo(16, -22);
    ctx.lineTo(11, -30);
    ctx.lineTo(-11, -30);
    ctx.closePath();
    ctx.fill();
    // The glass body, lit from inside.
    const glass = ctx.createLinearGradient(-13, -22, 13, 22);
    glass.addColorStop(0, 'rgba(255, 217, 138, 0.95)');
    glass.addColorStop(1, 'rgba(255, 170, 70, 0.85)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-14, -22);
    ctx.lineTo(14, -22);
    ctx.lineTo(11, 20);
    ctx.lineTo(-11, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.lanternBrass;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // The flame, flickering inside.
    ctx.fillStyle = PALETTE.flameCore;
    ctx.beginPath();
    ctx.ellipse(0, 2, 5 * flicker, 11 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.flame;
    ctx.beginPath();
    ctx.ellipse(0, 6, 8 * flicker, 9 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
    // The brass base.
    ctx.fillStyle = PALETTE.lanternBrass;
    ctx.fillRect(-14, 18, 28, 6);
    ctx.restore();
  }

  function drawLantern(state) {
    drawLanternAt(state.lantern.x, state.lantern.y, state.lantern.tilt, state.lantern.invuln, state.time);
  }

  /** Expanding rings of light from a fired pulse. */
  function drawPulses(state) {
    for (const pulse of state.pulses) {
      const progress = Math.min(1, pulse.age / PULSE.expandSeconds);
      const radius = PULSE.maxRadius * progress;
      const fade = pulse.age <= PULSE.expandSeconds ? 1 : 1 - (pulse.age - PULSE.expandSeconds) / PULSE.fadeSeconds;
      ctx.globalAlpha = Math.max(0, 0.75 * fade);
      ctx.strokeStyle = PALETTE.pulse;
      ctx.lineWidth = 5 * fade + 1;
      ctx.beginPath();
      ctx.arc(state.lantern.x, state.lantern.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, 0.18 * fade);
      ctx.fillStyle = PALETTE.pulse;
      ctx.beginPath();
      ctx.arc(state.lantern.x, state.lantern.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** Sparks and floating score labels. */
  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.colour;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = `700 20px ${FONT}`;
    for (const text of state.texts) {
      ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
      ctx.fillStyle = text.colour;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
  }

  /** A small flame icon for the HUD's remaining flames. */
  function drawFlameIcon(x, y, lit, size) {
    ctx.fillStyle = lit ? PALETTE.flame : 'rgba(120, 120, 130, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.55, size, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lit) {
      ctx.fillStyle = PALETTE.flameCore;
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.25, size * 0.28, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A bar with a label, drawn in the HUD's top strip. */
  function drawBar(x, y, width, height, fraction, fill, edge) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * Math.min(1, Math.max(0, fraction))), height - 2);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width, height);
  }

  /** The HUD: score, night and dawn, wisps gathered, flames, pulse energy, combo. */
  function drawHud(state, best, muted) {
    ctx.fillStyle = 'rgba(10, 14, 36, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, 64);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 64.5);
    ctx.lineTo(FIELD.width, 64.5);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('SCORE', 20, 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(String(state.score), 20, 50);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('BEST', 150, 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(String(Math.max(best, state.score)), 150, 50);

    // Night and the dawn timer, centred.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`NIGHT ${state.night} OF ${NIGHTS.length}`, FIELD.width / 2, 22);
    const plan = NIGHTS[state.night - 1];
    const dawnFraction = Math.max(0, state.dawnLeft / plan.dawnSeconds);
    const low = state.dawnLeft <= 10;
    drawBar(FIELD.width / 2 - 130, 30, 260, 12, dawnFraction, low ? PALETTE.danger : '#e8a33d', PALETTE.panelEdge);
    ctx.fillStyle = low ? PALETTE.danger : PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`DAWN IN ${Math.ceil(Math.max(0, state.dawnLeft))}s`, FIELD.width / 2, 56);

    // Wisps gathered, flames, pulse energy, on the right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`WISPS  ${state.collected} / ${state.needed}`, FIELD.width - 20, 22);
    for (let i = 0; i < 3; i += 1) drawFlameIcon(FIELD.width - 30 - i * 26, 44, i < state.flames, 9);
    drawBar(FIELD.width - 250, 30, 150, 12, state.energy / 100, '#7fb8ff', PALETTE.panelEdge);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('PULSE — CLICK / SPACE', FIELD.width - 258, 41);

    if (state.combo >= 2) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2a1f08';
      const label = `COMBO x${state.combo}`;
      const width = ctx.measureText(label).width + 28;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.roundRect(FIELD.width / 2 - width / 2, 74, width, 28, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2a1f08';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(label, FIELD.width / 2, 94);
    }

    if (muted) {
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 12px ${FONT}`;
      ctx.fillText('MUTED (M)', 20, FIELD.height - 14);
    }
  }

  /** A dark panel with a title, a line or two, and a prompt — the screens share it. */
  function drawPanel(title, lines, prompt, titleColour) {
    ctx.fillStyle = 'rgba(8, 11, 28, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2 - 20;
    ctx.fillStyle = 'rgba(20, 26, 48, 0.94)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = titleColour ?? PALETTE.text;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, y + 66);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 19px ${FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, y + 108 + index * 30);
    });
    if (prompt) {
      const blink = 0.6 + 0.4 * Math.sin(performance.now() / 350);
      ctx.globalAlpha = blink;
      ctx.fillStyle = PALETTE.wisp;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(prompt, FIELD.width / 2, y + height - 22);
      ctx.globalAlpha = 1;
    }
  }

  /** One line of the run's statistics, for the end screens. */
  function statsLines(state) {
    return [
      `Score ${state.score}  •  Wisps gathered ${state.stats.gathered}  •  Moths burned ${state.stats.zapped}`,
      `Best combo x${state.bestCombo}  •  Pulses fired ${state.stats.pulses}  •  Nights cleared ${state.stats.nightsCleared}`,
    ];
  }

  /** Paint one frame: the garden, the lantern and its creatures, the HUD, the screen. */
  function draw(state, screen, best, muted) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.skyTop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = shakeOffset(state);
    ctx.setTransform(scale, 0, 0, scale, offsetX + shake.x * scale, offsetY + shake.y * scale);
    drawBackground(state);
    drawAmbient(state);
    if (screen !== SCREEN_TITLE) {
      drawGlow(state);
      drawWisps(state);
      drawMoths(state);
      drawLantern(state);
      drawPulses(state);
      drawParticles(state);
    }
    if (screen === SCREEN_TITLE) {
      drawAmbient(state);
      // The lantern itself, resting in the grass below the title.
      drawGlowAt(FIELD.width / 2, 652);
      drawLanternAt(FIELD.width / 2, 652, 0, 0, state.time);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.wisp;
      ctx.font = `800 84px ${FONT}`;
      ctx.fillText('WISPKEEPER', FIELD.width / 2, 218);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `400 26px ${FONT}`;
      ctx.fillText('Lantern of the Night Garden', FIELD.width / 2, 262);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `400 19px ${FONT}`;
      ctx.fillText('Guide golden wisps into your lantern light before dawn breaks.', FIELD.width / 2, 330);
      ctx.fillText('Shadow moths hunt your flame — burn them with a pulse of light.', FIELD.width / 2, 360);
      ctx.fillText('Five nights. Three flames. One lantern.', FIELD.width / 2, 390);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 19px ${FONT}`;
      ctx.fillText('Move: mouse or WASD / arrows   •   Pulse: click or Space   •   Pause: P   •   Mute: M', FIELD.width / 2, 448);
      if (best > 0) {
        ctx.fillStyle = PALETTE.wisp;
        ctx.font = `700 20px ${FONT}`;
        ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 492);
      }
      const blink = 0.6 + 0.4 * Math.sin(performance.now() / 350);
      ctx.globalAlpha = blink;
      ctx.fillStyle = PALETTE.wisp;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText('CLICK OR PRESS SPACE TO BEGIN', FIELD.width / 2, 556);
      ctx.globalAlpha = 1;
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The garden waits for you.', 'P or Space to keep playing.'], null);
    } else if (screen === SCREEN_NIGHT) {
      drawPanel(`NIGHT ${state.night - 1} CLEARED`, [
        `The lantern burns brighter. Dawn bonus +${state.dawnBonus ?? 0}.`,
        `Night ${state.night} needs ${state.needed} wisps before dawn.`,
      ], 'PRESS SPACE FOR THE NEXT NIGHT', PALETTE.good);
    } else if (screen === SCREEN_OVER) {
      const reason = state.dawnLeft <= 0 && state.flames > 0
        ? 'Dawn broke with the lantern still unfilled.'
        : 'The last flame went out in the dark.';
      drawPanel('THE FLAME WENT OUT', [reason, ...statsLines(state)], 'PRESS SPACE OR CLICK TO TRY AGAIN', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('MORNING BREAKS', [
        'Five nights, and the lantern never went out — the garden is lit.',
        ...statsLines(state),
      ], 'PRESS SPACE OR CLICK TO PLAY AGAIN', PALETTE.good);
    }
  }

  return { draw, resize, toLogical };
}
