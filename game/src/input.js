// Keyboard and mouse, read once a frame. The lantern is steered two ways: the arrow
// keys or WASD push it, and the mouse pulls it (it eases toward the pointer). A click
// or Space fires the pulse while playing and confirms on the title and end screens;
// P or Escape pauses; M mutes. Actions are consumed once, so a single press never
// fires twice.

/** Bit flags for one-frame actions the game consumes. */
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PULSE = 4;
export const ACTION_MUTE = 8;

/**
 * Bind the canvas and the window. `toLogical` converts a client point to playfield
 * coordinates, because the canvas is scaled to fit the window.
 */
export function createInput(canvas, toLogical) {
  const keys = new Set();
  let mouseX = null;
  let mouseY = null;
  let mouseSeen = false;
  let queued = 0;

  function isDown(...codes) {
    return codes.some((code) => keys.has(code));
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') queued |= ACTION_CONFIRM | ACTION_PULSE;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
    mouseSeen = true;
    queued |= ACTION_CONFIRM | ACTION_PULSE;
    event.preventDefault();
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Take and clear this frame's one-shot actions. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    /** The keyboard's steering for this frame: -1, 0 or 1 on each axis. */
    direction() {
      const x = (isDown('ArrowRight', 'KeyD') ? 1 : 0) - (isDown('ArrowLeft', 'KeyA') ? 1 : 0);
      const y = (isDown('ArrowDown', 'KeyS') ? 1 : 0) - (isDown('ArrowUp', 'KeyW') ? 1 : 0);
      return { x, y };
    },
    /** Where the mouse last pointed in playfield coordinates, or null before it moves. */
    mouse() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
  };
}
