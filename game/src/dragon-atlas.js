// Local presentation assets only; metadata remains the authoritative clip data.
async function loadDragonClip(name) {
  const base = new URL(`../assets/dragon/${name}/`, import.meta.url);
  try {
    const response = await fetch(new URL('animation.json', base));
    if (!response.ok) throw new Error(`Dragon metadata: ${response.status}`);
    const clip = await response.json();
    const pages = await Promise.all(clip.fallback.pages.map(async (page) => {
      const image = new Image();
      image.src = new URL(page.file, base).href;
      await image.decode();
      return { ...page, image };
    }));
    return { clip, pages };
  } catch (error) {
    console.error(`Emberwyrm ${name} could not load; keeping fallback.`, error);
    return null;
  }
}

export const [dragonIdle, dragonAttack] = await Promise.all([
  loadDragonClip('idle'), loadDragonClip('attack'),
]);

export function drawDragonIdle(ctx, seconds, right, bottom) {
  if (!dragonIdle) return false;
  const { clip, pages } = dragonIdle;
  const tick = Math.max(0, Math.floor(seconds * clip.fps));
  const frame = clip.loop ? tick % clip.frameCount : Math.min(tick, clip.frameCount - 1);
  const page = pages.find((p) => frame >= p.firstFrame && frame < p.firstFrame + p.frameCount);
  if (!page) return false;
  const [w, h] = clip.fallback.cellSize;
  const local = frame - page.firstFrame;
  // Measured idle alpha bbox: 192x160. 432 logical px = 576px at 720p
  // (45% width), with margin above the 560px session target.
  const scale = 2.25;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(right), Math.round(bottom - h * scale));
  ctx.scale(-1, 1); // Atlas faces right; Ash faces the foes on the left.
  ctx.drawImage(page.image, (local % page.columns) * w, Math.floor(local / page.columns) * h,
    w, h, 0, 0, w * scale, h * scale);
  ctx.restore();
  return true;
}

// Use only the flame-bearing end of the supplied attack cell, leaving the
// persistent idle body visible. The crop is presentation; atlas bytes stay intact.
export function drawDragonBreath(ctx, seconds, mouthX, mouthY) {
  if (!dragonAttack) return false;
  const { clip, pages } = dragonAttack;
  const frame = Math.min(Math.max(0, Math.floor(seconds * clip.fps)), clip.frameCount - 1);
  const page = pages.find((p) => frame >= p.firstFrame && frame < p.firstFrame + p.frameCount);
  if (!page) return false;
  const [w, h] = clip.fallback.cellSize;
  const local = frame - page.firstFrame;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(mouthX, mouthY);
  ctx.scale(-1, 1);
  ctx.drawImage(page.image, (local % page.columns) * w + 184,
    Math.floor(local / page.columns) * h + 30, 40, 44, 0, -44, 160, 176);
  ctx.restore();
  return true;
}
