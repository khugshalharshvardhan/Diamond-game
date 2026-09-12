/* Bullet — owned by 'player' or 'enemy'. Dies on world geometry or on its
   first valid target. Shockwaves are the same class with gravity off and a
   longer life, which keeps the boss from needing its own projectile type. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  class Bullet extends DH.Entity {
    constructor(opts) {
      const size = opts.size || 6;
      super(opts.x - size / 2, opts.y - size / 2, size, size * 0.7);
      this.vx = opts.vx;
      this.vy = opts.vy || 0;
      this.owner = opts.owner;
      this.damage = opts.damage;
      this.color = opts.color || '#7fe6ff';
      this.life = opts.life || 1.4;
      this.gravity = opts.gravity || 0;
      this.passesWalls = !!opts.passesWalls;
      this.trail = 0;
    }

    update(dt, level) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }

      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (!this.passesWalls) {
        for (let i = 0; i < level.solids.length; i++) {
          const s = level.solids[i];
          if (s.oneWay) continue;
          if (DH.Utils.overlaps(this, s)) { this.burst(level); return; }
        }
      }

      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 0.03;
        level.fx.spawn({
          x: this.cx, y: this.cy, vx: 0, vy: 0,
          life: 0.18, max: 0.18, gravity: 0,
          size: this.w * 0.6, color: this.color
        });
      }
    }

    burst(level) {
      this.dead = true;
      level.fx.burst(this.cx, this.cy, 5, {
        speed: 150, life: 0.24, size: 3, color: this.color, gravity: 250
      });
    }

    draw(ctx) {
      const len = Math.max(10, Math.abs(this.vx) * 0.012);
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(Math.atan2(this.vy, this.vx));
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = this.color;
      DH.Utils.roundRect(ctx, -len / 2, -this.h / 2, len, this.h, this.h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      DH.Utils.roundRect(ctx, len / 2 - this.h, -this.h / 4, this.h, this.h / 2, this.h / 4);
      ctx.fill();
      ctx.restore();
    }
  }

  DH.Bullet = Bullet;
})(window.DH);
