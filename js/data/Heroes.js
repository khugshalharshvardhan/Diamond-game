/* Heroes — pure stat data. Adding a fourth hero should never require code:
   everything below is read by Player (stats, ability), HeroArt (art flags) and
   UIManager (display strings). There are no hero subclasses anywhere.

   UNITS
   -----
   Design stats are authored the way the design doc states them, so the numbers
   here match the spec sheet one-for-one and the character cards can print them
   unmodified:

     health        hit points
     damage        hit points per projectile
     speed         pixels per frame at 60fps
     jump          take-off velocity, pixels per frame at 60fps
     fireRate      seconds between shots
     bulletSpeed   pixels per frame at 60fps

   The engine works in pixels per second, so the block at the bottom of this
   file derives `speedPx`, `jumpPx` and `bulletSpeedPx`. Gameplay code reads
   ONLY the *Px values; the UI shows only the raw design values.

   Why jump does not scale by 60 like the others: at x60 the Tank's jump of 9
   reaches 63px, and Level 1 needs 90px to get from the floor onto the first
   ledge and 80px per stair — the Tank literally could not finish the level.
   The scale is tuned to the weakest hero instead, which preserves the 9:11:13
   ratio the spec asks for while keeping every hero able to clear the level. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const SCALE = { speed: 60, jump: 78, bulletSpeed: 60 };

  DH.HEROES = {
    assault: {
      id: 'assault',
      name: 'Assault',
      role: 'Balanced',
      blurb: 'Even on every axis. The one to learn a level with.',

      accent: '#ff8a4c',
      shade: '#c4452a',
      trim: '#ffd08a',

      health: 100,
      damage: 20,
      speed: 5,
      jump: 11,
      fireRate: 0.25,
      bulletSpeed: 12,

      bulletSize: 6,

      /* Read by HeroArt. Flags, not code paths per hero. */
      art: { build: 1.00, hood: false, scarf: true, reactor: false, visor: 'band', weapon: 'carbine' },

      power: {
        id: 'overdrive',
        name: 'Overdrive',
        blurb: 'Fire rate, movement and damage all surge at once.',
        duration: 5.0,
        cooldown: 14,
        damageMul: 1.5,
        speedMul: 1.3,
        fireRateMul: 0.55
      }
    },

    tank: {
      id: 'tank',
      name: 'Tank',
      role: 'Heavy',
      blurb: 'Soaks hits and hits back hard. Slow to reposition.',

      accent: '#5ce08a',
      shade: '#1f7a4d',
      trim: '#c8ffd8',

      health: 160,
      damage: 30,
      speed: 3.5,
      jump: 9,
      fireRate: 0.40,
      bulletSpeed: 10,

      bulletSize: 10,

      art: { build: 1.18, hood: false, scarf: false, reactor: true, visor: 'slit', weapon: 'cannon' },

      power: {
        id: 'shieldcore',
        name: 'Shield Core',
        blurb: 'A reactor field absorbs most incoming damage.',
        duration: 5.0,
        cooldown: 16,
        absorb: 0.65
      }
    },

    scout: {
      id: 'scout',
      name: 'Scout',
      role: 'Fast',
      blurb: 'Fast and fragile. Wins by never standing still.',

      accent: '#5ce0ff',
      shade: '#2467c4',
      trim: '#d6f6ff',

      health: 80,
      damage: 15,
      speed: 7,
      jump: 13,
      fireRate: 0.14,
      bulletSpeed: 14,

      bulletSize: 4,

      art: { build: 0.90, hood: true, scarf: false, reactor: false, visor: 'wide', weapon: 'pistols' },

      power: {
        id: 'phasedash',
        name: 'Phase Dash',
        blurb: 'A short burst of speed that passes through harm.',
        duration: 0.18,
        cooldown: 2.2,
        dashSpeed: 1150
      }
    }
  };

  DH.HERO_ORDER = ['assault', 'tank', 'scout'];

  /* ---- derive engine units, and the 0..1 bar fractions the cards draw.
     Bars are relative to the best hero in each column, so adding a fourth
     hero rescales them automatically instead of needing hand-kept pips. */

  const ids = DH.HERO_ORDER;
  const best = {
    health: Math.max.apply(null, ids.map((i) => DH.HEROES[i].health)),
    damage: Math.max.apply(null, ids.map((i) => DH.HEROES[i].damage)),
    speed: Math.max.apply(null, ids.map((i) => DH.HEROES[i].speed)),
    rate: Math.max.apply(null, ids.map((i) => 1 / DH.HEROES[i].fireRate))
  };

  ids.forEach((id) => {
    const h = DH.HEROES[id];
    h.speedPx = h.speed * SCALE.speed;
    h.jumpPx = h.jump * SCALE.jump;
    h.bulletSpeedPx = h.bulletSpeed * SCALE.bulletSpeed;
    h.maxHealth = h.health;

    /* Shots per second, rounded for display. Higher reads as better, which is
       what a player expects from a stat called "fire rate". */
    h.shotsPerSecond = Math.round((1 / h.fireRate) * 10) / 10;

    h.bars = {
      Health: h.health / best.health,
      Damage: h.damage / best.damage,
      Speed: h.speed / best.speed,
      'Fire rate': (1 / h.fireRate) / best.rate
    };
    h.readout = {
      Health: String(h.health),
      Damage: String(h.damage),
      Speed: String(h.speed),
      'Fire rate': h.shotsPerSecond + '/s'
    };
  });
})(window.DH);
