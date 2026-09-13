/* Audio — sound definitions and spoken lines. Pure data.

   No audio files were supplied, and this game has to run from file:// with no
   build step, so every sound here is SYNTHESISED at runtime by AudioManager.
   That means zero downloads, no missing-asset states, and nothing to license.

   Each sound is a list of layers played together. A layer is one of:

     sweep   an oscillator gliding between two frequencies
             wave: sine | square | sawtooth | triangle
     noise   a filtered burst of white noise
             filter: lowpass | highpass | bandpass, with an optional sweep
     chime   several harmonics struck together, for anything positive

   Common fields: dur in seconds, gain 0..1, delay before the layer starts.

   TO USE REAL RECORDINGS INSTEAD: give a sound a "src" and AudioManager loads
   and plays that file, ignoring the layers. The layers stay as the fallback,
   so a missing or still-loading file is never silence.
       shoot: { src: 'audio/shoot.mp3', layers: [ ... ] } */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  DH.SOUNDS = {
    /* ---- weapons */
    shoot: { layers: [
      { kind: 'sweep', wave: 'square', from: 1150, to: 240, dur: 0.09, gain: 0.16 },
      { kind: 'noise', filter: 'highpass', freq: 1800, dur: 0.06, gain: 0.12 }
    ] },
    shootHeavy: { layers: [
      { kind: 'sweep', wave: 'sawtooth', from: 700, to: 120, dur: 0.16, gain: 0.20 },
      { kind: 'noise', filter: 'lowpass', freq: 1400, dur: 0.12, gain: 0.16 }
    ] },

    /* ---- movement */
    jump: { layers: [
      { kind: 'sweep', wave: 'sine', from: 300, to: 640, dur: 0.13, gain: 0.13 }
    ] },
    land: { layers: [
      { kind: 'noise', filter: 'lowpass', freq: 900, sweepTo: 260, dur: 0.10, gain: 0.13 },
      { kind: 'sweep', wave: 'sine', from: 130, to: 62, dur: 0.11, gain: 0.10 }
    ] },
    dash: { layers: [
      { kind: 'noise', filter: 'bandpass', freq: 700, sweepTo: 2600, dur: 0.22, gain: 0.16 },
      { kind: 'sweep', wave: 'triangle', from: 420, to: 1250, dur: 0.20, gain: 0.10 }
    ] },
    ability: { layers: [
      { kind: 'sweep', wave: 'triangle', from: 220, to: 1300, dur: 0.38, gain: 0.14 },
      { kind: 'chime', notes: [660, 990, 1320], dur: 0.55, gain: 0.10, delay: 0.06 }
    ] },

    /* ---- impacts */
    hit: { layers: [
      { kind: 'noise', filter: 'bandpass', freq: 1900, dur: 0.07, gain: 0.16 },
      { kind: 'sweep', wave: 'square', from: 520, to: 150, dur: 0.06, gain: 0.10 }
    ] },
    enemyDie: { layers: [
      { kind: 'noise', filter: 'lowpass', freq: 1500, sweepTo: 200, dur: 0.32, gain: 0.20 },
      { kind: 'sweep', wave: 'sawtooth', from: 300, to: 55, dur: 0.28, gain: 0.13 }
    ] },
    playerHurt: { layers: [
      { kind: 'sweep', wave: 'square', from: 380, to: 110, dur: 0.20, gain: 0.17 },
      { kind: 'noise', filter: 'lowpass', freq: 1100, dur: 0.14, gain: 0.12 }
    ] },
    shielded: { layers: [
      { kind: 'sweep', wave: 'sine', from: 900, to: 520, dur: 0.16, gain: 0.12 },
      { kind: 'noise', filter: 'bandpass', freq: 2600, dur: 0.10, gain: 0.08 }
    ] },
    playerDie: { layers: [
      { kind: 'sweep', wave: 'sawtooth', from: 340, to: 48, dur: 0.85, gain: 0.20 },
      { kind: 'noise', filter: 'lowpass', freq: 1200, sweepTo: 120, dur: 0.70, gain: 0.16 }
    ] },

    /* ---- pickups. Bright and short: these fire constantly. */
    diamond: { layers: [
      { kind: 'chime', notes: [1560, 2340], dur: 0.16, gain: 0.09 }
    ] },
    gem: { layers: [
      { kind: 'chime', notes: [1040, 1560, 2080], dur: 0.34, gain: 0.12 }
    ] },
    health: { layers: [
      { kind: 'chime', notes: [620, 830, 1240], dur: 0.34, gain: 0.12 },
      { kind: 'sweep', wave: 'sine', from: 480, to: 760, dur: 0.24, gain: 0.08 }
    ] },
    ammo: { layers: [
      { kind: 'noise', filter: 'bandpass', freq: 1500, dur: 0.08, gain: 0.12 },
      { kind: 'sweep', wave: 'square', from: 240, to: 380, dur: 0.10, gain: 0.08 }
    ] },

    /* ---- world */
    checkpoint: { layers: [
      { kind: 'chime', notes: [523, 784, 1046], dur: 0.75, gain: 0.13 },
      { kind: 'chime', notes: [1568], dur: 0.60, gain: 0.07, delay: 0.14 }
    ] },
    levelComplete: { layers: [
      { kind: 'chime', notes: [523], dur: 0.50, gain: 0.13 },
      { kind: 'chime', notes: [659], dur: 0.50, gain: 0.13, delay: 0.12 },
      { kind: 'chime', notes: [784], dur: 0.50, gain: 0.13, delay: 0.24 },
      { kind: 'chime', notes: [1046, 1568], dur: 1.10, gain: 0.14, delay: 0.36 }
    ] },

    /* ---- boss */
    bossAppear: { layers: [
      { kind: 'sweep', wave: 'sine', from: 90, to: 38, dur: 1.40, gain: 0.26 },
      { kind: 'noise', filter: 'lowpass', freq: 420, dur: 1.50, gain: 0.20 },
      { kind: 'sweep', wave: 'sawtooth', from: 150, to: 70, dur: 1.00, gain: 0.10, delay: 0.20 }
    ] },
    bossHit: { layers: [
      { kind: 'noise', filter: 'bandpass', freq: 1200, dur: 0.11, gain: 0.20 },
      { kind: 'sweep', wave: 'square', from: 300, to: 90, dur: 0.10, gain: 0.13 }
    ] },
    bossEnrage: { layers: [
      { kind: 'sweep', wave: 'sawtooth', from: 120, to: 300, dur: 0.90, gain: 0.20 },
      { kind: 'noise', filter: 'bandpass', freq: 600, sweepTo: 2400, dur: 0.80, gain: 0.16 }
    ] },
    bossDie: { layers: [
      { kind: 'noise', filter: 'lowpass', freq: 2200, sweepTo: 90, dur: 1.80, gain: 0.30 },
      { kind: 'sweep', wave: 'sawtooth', from: 220, to: 30, dur: 1.60, gain: 0.20 },
      { kind: 'sweep', wave: 'sine', from: 70, to: 28, dur: 2.00, gain: 0.22, delay: 0.10 }
    ] },

    /* ---- interface */
    uiClick: { layers: [
      { kind: 'sweep', wave: 'square', from: 880, to: 660, dur: 0.05, gain: 0.08 }
    ] },
    uiSelect: { layers: [
      { kind: 'chime', notes: [880, 1320], dur: 0.22, gain: 0.10 }
    ] },
    /* Refusal: a purchase you cannot afford, or an upgrade already maxed. */
    uiDenied: { layers: [
      { kind: 'sweep', wave: 'square', from: 300, to: 150, dur: 0.17, gain: 0.11 }
    ] }
  };

  /* Ambient beds, one per mood. Slow, quiet and deliberately sparse: this
     plays for a whole level and must not become tiring. `root` is the key in
     Hz; `notes` are semitone offsets the arpeggio wanders through. */
  DH.MUSIC = {
    menu:  { root: 130.81, notes: [0, 7, 12, 16], pace: 3.2, gain: 0.16, wave: 'triangle', cutoff: 900 },
    level: { root: 110.00, notes: [0, 3, 7, 10, 12], pace: 2.4, gain: 0.13, wave: 'triangle', cutoff: 780 },
    boss:  { root: 82.41,  notes: [0, 1, 5, 8], pace: 1.2, gain: 0.17, wave: 'sawtooth', cutoff: 620 }
  };

  /* Spoken lines, rendered by the browser's speech synthesiser. Functions
     receive context and return the string to speak. */
  DH.VOICE = {
    heroSelected: function (hero) { return hero.name + ' ready.'; },
    levelStart: function (level) { return level.name; },
    checkpoint: function () { return 'Checkpoint reached.'; },
    bossAppear: function (name) { return 'Warning. ' + name + '.'; },
    bossEnrage: function () { return 'It is breaking apart.'; },
    playerDown: function () { return 'You went down.'; },
    levelComplete: function () { return 'Level complete.'; },
    lowHealth: function () { return 'Health critical.'; }
  };
})(window.DH);
