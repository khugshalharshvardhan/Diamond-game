/* Level 1 — "The Cutting Floor".
   Plain data only. Level 2 is a new file like this one, not new code.

   World layout, left to right:
     start → gap → checkpoint → encounter → bridge → stair climb →
     checkpoint → pit → encounter → checkpoint → gate → boss arena

   Coordinates: x grows right, y grows down. Ground surface sits at y = 500. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const GROUND = 500;
  const ledge = (x, y, w) => ({ x, y, w, h: 22, oneWay: true });
  const slab  = (x, y, w, h) => ({ x, y, w, h });

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

    platforms: [
      // ---- ground, broken by two gaps and one real pit
      slab(0, GROUND, 1200, 200),
      slab(1330, GROUND, 930, 200),
      slab(2440, GROUND, 960, 200),
      slab(3640, GROUND, 2120, 200),

      // ---- opening rise
      ledge(760, 410, 150),
      ledge(960, 330, 150),
      ledge(1160, 410, 160),

      // ---- first encounter pocket
      ledge(1520, 400, 170),
      ledge(1760, 320, 150),
      ledge(1980, 400, 150),

      // ---- bridge over the second gap
      ledge(2300, 420, 150),

      // ---- stair climb, diamonds at the top
      ledge(2560, 410, 160),
      ledge(2760, 330, 160),
      ledge(2960, 250, 170),
      ledge(3180, 340, 150),

      // ---- crossing the pit
      ledge(3420, 420, 130),
      ledge(3580, 345, 130),

      // ---- approach to the gate
      ledge(3860, 410, 170),
      ledge(4100, 330, 160),
      ledge(4320, 400, 150),

      // ---- arena furniture
      ledge(4700, 380, 180),
      ledge(5240, 380, 180),
      ledge(4960, 265, 200)
    ],

    enemies: [
      { x: 860,  y: GROUND - 38 },
      { x: 1080, y: GROUND - 38 },

      { x: 1470, y: GROUND - 38 },
      { x: 1700, y: GROUND - 38 },
      { x: 1800, y: 320 - 38 },
      { x: 2050, y: GROUND - 38 },

      { x: 2520, y: GROUND - 38 },
      { x: 2800, y: 330 - 38 },
      { x: 2980, y: 250 - 38 },
      { x: 3120, y: GROUND - 38 },
      { x: 3270, y: GROUND - 38 },

      { x: 3700, y: GROUND - 38 },
      { x: 3900, y: 410 - 38 },
      { x: 4060, y: GROUND - 38 },
      { x: 4250, y: GROUND - 38 },
      { x: 4400, y: GROUND - 38 }
    ],

    pickups: []
      .concat(row(300, 430, 4, 46))
      .concat(arc(980, 288, 5, 38, 34))
      .concat(row(1370, 430, 3, 44))
      .concat(arc(1780, 268, 4, 40, 30))
      .concat(row(2320, 368, 3, 46))
      .concat([{ x: 2410, y: 438, kind: 'health' }])
      .concat(arc(2985, 198, 5, 40, 32))
      .concat([{ x: 3060, y: 140, kind: 'gem' }])
      .concat(row(3440, 366, 3, 78))
      .concat(row(3890, 358, 3, 46))
      .concat([{ x: 4140, y: 278, kind: 'gem' }])
      .concat([{ x: 4390, y: 438, kind: 'health' }])
      .concat(row(4750, 328, 3, 48))
      .concat(row(5290, 328, 3, 48)),

    checkpoints: [
      { x: 1390, y: GROUND - 74, label: 'Checkpoint reached' },
      { x: 3300, y: GROUND - 74, label: 'Checkpoint reached' },
      { x: 4480, y: GROUND - 74, label: 'Last checkpoint before the gate' }
    ],

    /* Crossing bossTrigger drops the gate and locks the camera to `arena`. */
    bossTrigger: 4620,
    gate: slab(4560, 150, 30, 350),
    arena: { x: 4560, y: 0, w: 1200, h: 700 },
    boss: { x: 5360, y: GROUND - 118, name: 'The Warden', health: 460 }
  };
})(window.DH);
