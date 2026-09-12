/* Particles — one flat pool for sparks, dust, gem shards and floating numbers.
   Kept deliberately dumb: no emitters, no owners, no lifetime callbacks. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  class Particles {
    constructor(limit) {
      this.list = [];
      this.limit = limit || 420;
    }

    clear() { this.list.length = 0; }

    spawn(o) {
      if (this.list.length >= this.limit) this.list.shift();
      this.list.push(Object.assign({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0.5, max: 0.5,
        size: 3, color: '#fff',
        gravity: 700, drag: 0.86,
        shape: 'spark', text: '', spin: 0, angle: 0
      }, o));
    }

    burst(x, y, count, o) {
      for (let i = 0; i < count; i++) {
        const a = U.rand(0, Math.PI * 2);
        const s = U.rand((o.speed || 140) * 0.35, o.speed || 140);
        const life = U.rand((o.life || 0.5) * 0.6, o.life || 0.5);
        this.spawn(Object.assign({}, o, {
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - (o.lift || 0),
          life, max: life,
          size: U.rand((o.size || 3) * 0.6, o.size || 3),
          angle: a, spin: U.rand(-8, 8)
        }));
      }
    }

    number(x, y, text, color) {
      this.spawn({
        x, y, vx: U.rand(-24, 24), vy: -120,
        life: 0.85, max: 0.85,
        gravity: 190, drag: 0.97,
        shape: 'text', text, color: color || '#ffffff', size: 15
      });
    }

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
      }
    }

    draw(ctx) {
      for (let i = 0; i < this.list.length; i++) {
        const p = this.list[i];
        const t = p.life / p.max;
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.color;

        if (p.shape === 'text') {
          ctx.font = '700 ' + p.size + 'px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
        } else if (p.shape === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          U.gemPath(ctx, 0, 0, p.size, p.size * 1.5);
          ctx.fill();
          ctx.restore();
        } else if (p.shape === 'ring') {
          ctx.globalAlpha = t * 0.5;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * t;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t) * 6 + 6, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const s = p.size * (0.4 + t * 0.6);
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  DH.Particles = Particles;
})(window.DH);
