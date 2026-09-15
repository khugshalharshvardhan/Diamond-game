/* SaveManager — one versioned blob in localStorage.
   Every read merges over DEFAULTS, so adding a field later cannot break an old
   save. `version` is the hook for real migrations when the schema changes.
   Safari throws on localStorage over file://, so everything degrades to memory. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const KEY = 'diamondHeroes.save.v1';
  const VERSION = 1;

  /* Settings live in their OWN key, not in the run blob. Starting a new run
     calls clear(), and a player who turned the music off does not expect that
     to come back because they started over. */
  const SETTINGS_KEY = 'diamondHeroes.settings.v1';

  const SETTINGS_DEFAULTS = {
    music: true,
    sfx: true,
    voice: true,
    musicVolume: 0.45,
    sfxVolume: 0.8,
    screenShake: true,
    highContrast: false,
    touchControls: false   // forced on; touch devices get them anyway
  };

  const DEFAULTS = {
    version: VERSION,
    hero: null,
    diamonds: 100,
    level: 1,
    checkpoint: -1,
    unlockedLevels: [1],
    completedLevels: [],
    weapons: ['blaster'],
    equipped: 'blaster',
    ammo: null,
    medkits: 0,
    upgrades: {},
    clearedEnemies: [],
    collectedPickups: [],
    companionRescued: false,
    updatedAt: 0
  };

  const SaveManager = {
    available: true,
    _memory: null,

    _read() {
      try {
        const raw = window.localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        this.available = false;
        return this._memory;
      }
    },

    _write(data) {
      this._memory = data;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(data));
      } catch (err) {
        this.available = false;
      }
    },

    exists() {
      const d = this._read();
      return !!(d && d.hero);
    },

    load() {
      const stored = this._read();
      if (!stored) return Object.assign({}, DEFAULTS);
      if (stored.version !== VERSION) {
        // Future migrations land here. For now, start clean rather than guess.
        return Object.assign({}, DEFAULTS);
      }
      return Object.assign({}, DEFAULTS, stored);
    },

    /* Merge a partial patch into the existing save. */
    save(patch) {
      const data = Object.assign(this.load(), patch, {
        version: VERSION,
        updatedAt: Date.now()
      });
      this._write(data);
      return data;
    },

    clear() {
      this._memory = null;
      try { window.localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
    },

    /* ---- settings. Same merge-over-defaults contract as the run blob, so a
       field added later cannot break a stored preference set. */

    _settingsMemory: null,

    loadSettings() {
      let stored = null;
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        stored = raw ? JSON.parse(raw) : null;
      } catch (err) {
        this.available = false;
        stored = this._settingsMemory;
      }
      return Object.assign({}, SETTINGS_DEFAULTS, stored || {});
    },

    saveSettings(patch) {
      const data = Object.assign(this.loadSettings(), patch);
      this._settingsMemory = data;
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
      } catch (err) {
        this.available = false;
      }
      return data;
    }
  };

  DH.SaveManager = SaveManager;
})(window.DH);
