/* Entity — the smallest useful base. Position is top-left, like every box in
   Physics, so no entity ever has to convert between anchor conventions. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  class Entity {
    constructor(x, y, w, h) {
      this.x = x; this.y = y;
      this.w = w; this.h = h;
      this.vx = 0; this.vy = 0;
      this.facing = 1;
      this.dead = false;
      this.dropThrough = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }

    overlaps(o) { return DH.Utils.overlaps(this, o); }

    update() {}
    draw() {}
  }

  DH.Entity = Entity;
})(window.DH);
