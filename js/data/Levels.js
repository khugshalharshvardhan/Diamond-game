/* Levels — the registry. One entry per level in the world, in play order.

   This is what the world map reads, what Continue uses to reopen the right
   level, and what deploy() uses to start the chosen one. Adding level 2 means
   writing js/data/Level2.js and pointing `data` at it here — no other file
   changes.

   `data: null` means the level is designed but not built yet. The map shows it
   as a real node so progression is visible, and refuses to start it. Nothing
   here pretends a level exists when it does not.

   `map` is the node's position on the world-map plate, as a fraction of the
   stage. Measured against the skyward scene so the nodes sit on the islands
   rather than in open sky. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  DH.LEVELS = [
    {
      id: 1,
      name: 'The Ruins',
      blurb: 'Overgrown aqueducts above the falls.',
      scene: 'ruins',
      data: DH.LEVEL_1,
      map: { x: 0.175, y: 0.705 }
    },
    {
      id: 2,
      name: 'The Molten Keep',
      blurb: 'A fortress built into a living volcano.',
      scene: 'foundry',
      data: null,
      map: { x: 0.360, y: 0.610 }
    },
    {
      id: 3,
      name: 'The Sunken Grove',
      blurb: 'Old forest, older magic, colder water.',
      scene: 'grove',
      data: null,
      map: { x: 0.545, y: 0.545 }
    },
    {
      id: 4,
      name: 'The Skyward Vault',
      blurb: 'The Obsidian Order keeps the Core up here.',
      scene: 'skyward',
      data: null,
      boss: true,
      map: { x: 0.735, y: 0.415 }
    }
  ];

  DH.levelById = function (id) {
    for (let i = 0; i < DH.LEVELS.length; i++) {
      if (DH.LEVELS[i].id === id) return DH.LEVELS[i];
    }
    return null;
  };
})(window.DH);
