/* Terrain — the cut-out art the world is built from. Pure data.

   Each piece describes where its WALKABLE SURFACE sits inside the image, so
   the engine can line the art up with a collision box instead of the level
   author eyeballing it:

     deck    how far down the image the walking surface is, 0..1
     span    the horizontal slice of the image that is actually standable,
             as fractions — the mossy overhang past the stone is not

   Every number below was measured off the art by profiling the longest opaque
   run per row (see docs/art-pipeline.md), not guessed.

   HOW A PIECE IS USED
   A platform in the level data names a piece and keeps its own collision box.
   The engine tiles the art horizontally to fill that box, scaled so the deck
   lands exactly on the box's top edge, and clips it to the box's width so it
   cannot bleed across a gap. That keeps the collision authoritative and the
   art conforming to it, rather than the other way round.

   Props are the same pieces with no collision at all — scenery to stand in
   front of. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const DIR = 'terrain/level-01/';

  DH.TERRAIN = {
    /* ---- floors and ledges. One clean deck each. */
    ground: {
      src: DIR + 'ground-strip.png',
      w: 1667, h: 222, deck: 0.30, span: [0.01, 0.99]
    },
    ledgeWide: {
      src: DIR + 'ledge-wide.png',
      w: 1200, h: 485, deck: 0.32, span: [0.02, 0.94]
    },
    ledgeShort: {
      src: DIR + 'ledge-short.png',
      w: 1201, h: 489, deck: 0.28, span: [0.03, 0.97]
    },
    bridge: {
      src: DIR + 'bridge-rope.png',
      w: 1788, h: 456, deck: 0.50, span: [0.06, 0.94]
    },

    /* ---- towers. Tall pieces with a ledge partway down. Their span is only
       the jutting ledge, not the whole silhouette, so you stand on the mossy
       shelf rather than in mid-air beside the stonework. */
    pillarLedge: {
      src: DIR + 'pillar-ledge.png',
      w: 589, h: 707, deck: 0.48, span: [0.08, 0.74]
    },
    towerArch: {
      src: DIR + 'tower-arch.png',
      w: 508, h: 735, deck: 0.66, span: [0.03, 0.44]
    },
    towerBalcony: {
      src: DIR + 'tower-balcony.png',
      w: 419, h: 760, deck: 0.31, span: [0.14, 0.58]
    }
  };

  /* Width of one tile's walkable run, at a given scale. Level data uses this
     to size a platform to a whole number of tiles instead of a magic number. */
  DH.terrainRun = function (key, scale) {
    const t = DH.TERRAIN[key];
    if (!t) return 0;
    return (t.span[1] - t.span[0]) * t.w * (scale || 1);
  };
})(window.DH);
