// Every sound the game makes is synthesised here with the Web Audio API — no audio
// files, no network. A tiny bell, a soft thud, a pulse whoosh, a night fanfare and a
// slow night pad are all built from oscillators and gain envelopes. The context is
// created lazily on the first player gesture, so the game never tries to play before
// the browser allows sound.

/** Notes of a small pentatonic ladder the chimes climb as a combo grows. */
const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

/** Create the sound bank. Call `unlock()` from a user gesture before playing anything. */
export function createSoundBank() {
  let context = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  /** Build the audio context and the quiet night pad (two slow detuned sines). */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    const padGain = context.createGain();
    padGain.gain.value = 0.045;
    padGain.connect(master);
    const low = context.createOscillator();
    low.type = 'sine';
    low.frequency.value = 110;
    const high = context.createOscillator();
    high.type = 'sine';
    high.frequency.value = 164.81;
    high.detune.value = 4;
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    low.connect(padGain);
    high.connect(padGain);
    low.start();
    high.start();
    lfo.start();
    padNodes = { low, high, lfo, padGain };
  }

  /** A short tone with an attack and an exponential fade. */
  function tone(frequency, seconds, type, volume, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  /** A filtered noise burst, for the pulse whoosh and the moth thud. */
  function noise(seconds, filterFrequency, volume, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    /** M toggles sound on and off; the game reads this back for the HUD. */
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** A wisp is gathered: a bell that climbs the ladder with the combo. */
    chime(combo) {
      const note = CHIME_NOTES[Math.min(Math.max(combo - 1, 0), CHIME_NOTES.length - 1)];
      tone(note, 0.55, 'sine', 0.22);
      tone(note * 2, 0.35, 'sine', 0.07);
    },
    /** A moth burns in the pulse: a short bright spark. */
    spark() {
      tone(1244, 0.16, 'triangle', 0.14);
      tone(1866, 0.1, 'sine', 0.08);
    },
    /** The pulse fires: air rushing out, then a low bloom. */
    pulse() {
      noise(0.28, 2400, 0.2);
      tone(196, 0.3, 'sine', 0.16);
    },
    /** A moth strikes the lantern: a dull thud and a falling tone. */
    thud() {
      noise(0.18, 320, 0.3);
      tone(220, 0.35, 'sawtooth', 0.1);
      tone(110, 0.4, 'sine', 0.16);
    },
    /** A night is cleared: three rising notes. */
    fanfare() {
      tone(523.25, 0.3, 'triangle', 0.18);
      tone(659.25, 0.3, 'triangle', 0.18, 0.12);
      tone(783.99, 0.55, 'triangle', 0.2, 0.24);
    },
    /** Morning breaks and the garden is won: a slow rising arpeggio. */
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((note, index) => tone(note, 0.8, 'triangle', 0.16, index * 0.14));
      tone(261.63, 1.6, 'sine', 0.1, 0.1);
    },
    /** The flame goes out: a low falling sigh. */
    lose() {
      tone(330, 0.7, 'sine', 0.16);
      tone(220, 0.9, 'sine', 0.14, 0.18);
      tone(146.83, 1.2, 'sine', 0.12, 0.36);
    },
    /** A soft click for menus and the pause key. */
    click() {
      tone(880, 0.08, 'sine', 0.12);
    },
  };
}
