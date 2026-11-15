// A small seeded random number generator (mulberry32): the same seed gives the same
// garden, which is what makes the screenshot scenes repeatable.

/** Build a generator from an integer seed. */
export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a number in [min, max) from a generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one entry of an array from a generator. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
