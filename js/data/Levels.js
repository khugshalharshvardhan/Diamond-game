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
      mechanic: 'Move, jump, shoot.',
      scene: 'ruins',                 // backgrounds/forgotten-ruins.png
      data: DH.LEVEL_1,
      map: { x: 0.140, y: 0.725 }
    },
    {
      id: 2,
      name: 'The Dark Fortress',
      blurb: 'Lava, chains, and the Dark Colossus.',
      mechanic: 'Lava hazards and a second boss.',
      scene: 'foundry',               // backgrounds/dark-fortress.png
      data: DH.LEVEL_2,
      boss: true,
      map: { x: 0.300, y: 0.648 }
    },
    {
      id: 3,
      name: 'Enchanted Forest',
      blurb: 'Giant trees, glowing mushrooms, hidden paths.',
      mechanic: 'Moving platforms and hidden routes.',
      scene: 'grove',                 // backgrounds/enchanted-forest.png
      data: null,
      map: { x: 0.455, y: 0.575 }
    },
    {
      id: 4,
      name: 'Crystal Canyon',
      blurb: 'The crystal mines. Something is held down here.',
      mechanic: 'Hazards, collapsing bridges, the Nova rescue.',
      /* No painted plate supplied for this one — it falls back to the
         procedural sky rather than borrowing another level's location. */
      scene: null,
      data: null,
      map: { x: 0.612, y: 0.497 }
    },
    {
      id: 5,
      name: 'Sky Kingdom',
      blurb: 'Floating islands and a very long way down.',
      mechanic: 'Large gaps and moving platforms.',
      scene: 'skyward',               // backgrounds/sky-kingdom.png
      data: null,
      map: { x: 0.775, y: 0.402 }
    }
  ];

  DH.levelById = function (id) {
    for (let i = 0; i < DH.LEVELS.length; i++) {
      if (DH.LEVELS[i].id === id) return DH.LEVELS[i];
    }
    return null;
  };
})(window.DH);
