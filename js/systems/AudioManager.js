/* AudioManager — every sound the game makes.

   Three buses hang off one master gain: music, sfx, voice. Settings turn a bus
   down rather than tearing anything down, so toggling is instant and never
   interrupts what is already playing.

   DESIGN NOTES

   Nothing is loaded. Sounds are built from oscillators and noise buffers at
   the moment they play, per the recipes in js/data/Audio.js. That keeps the
   game a zero-asset, file://-friendly download and means no sound can ever be
   "missing". Give a sound a `src` in the data file and a real recording takes
   over instead, with the synth recipe as its fallback.

   Browsers refuse to start audio without a user gesture, so the context is
   created immediately but stays suspended until the first click or keypress
   anywhere. Everything before that point is silently dropped rather than
   queued — a burst of stale sounds on first click would be worse than silence.

   Voice uses the browser's speech synthesiser. It is genuinely optional: the
   API is missing on some platforms and has no voices installed on others, and
   in both cases the game simply does not speak. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  /* Hard ceiling on concurrent one-shots. A boss volley plus a dozen dying
     enemies can otherwise stack into clipping and a CPU spike. */
  const MAX_VOICES = 18;

  /* Identical sounds fired within this window collapse into one. Bullets at
     the Scout's fire rate would otherwise phase against themselves. */
  const DEDUPE = 0.035;

  const Audio = {
    ctx: null,
    ready: false,
    blocked: true,
    settings: null,

    buses: { music: null, sfx: null },
    _voices: 0,
    _last: Object.create(null),
    _music: null,
    _musicName: null,
    _noiseBuffer: null,
    _filePool: Object.create(null),
    _speech: null,

    /* ---------------------------------------------------------- lifecycle */

    init() {
      this.settings = DH.SaveManager.loadSettings();

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;                    // no Web Audio: the game is silent, not broken

      try {
        this.ctx = new Ctx();
      } catch (err) {
        this.ctx = null;
        return;
      }

      const master = this.ctx.createGain();
      master.gain.value = 0.9;
      master.connect(this.ctx.destination);

      this.buses.music = this.ctx.createGain();
      this.buses.sfx = this.ctx.createGain();
      this.buses.music.connect(master);
      this.buses.sfx.connect(master);

      this._applyVolumes();
      this.ready = true;

      this._speech = window.speechSynthesis || null;

      /* One gesture unlocks playback for the session. */
      const unlock = () => {
        this.blocked = false;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    },

    _applyVolumes() {
      if (!this.ready) return;
      const s = this.settings;
      this.buses.music.gain.value = s.music ? s.musicVolume : 0;
      this.buses.sfx.gain.value = s.sfx ? s.sfxVolume : 0;
    },

    /* The only way settings change. Persists through SaveManager so audio
       preferences are never scattered across localStorage. */
    set(key, value) {
      this.settings[key] = value;
      DH.SaveManager.saveSettings({ [key]: value });
      this._applyVolumes();
      if (key === 'music' && !value) this.stopMusic();
      else if (key === 'music' && value && this._musicName) this.music(this._musicName, true);
      if (key === 'voice' && !value) this.shutUp();
    },

    toggle(key) {
      this.set(key, !this.settings[key]);
      return this.settings[key];
    },

    /* ---------------------------------------------------------- sfx */

    play(name, opts) {
      if (!this.ready || this.blocked || !this.settings.sfx) return;

      const def = DH.SOUNDS[name];
      if (!def) return;

      const now = this.ctx.currentTime;
      if (now - (this._last[name] || -1) < DEDUPE) return;
      this._last[name] = now;

      if (this._voices >= MAX_VOICES) return;

      const volume = (opts && opts.volume) || 1;
      const rate = (opts && opts.rate) || 1;

      /* A real recording wins whenever one has been supplied. */
      if (def.src && this._playFile(def.src, volume, rate)) return;

      const layers = def.layers || [];
      for (let i = 0; i < layers.length; i++) {
        this._layer(layers[i], now, volume, rate);
      }
    },

    /* File playback uses plain <audio> elements rather than decoded buffers.

       That is deliberate: fetch() and XHR are blocked on file:// in Chrome, so
       decodeAudioData can never get the bytes, while a media element loads
       file:// media fine. The trade-off is that these do not pass through the
       Web Audio bus, so the sfx volume is applied to the element directly.

       Elements are pooled per source and cloned on demand, which lets the same
       sound overlap with itself. Returns false if nothing could be played, so
       the caller falls back to the synth. */
    _playFile(src, volume, rate) {
      let pool = this._filePool[src];
      if (pool === null) return false;               // known-bad, do not retry

      if (!pool) {
        try {
          const el = new window.Audio(DH.Assets ? DH.Assets.resolve(src) : src);
          el.preload = 'auto';
          el.addEventListener('error', () => { this._filePool[src] = null; });
          pool = this._filePool[src] = [el];
        } catch (err) {
          this._filePool[src] = null;
          return false;
        }
      }

      /* Reuse a finished element, or clone one so overlapping shots work. */
      let el = null;
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].paused || pool[i].ended) { el = pool[i]; break; }
      }
      if (!el) {
        if (pool.length >= 6) return true;           // enough already sounding
        el = pool[0].cloneNode();
        pool.push(el);
      }

      try {
        el.currentTime = 0;
        el.playbackRate = rate;
        el.volume = Math.max(0, Math.min(1, this.settings.sfxVolume * volume));
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
        return true;
      } catch (err) {
        return false;
      }
    },

    _track(node) {
      this._voices++;
      node.onended = () => { this._voices--; };
    },

    _noise() {
      if (this._noiseBuffer) return this._noiseBuffer;
      const len = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buf;
      return buf;
    },

    _layer(L, now, volume, rate) {
      const t0 = now + (L.delay || 0);
      const dur = (L.dur || 0.2) / rate;
      const peak = (L.gain || 0.15) * volume;
      const g = this.ctx.createGain();

      /* Short attack, exponential tail. A linear fade on a short sound reads
         as a click; the exponential ramp is what makes it sound struck. */
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + Math.min(0.012, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(this.buses.sfx);

      if (L.kind === 'noise') {
        const src = this.ctx.createBufferSource();
        src.buffer = this._noise();
        src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = L.filter || 'lowpass';
        f.frequency.setValueAtTime(L.freq || 1000, t0);
        if (L.sweepTo) {
          f.frequency.exponentialRampToValueAtTime(Math.max(L.sweepTo, 20), t0 + dur);
        }
        f.Q.value = L.filter === 'bandpass' ? 1.6 : 0.8;
        src.connect(f).connect(g);
        this._track(src);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
      } else if (L.kind === 'chime') {
        const notes = L.notes || [880];
        for (let i = 0; i < notes.length; i++) {
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(notes[i] * rate, t0);
          const og = this.ctx.createGain();
          /* Upper harmonics quieter, or the stack turns shrill. */
          og.gain.value = 1 / (i + 1.4);
          o.connect(og).connect(g);
          this._track(o);
          o.start(t0);
          o.stop(t0 + dur + 0.02);
        }
      } else {
        const o = this.ctx.createOscillator();
        o.type = L.wave || 'sine';
        const from = Math.max((L.from || 440) * rate, 20);
        const to = Math.max((L.to || from) * rate, 20);
        o.frequency.setValueAtTime(from, t0);
        o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
        o.connect(g);
        this._track(o);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
      }
    },

    /* ---------------------------------------------------------- music */

    /* A slow two-voice pad plus a wandering arpeggio, scheduled a bar ahead so
       it never stutters when the main thread is busy drawing. */
    music(name, force) {
      if (!this.ready) return;
      if (this._musicName === name && this._music && !force) return;

      this.stopMusic();
      this._musicName = name;
      if (!this.settings.music) return;

      const def = DH.MUSIC[name];
      if (!def) return;

      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      out.connect(this.buses.music);
      out.gain.exponentialRampToValueAtTime(def.gain, ctx.currentTime + 2.5);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = def.cutoff;
      filter.Q.value = 0.7;
      filter.connect(out);

      /* Two detuned drones a fifth apart: the bed. */
      const drones = [];
      [1, 1.5].forEach((mult, i) => {
        const o = ctx.createOscillator();
        o.type = def.wave;
        o.frequency.value = def.root * mult;
        o.detune.value = i === 0 ? -6 : 5;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.26;
        o.connect(g).connect(filter);
        o.start();
        drones.push(o);
      });

      /* Slow breathing on the cutoff so the pad is never static. */
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoGain.gain.value = def.cutoff * 0.35;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();

      const state = { out, drones, lfo, timer: 0, stopped: false };

      const step = () => {
        if (state.stopped) return;
        const t = ctx.currentTime + 0.05;
        const semi = def.notes[Math.floor(Math.random() * def.notes.length)];
        const freq = def.root * 4 * Math.pow(2, semi / 12);

        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.10, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + def.pace * 0.9);
        o.connect(g).connect(filter);
        o.start(t);
        o.stop(t + def.pace);

        state.timer = setTimeout(step, def.pace * 1000 * (0.8 + Math.random() * 0.5));
      };
      state.timer = setTimeout(step, 1200);

      this._music = state;
    },

    stopMusic() {
      const m = this._music;
      if (!m) return;
      m.stopped = true;
      clearTimeout(m.timer);
      const t = this.ctx.currentTime;
      try {
        m.out.gain.cancelScheduledValues(t);
        m.out.gain.setValueAtTime(Math.max(m.out.gain.value, 0.0002), t);
        m.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        m.drones.forEach((o) => o.stop(t + 0.7));
        m.lfo.stop(t + 0.7);
      } catch (err) { /* already stopped */ }
      this._music = null;
    },

    /* ---------------------------------------------------------- voice */

    /* `key` names an entry in DH.VOICE; extra arguments are passed to it. */
    say(key) {
      if (!this.settings || !this.settings.voice) return;
      if (!this._speech || this.blocked) return;

      const make = DH.VOICE[key];
      if (!make) return;

      const text = make.apply(null, Array.prototype.slice.call(arguments, 1));
      if (!text) return;

      /* Voices load asynchronously in some browsers, and an empty list means
         nothing will be spoken — bail rather than queue silence. */
      let voices = [];
      try { voices = this._speech.getVoices() || []; } catch (err) { return; }
      if (!voices.length) return;

      /* A new line always replaces the old one. Two overlapping announcements
         are unintelligible, and lines here are short status calls. */
      try { this._speech.cancel(); } catch (err) { /* ignore */ }

      const u = new window.SpeechSynthesisUtterance(text);
      const preferred = voices.filter((v) => /en[-_]/i.test(v.lang));
      u.voice = preferred[0] || voices[0];
      u.rate = 0.98;
      u.pitch = 0.82;      // lower than default: reads as an announcer, not an assistant
      u.volume = 0.95;

      try { this._speech.speak(u); } catch (err) { /* ignore */ }
    },

    shutUp() {
      if (!this._speech) return;
      try { this._speech.cancel(); } catch (err) { /* ignore */ }
    },

    /* What is actually working, for the console. */
    report() {
      return {
        webAudio: !!this.ctx,
        state: this.ctx ? this.ctx.state : 'none',
        unlocked: !this.blocked,
        speech: !!this._speech,
        voicesInstalled: this._speech ? (this._speech.getVoices() || []).length : 0,
        settings: this.settings,
        music: this._musicName
      };
    }
  };

  DH.Audio = Audio;
})(window.DH);
