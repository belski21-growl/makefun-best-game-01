// ASHEN HOLLOW — all sound is synthesised with WebAudio: no audio files.
// Three original looping themes (title, field, battle) play through a small
// step sequencer, and short blips cover every action's feedback.

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// One entry per eighth note, 0 = rest. 32 steps = four bars.
const THEMES = {
  title: {
    bpm: 92,
    lead: [69, 0, 72, 0, 76, 0, 81, 0, 76, 0, 72, 0, 69, 0, 67, 0,
           69, 0, 72, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0],
    bass: [57, 0, 53, 0, 57, 0, 52, 0, 57, 0, 53, 0, 57, 0, 52, 0],
  },
  field: {
    bpm: 116,
    lead: [72, 76, 79, 76, 81, 79, 76, 72, 74, 76, 79, 76, 77, 76, 74, 0,
           72, 76, 79, 76, 81, 79, 84, 79, 81, 79, 76, 74, 72, 0, 74, 0],
    bass: [48, 0, 48, 0, 53, 0, 53, 0, 45, 0, 45, 0, 50, 0, 50, 0],
  },
  battle: {
    bpm: 138,
    lead: [74, 0, 74, 77, 74, 0, 72, 0, 74, 0, 74, 77, 79, 0, 77, 0,
           81, 0, 79, 0, 77, 0, 76, 0, 77, 0, 79, 0, 81, 0, 79, 0],
    bass: [50, 0, 50, 50, 0, 50, 0, 50, 48, 0, 48, 48, 0, 48, 0, 48],
  },
};

export function createChiptune() {
  let ctx = null;
  let master = null;
  let muted = false;
  let themeName = null;
  let stepIndex = 0;
  let nextTime = 0;
  let timer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.4;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }
  function note(midi, time, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }
  function scheduleStep() {
    const theme = THEMES[themeName];
    if (!theme || !ctx) return;
    const stepDur = 60 / theme.bpm / 2;
    while (nextTime < ctx.currentTime + 0.3) {
      const lead = theme.lead[stepIndex % theme.lead.length];
      const bass = theme.bass[Math.floor(stepIndex / 2) % theme.bass.length];
      if (lead) note(lead, nextTime, stepDur * 0.92, 'square', 0.16);
      if (bass) note(bass, nextTime, stepDur * 1.8, 'triangle', 0.22);
      stepIndex += 1;
      nextTime += stepDur;
    }
  }
  return {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!timer) {
        nextTime = ctx.currentTime + 0.05;
        timer = setInterval(scheduleStep, 100);
      }
    },
    setTheme(name) {
      if (name === themeName) return;
      themeName = name;
      stepIndex = 0;
      if (ctx) nextTime = ctx.currentTime + 0.05;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.4;
      return muted;
    },
    isMuted() {
      return muted;
    },
    sfx(name) {
      if (!ensure() || muted) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime + 0.02;
      const seq = {
        confirm: [[76, 0], [81, 0.07]],
        cancel: [[72, 0], [67, 0.07]],
        hit: [[55, 0], [50, 0.06]],
        hurt: [[62, 0], [58, 0.09]],
        heal: [[72, 0], [76, 0.07], [81, 0.14]],
        levelup: [[72, 0], [76, 0.08], [79, 0.16], [84, 0.24]],
        crystal: [[84, 0], [88, 0.08], [91, 0.16], [96, 0.26]],
        win: [[72, 0], [76, 0.1], [79, 0.2], [84, 0.3], [88, 0.45]],
        lose: [[69, 0], [65, 0.14], [62, 0.28], [57, 0.44]],
        step: [[88, 0]],
      }[name];
      if (!seq) return;
      for (const [midi, at] of seq) note(midi, now + at, 0.16, 'square', 0.18);
    },
  };
}
