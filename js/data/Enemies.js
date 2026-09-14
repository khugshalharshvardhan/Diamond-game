/* Enemies — one entry per type. Pure data.

   `behaviour` picks which state machine Enemy runs. Three exist, and they are
   genuinely different fights rather than the same one with new numbers:

     melee   patrols a platform, notices you, telegraphs, then charges.
             Dangerous on contact only, so the counter is spacing.
     ranged  holds a standoff distance and shoots. Backs away if you close,
             so the counter is closing anyway, or using cover.
     flyer   ignores gravity and geometry, hovers above you and shoots.
             The counter is looking up.

   `art` names an entry in DH.ART.enemies. Sizes are the COLLISION box; the
   artwork is scaled to it by the manifest's drawHeight.

   Level data places these by SURFACE y — the ground or ledge they stand on —
   and Level works out the box from the height here, so moving an enemy never
   means recomputing an offset by hand. Flyers take their y as an altitude. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  DH.ENEMIES = {
    /* The one you learn on. Fast, fragile, only hurts on contact. */
    grunt: {
      name: 'Goblin',
      art: 'grunt',
      behaviour: 'melee',
      w: 40, h: 38,
      health: 40,
      contact: 13,
      patrol: 74,
      charge: 215,
      sight: { x: 330, y: 90 },
      windup: 0.36
    },

    /* Keeps its distance and punishes standing still. */
    gunner: {
      name: 'Sniper',
      art: 'gunner',
      behaviour: 'ranged',
      w: 38, h: 46,
      health: 55,
      contact: 8,
      patrol: 52,
      sight: { x: 560, y: 140 },
      /* Tries to hold this gap: walks back if you get closer. */
      standoff: 300,
      windup: 0.55,
      shot: { damage: 12, speed: 430, cooldown: 1.7, size: 8, color: '#ff9d5c', life: 2.2 }
    },

    /* Slow, heavy, and takes a magazine to bring down. */
    brute: {
      name: 'Robot',
      art: 'brute',
      behaviour: 'melee',
      w: 54, h: 50,
      health: 130,
      contact: 24,
      patrol: 44,
      charge: 150,
      sight: { x: 300, y: 120 },
      windup: 0.6,
      /* Landing its charge shoves you properly. */
      shove: 1.6
    },

    /* Ignores the terrain entirely, which is the whole point of it. */
    drone: {
      name: 'Flying Drone',
      art: 'drone',
      behaviour: 'flyer',
      w: 44, h: 38,
      health: 45,
      contact: 10,
      patrol: 95,
      sight: { x: 520, y: 340 },
      /* Sits about this far above you and drifts to stay there. */
      hover: 130,
      windup: 0.45,
      shot: { damage: 10, speed: 370, cooldown: 2.0, size: 7, color: '#7fe6ff', life: 2.4 }
    }
  };

  DH.enemyDef = function (kind) {
    return DH.ENEMIES[kind] || DH.ENEMIES.grunt;
  };
})(window.DH);
