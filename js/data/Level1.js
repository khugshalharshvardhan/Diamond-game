/* Level 1 — "The Ruins".
   Plain data only. Level 2 is a new file like this one, not new code.

   The world is built from the cut-out art in assets/images/terrain/level-01/.
   A platform names a piece; the engine tiles that art across the platform's
   collision box and clips it to the box, so the collision stays authoritative
   and the picture conforms to it.

   REACHABILITY
   The Tank is the constraint: a 702px/s jump reaches 107px up and only 128px
   across. Every gap here is therefore 110px or less, or crossed by a bridge or
   a tower shelf. Verified against all three heroes.

   Coordinates: x grows right, y grows down. Floor surface sits at y = 500. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const GROUND = 500;

  /* One scale per piece keeps stone thickness consistent across the level;
     change a value here and every use of that piece restyles together. */
  const S_GROUND = 0.62;    // floor slabs      -> 1013px walkable per tile
  const S_LEDGE  = 0.24;    // mossy shelves    -> ~268px each
  const S_BRIDGE = 0.30;    // rope bridge      -> 472px
  const S_PILLAR = 0.70;    // standable tower  -> 272px shelf

  /* Solid floor: art tiled across, cannot be dropped through. */
  const floor = (x, w) => ({ x, y: GROUND, w, h: 220, piece: 'ground', scale: S_GROUND });

  /* Thin shelf, one tile wide. Jump up through it from below, drop with S. */
  const shelf = (x, y, wide) => ({
    x, y, w: DH.terrainRun(wide ? 'ledgeWide' : 'ledgeShort', S_LEDGE), h: 24,
    oneWay: true, piece: wide ? 'ledgeWide' : 'ledgeShort', scale: S_LEDGE
  });

  const bridge = (x, y) => ({
    x, y, w: DH.terrainRun('bridge', S_BRIDGE), h: 20,
    oneWay: true, piece: 'bridge', scale: S_BRIDGE
  });

  /* A ruined pillar you can actually stand on, not just scenery. */
  const pillar = (x, y) => ({
    x, y, w: DH.terrainRun('pillarLedge', S_PILLAR), h: 24,
    oneWay: true, piece: 'pillarLedge', scale: S_PILLAR
  });

  /* Scenery, no collision. */
  const prop = (piece, x, y, scale, opts) =>
    Object.assign({ piece, x, y, scale: scale || 1 }, opts || {});

  /* Evenly spaced pickups; `arc` lifts the middle so jump paths read clearly. */
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

  DH.LEVEL_1 = {
    id: 1,
    name: 'The Ruins',
    /* Names an entry in DH.ART.scenes. Absent = procedural sky. */
    scene: 'ruins',
    width: 5760,
    height: 540,
    deathY: 900,
    spawn: { x: 90, y: GROUND - 120 },
    reward: 60,

    /* Towers stand behind the play space, faded back so the action in front of
       them stays readable. Flipped copies stop the repeats reading as tiling. */
    props: [
      prop('towerArch',    260,  300, 0.70, { fade: 0.55 }),
      prop('towerBalcony', 1540, 280, 0.62, { fade: 0.50 }),
      prop('pillarLedge',  2170, 330, 0.60, { fade: 0.55, flip: true }),
      prop('towerArch',    3080, 280, 0.72, { fade: 0.50, flip: true }),
      prop('towerBalcony', 4260, 300, 0.64, { fade: 0.55 }),
      prop('towerArch',    5170, 270, 0.75, { fade: 0.45, flip: true })
    ],

    platforms: [
      /* ---- floor. Two gaps and one pit; the 110px gap is the only one meant
         to be jumped flat, and it is inside the Tank's 128px reach. */
      floor(0, 1210),          // 0    .. 1210
      floor(1320, 940),        // 1320 .. 2260   gap of 110
      floor(2440, 960),        // 2440 .. 3400   gap of 180, bridged
      floor(3640, 2120),       // 3640 .. 5760   pit of 240, crossed by a pillar

      /* ---- opening rise: teaches the jump before anything can hit you */
      shelf(620, 410, false),
      shelf(940, 330, true),

      /* ---- first encounter pocket */
      shelf(1450, 400, true),
      shelf(1800, 320, false),

      /* ---- rope bridge over the second gap */
      bridge(2160, 430),

      /* ---- stair climb, diamonds at the top */
      shelf(2600, 410, false),
      shelf(2900, 330, false),
      shelf(3120, 250, true),

      /* ---- the pit. The pillar shelf sits 80px up, inside every hero's
         jump, and is the only way across. */
      pillar(3430, 420),
      shelf(3560, 330, false),

      /* ---- approach to the gate */
      shelf(3860, 410, true),
      shelf(4180, 330, false),

      /* ---- arena furniture */
      shelf(4700, 410, true),
      shelf(4950, 320, false),
      shelf(5180, 410, false)
    ],

    enemies: [
      { x: 700,  y: 410 - 38 },
      { x: 1080, y: GROUND - 38 },

      { x: 1400, y: GROUND - 38 },
      { x: 1560, y: 400 - 38 },
      { x: 1880, y: 320 - 38 },
      { x: 2100, y: GROUND - 38 },

      { x: 2520, y: GROUND - 38 },
      { x: 2700, y: 410 - 38 },
      { x: 2980, y: 330 - 38 },
      { x: 3200, y: 250 - 38 },
      { x: 3320, y: GROUND - 38 },

      { x: 3720, y: GROUND - 38 },
      { x: 3950, y: 410 - 38 },
      { x: 4260, y: 330 - 38 },
      { x: 4400, y: GROUND - 38 }
    ],

    pickups: []
      .concat(row(300, 430, 4, 46))
      .concat(arc(960, 290, 5, 46, 34))
      .concat(row(1360, 430, 3, 44))
      .concat(arc(1820, 268, 4, 48, 30))
      .concat(row(2260, 380, 4, 62))
      .concat([{ x: 2400, y: 438, kind: 'health' }])
      .concat(arc(3150, 198, 5, 48, 32))
      .concat([{ x: 3240, y: 140, kind: 'gem' }])
      .concat(row(3460, 366, 3, 70))
      .concat(row(3900, 358, 3, 52))
      .concat([{ x: 4220, y: 278, kind: 'gem' }])
      .concat([{ x: 4420, y: 438, kind: 'health' }])
      .concat(row(4750, 358, 3, 52))
      .concat(row(5220, 358, 3, 52)),

    checkpoints: [
      { x: 1380, y: GROUND - 74, label: 'Checkpoint reached' },
      { x: 3300, y: GROUND - 74, label: 'Checkpoint reached' },
      { x: 4480, y: GROUND - 74, label: 'Last checkpoint before the gate' }
    ],

    /* Crossing bossTrigger drops the gate and locks the camera to `arena`. */
    bossTrigger: 4620,
    gate: { x: 4560, y: 150, w: 30, h: 350 },
    arena: { x: 4560, y: 0, w: 1200, h: 700 },
    boss: { x: 5360, y: GROUND - 118, name: 'The Warden', health: 460 }
  };
})(window.DH);
