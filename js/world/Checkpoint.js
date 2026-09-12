/* Checkpoint — a lit pylon. Touching it commits progress and fires a save.
   The level owns the bookkeeping; this class only knows lit vs unlit. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  class Checkpoint extends DH.Entity {
    constructor(x, y, index, label) {
      super(x, y, 44, 74);
      this.index = index;
      this.label = label || 'Checkpoint reached';
      this.active = false;
      /* The pylon is short, but the trigger is a full column: a player jumping
         past at head height still banks the checkpoint. */
      this.trigger = { x: x - 20, y: y - 250, w: 44 + 40, h: 74 + 250 };
      this.pulse = 0;
      this.t = U.rand(0, 6);
    }

    activate(level) {
      if (this.active) return false;
      this.active = true;
      this.pulse = 1;
      level.fx.burst(this.cx, this.cy, 22, {
        speed: 250, life: 0.7, size: 4, color: '#66f0d0', gravity: 160, shape: 'shard'
      });
      level.fx.spawn({ x: this.cx, y: this.cy, life: 0.6, max: 0.6, gravity: 0, size: 10, color: '#66f0d0', shape: 'ring' });
      return true;
    }

    update(dt) {
      this.t += dt;
      this.pulse = Math.max(0, this.pulse - dt * 1.4);
    }

    draw(ctx) {
      const cx = this.cx;
      const glow = this.active ? 0.75 + Math.sin(this.t * 2.4) * 0.2 : 0.12;
      const color = this.active ? '#66f0d0' : '#43507e';

      ctx.save();
      ctx.fillStyle = '#141c3a';
      U.roundRect(ctx, cx - 7, this.y + 14, 14, this.h - 14, 4); ctx.fill();
      ctx.fillStyle = '#223059';
      U.roundRect(ctx, cx - 18, this.y + this.h - 10, 36, 10, 3); ctx.fill();

      ctx.globalAlpha = glow;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18 + this.pulse * 40;
      ctx.fillStyle = color;
      U.gemPath(ctx, cx, this.y + 14, 26, 34);
      ctx.fill();
      ctx.restore();

      if (this.pulse > 0) {
        ctx.save();
        ctx.globalAlpha = this.pulse * 0.5;
        ctx.strokeStyle = '#66f0d0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, this.y + 18, (1 - this.pulse) * 90 + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  DH.Checkpoint = Checkpoint;
})(window.DH);
