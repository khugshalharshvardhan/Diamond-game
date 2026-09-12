/* Companion — the friend rescued later in the story.
   Present as a stub so the save flag, the spawn hook and the follow behaviour
   all exist now. It trails the player through a short position history, which
   gives believable pathing without any navigation code. Combat comes later. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  /* Nova's full-body cutout is flagged `tiny-source` in the pack: a very small
     extraction with an approximate edge. Good enough in motion at this size;
     the clean portrait is the one to use for dialogue close-ups. */
  let sheet;
  function sheetFor() {
    if (sheet !== undefined) return sheet;
    const def = DH.ART && DH.ART.companion;
    sheet = def ? new DH.Sprite(def) : null;
    return sheet;
  }

  class Companion extends DH.Entity {
    constructor(x, y) {
      super(x, y, 26, 30);
      this.history = [];
      this.delay = 22;      // frames of lag behind the player
      this.bob = U.rand(0, 6);
    }

    update(dt, level) {
      const p = level.player;
      this.history.push({ x: p.cx, y: p.cy });
      if (this.history.length > this.delay) this.history.shift();

      const target = this.history[0];
      if (!target) return;

      this.x = U.damp(this.x, target.x - this.w / 2 - p.facing * 34, 0.0009, dt);
      this.y = U.damp(this.y, target.y - this.h / 2 - 26, 0.002, dt);
      this.bob += dt * 3;
      this.facing = p.facing;
    }

    draw(ctx) {
      const sh = sheetFor();
      if (sh) {
        ctx.save();
        ctx.translate(this.cx, this.bottom + Math.sin(this.bob) * 3);
        ctx.scale(this.facing, 1);
        const ok = sh.draw(ctx, 'idle', 0);
        ctx.restore();
        if (ok) return;
      }

      ctx.save();
      ctx.translate(this.cx, this.cy + Math.sin(this.bob) * 3);
      ctx.shadowColor = '#66f0d0';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#66f0d0';
      U.gemPath(ctx, 0, 0, this.w, this.h);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(6,10,23,.8)';
      ctx.fillRect(-5, -3, 10, 4);
      ctx.restore();
    }
  }

  DH.Companion = Companion;
})(window.DH);
