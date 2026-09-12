/* Utils — shared math + canvas helpers. No state, no dependencies. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const Utils = {
    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp(a, b, t) { return a + (b - a) * t; },

    /* Frame-rate independent smoothing. `rate` = fraction remaining after 1s. */
    damp(a, b, rate, dt) { return b + (a - b) * Math.pow(rate, dt); },

    /* Move `v` toward `target` by at most `step`. */
    approach(v, target, step) {
      return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
    },

    rand(lo, hi) { return lo + Math.random() * (hi - lo); },
    randInt(lo, hi) { return Math.floor(lo + Math.random() * (hi - lo + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

    /* Deterministic noise, for background decoration that must not flicker. */
    hash(n) {
      const x = Math.sin(n * 127.1) * 43758.5453;
      return x - Math.floor(x);
    },

    /* Axis-aligned box overlap. Boxes are {x, y, w, h} with x,y at top-left. */
    overlaps(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x &&
             a.y < b.y + b.h && a.y + a.h > b.y;
    },

    pointIn(px, py, b) {
      return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    },

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    },

    /* A four-point gem silhouette, used for diamonds and hero crests. */
    gemPath(ctx, cx, cy, w, h) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - h / 2);
      ctx.lineTo(cx + w / 2, cy - h / 6);
      ctx.lineTo(cx, cy + h / 2);
      ctx.lineTo(cx - w / 2, cy - h / 6);
      ctx.closePath();
    }
  };

  DH.Utils = Utils;
})(window.DH);
