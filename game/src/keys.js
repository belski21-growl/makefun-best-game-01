// ASHEN HOLLOW — keyboard and mouse, read once a frame. Movement keys are
// held; everything else is a one-shot action, taken once and then cleared,
// so a single press never fires twice.

export const ACT_CONFIRM = 1;
export const ACT_CANCEL = 2;
export const ACT_PAUSE = 4;
export const ACT_MUTE = 8;
export const ACT_HELP = 16;
export const ACT_PARTY = 32;
export const ACT_NEWGAME = 64;

const KEY_DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

export function createKeys(canvas, toLogical) {
  const held = new Set();
  const pressed = new Set();
  const pressedDirs = new Set();
  let click = null;
  let speedKey = 0;
  const mouse = { x: 0, y: 0 };

  function logicalFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return toLogical(event.clientX - rect.left, event.clientY - rect.top);
  }
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    const dir = KEY_DIRS[event.code];
    if (dir) {
      if (dir.y === -1) pressedDirs.add('up');
      if (dir.y === 1) pressedDirs.add('down');
      if (dir.x === -1) pressedDirs.add('left');
      if (dir.x === 1) pressedDirs.add('right');
    }
    if (event.code === 'Enter' || event.code === 'Space') pressed.add(ACT_CONFIRM);
    else if (event.code === 'Escape') pressed.add(ACT_CANCEL);
    else if (event.code === 'KeyP') pressed.add(ACT_PAUSE);
    else if (event.code === 'KeyM') pressed.add(ACT_MUTE);
    else if (event.code === 'KeyH') pressed.add(ACT_HELP);
    else if (event.code === 'Tab') pressed.add(ACT_PARTY);
    else if (event.code === 'KeyN') pressed.add(ACT_NEWGAME);
    else if (event.code === 'Digit1') speedKey = 1;
    else if (event.code === 'Digit2') speedKey = 2;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = logicalFromEvent(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = logicalFromEvent(event);
    mouse.x = p.x;
    mouse.y = p.y;
    click = { x: p.x, y: p.y };
    pressed.add(ACT_CONFIRM);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  return {
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const d = KEY_DIRS[code];
        if (d) {
          x += d.x;
          y += d.y;
        }
      }
      return { x: Math.sign(x), y: Math.sign(y) };
    },
    takeActions() {
      let bits = 0;
      for (const bit of pressed) bits |= bit;
      pressed.clear();
      return bits;
    },
    /** One-shot cursor moves (arrow/WASD presses), for menus. */
    takeDirs() {
      const dirs = {
        up: pressedDirs.has('up'),
        down: pressedDirs.has('down'),
        left: pressedDirs.has('left'),
        right: pressedDirs.has('right'),
      };
      pressedDirs.clear();
      return dirs;
    },
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
    takeSpeed() {
      const s = speedKey;
      speedKey = 0;
      return s;
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
  };
}
