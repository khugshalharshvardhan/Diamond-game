/* Physics — the only place that resolves entities against world geometry.
   Axis-separated AABB sweep: move X and resolve, then move Y and resolve.
   Doing both axes at once is what produces the classic "snag on a tile seam". */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const GRAVITY = 2300;
  const MAX_FALL = 1500;

  const Physics = {
    GRAVITY,
    MAX_FALL,

    /* Returns {ground, ceiling, wallLeft, wallRight}. Mutates e.x/e.y/e.vx/e.vy. */
    move(e, solids, dt) {
      const hit = { ground: false, ceiling: false, wallLeft: false, wallRight: false };
      const prevBottom = e.y + e.h;

      // ---- X pass. One-way platforms are transparent horizontally.
      e.x += e.vx * dt;
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (s.oneWay) continue;
        if (!DH.Utils.overlaps(e, s)) continue;
        if (e.vx > 0) { e.x = s.x - e.w; hit.wallRight = true; }
        else if (e.vx < 0) { e.x = s.x + s.w; hit.wallLeft = true; }
        e.vx = 0;
      }

      // ---- Y pass.
      e.y += e.vy * dt;
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (!DH.Utils.overlaps(e, s)) continue;

        if (s.oneWay) {
          // Land on it only when falling onto the top edge from above.
          if (e.vy <= 0) continue;
          if (prevBottom > s.y + 6) continue;
          if (e.dropThrough > 0) continue;
          e.y = s.y - e.h; e.vy = 0; hit.ground = true;
          continue;
        }

        if (e.vy > 0) { e.y = s.y - e.h; hit.ground = true; }
        else if (e.vy < 0) { e.y = s.y + s.h; hit.ceiling = true; }
        e.vy = 0;
      }

      return hit;
    },

    applyGravity(e, dt, scale) {
      e.vy = Math.min(e.vy + GRAVITY * (scale || 1) * dt, MAX_FALL);
    },

    /* Is the surface directly under this entity a thin platform?
       Callers use it to tell "drop through" apart from "jump": on real ground
       a down+jump must stay an ordinary jump. Solid geometry wins whenever
       both kinds of surface meet at the same foot height. */
    oneWayUnder(e, solids) {
      const foot = e.y + e.h;
      let found = false;
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (e.x + e.w <= s.x || e.x >= s.x + s.w) continue;
        if (foot < s.y - 2 || foot > s.y + 8) continue;
        if (!s.oneWay) return false;
        found = true;
      }
      return found;
    },

    /* Cheap probe used for ledge detection by walking enemies. */
    solidAt(x, y, solids) {
      for (let i = 0; i < solids.length; i++) {
        if (DH.Utils.pointIn(x, y, solids[i])) return true;
      }
      return false;
    }
  };

  DH.Physics = Physics;
})(window.DH);
