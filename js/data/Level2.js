/* Level 2 — "The Dark Fortress".
   Plain data only, like Level 1.

   TERRAIN
   There is no lava terrain art, so this level's platforms are drawn from the
   `foundry` palette in js/data/Palettes.js: cold basalt with hot ember edges
   and embers drifting off the surfaces. That is a deliberate choice, not a
   placeholder — it reads as its own place against the fortress backdrop. Drop
   cut-out art into assets/images/terrain/level-02/, describe it in Terrain.js
   and name it on a platform here, exactly as Level 1 does.

   HAZARD
   Every gap here is open lava. Falling is fatal at deathY, which is the same
   mechanic as Level 1's pit, just read differently by the art.

   REACHABILITY
   Same constraint as Level 1: the Tank clears 107px up and 128px across, so
   every gap is 110px or less or crossed by a shelf, and every step up is 90px
   or under. Verified across all three heroes.

   Coordinates: x grows right, y grows down. Floor surface sits at y = 500. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const GROUND = 500;

  const floor = (x, w) => ({ x, y: GROUND, w, h: 220 });
  const shelf = (x, y, w) => ({ x, y, w: w || 200, h: 22, oneWay: true });

  function row(x, y, n, gap, kind) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: x + i * gap, y, kind: kind || 'diamond' });
    return out;
  }
  function arc(x, y, n, gap, rise) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * 2 - 1;
      out.push({ x: x + i * gap, y: y + t * t * (rise || 40), kind: 'diamond' });
    }
    return out;
  }

  DH.LEVEL_2 = {
    id: 2,
    name: 'The Dark Fortress',
    scene: 'foundry',
    /* Lighter scrim than Level 1: the fortress plate is already dark, and
       dimming it further would lose the lava glow that sells the place. */
    sceneDim: 0.30,
    width: 5600,
    height: 540,
    deathY: 900,
    spawn: { x: 90, y: GROUND - 120 },
    reward: 90,

    platforms: [
      /* ---- floor, broken by lava */
      floor(0, 900),           // 0    ..  900
      floor(1010, 860),        // 1010 .. 1870   lava gap of 110
      floor(2050, 900),        // 2050 .. 2950   lava gap of 180, shelved
      floor(3220, 1000),       // 3220 .. 4220   lava pit of 270, shelved
      floor(4330, 1270),       // 4330 .. 5600   lava gap of 110

      /* ---- safe opening, then the first climb */
      shelf(420, 410),
      shelf(700, 330),

      /* ---- first encounter pocket */
      shelf(1150, 400),
      shelf(1450, 320),

      /* ---- the shelf that carries you over the second lava gap */
      shelf(1830, 420, 220),

      /* ---- the climb: three steps of 80 */
      shelf(2200, 410),
      shelf(2500, 330),
      shelf(2760, 250),

      /* ---- the lava pit. This shelf is the only way over. */
      shelf(2990, 420),

      /* ---- upper route, with the level's hidden gem above it */
      shelf(3400, 410),
      shelf(3700, 330),
      shelf(3950, 240, 180),

      /* ---- arena furniture */
      shelf(4700, 410),
      shelf(4950, 320),
      shelf(5200, 410)
    ],

    stages: [
      { x: 420,  label: 'The Outer Wall' },
      { x: 2100, label: 'The Foundry' },
      { x: 3280, label: 'The Keep' }
    ],

    enemies: [
      /* -- harder mix from the start: this is the second level */
      { kind: 'grunt',  x: 500,  y: 410 },
      { kind: 'gunner', x: 820,  y: GROUND },

      { kind: 'grunt',  x: 1120, y: GROUND },
      { kind: 'gunner', x: 1250, y: 400 },
      { kind: 'drone',  x: 1520, y: 240 },
      { kind: 'grunt',  x: 1760, y: GROUND },

      { kind: 'brute',  x: 2150, y: GROUND },
      { kind: 'gunner', x: 2300, y: 410 },
      { kind: 'drone',  x: 2580, y: 220 },
      { kind: 'grunt',  x: 2840, y: 250 },

      { kind: 'brute',  x: 3300, y: GROUND },
      { kind: 'gunner', x: 3480, y: 410 },
      { kind: 'drone',  x: 3780, y: 200 },
      { kind: 'brute',  x: 4020, y: GROUND },
      { kind: 'gunner', x: 4160, y: GROUND }
    ],

    pickups: []
      .concat(row(200, 430, 4, 46))
      .concat(arc(720, 290, 4, 48, 30))
      .concat(row(1060, 430, 3, 46))
      .concat(arc(1470, 268, 4, 46, 28))
      .concat([{ x: 1900, y: 372, kind: 'health' }])
      .concat([{ x: 1300, y: 438, kind: 'ammo' }])
      .concat([{ x: 2400, y: 438, kind: 'ammo' }])
      .concat(row(2230, 360, 3, 56))
      .concat(arc(2790, 198, 4, 48, 30))
      .concat(row(3030, 372, 3, 56))
      .concat(row(3430, 360, 3, 52))
      /* the hidden gem: only reachable off the high shelf */
      .concat([{ x: 4010, y: 186, kind: 'gem' }])
      .concat([{ x: 4180, y: 438, kind: 'health' }])
      .concat([{ x: 3560, y: 438, kind: 'ammo' }])
      .concat([{ x: 4400, y: 438, kind: 'ammo' }])
      .concat(row(4740, 358, 3, 52))
      .concat(row(5240, 358, 3, 52)),

    checkpoints: [
      { x: 1100, y: GROUND - 74, label: 'Checkpoint reached' },
      { x: 3260, y: GROUND - 74, label: 'Checkpoint reached' },
      { x: 4380, y: GROUND - 74, label: 'Last checkpoint before the gate' }
    ],

    bossTrigger: 4520,
    gate: { x: 4460, y: 150, w: 30, h: 350 },
    arena: { x: 4460, y: 0, w: 1140, h: 700 },
    boss: { x: 5220, y: GROUND - 118, name: 'The Dark Colossus', health: 620 }
  };
})(window.DH);
