/* Pickup — diamonds, big gems, health, ammo. Pickups placed by the level have
   a stable id so collection can be recorded permanently; enemy drops get a
   null id and simply cease to exist when taken. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  const KINDS = {
    diamond: { w: 18, h: 22, color: '#7fe6ff', value: 1 },
    gem:     { w: 30, h: 38, color: '#ffd86b', value: 8 },
    health:  { w: 26, h: 26, color: '#66f0d0', value: 30 },
    ammo:    { w: 26, h: 22, color: '#ffd86b', value: 20 }
  };

  /* One Sprite per pickup kind, keyed by the same strings as KINDS. */
  const sheets = Object.create(null);

  function sheetFor(kind) {
    if (kind in sheets) return sheets[kind];
    const def = DH.ART && DH.ART.pickups && DH.ART.pickups[kind];
    sheets[kind] = def ? new DH.Sprite(def) : null;
    return sheets[kind];
  }

  class Pickup extends DH.Entity {
    constructor(x, y, kind, id) {
      const k = KINDS[kind] || KINDS.diamond;
      super(x, y, k.w, k.h);
      this.kind = kind;
      this.id = (id === undefined) ? null : id;
      this.color = k.color;
      this.value = k.value;
      this.phase = U.rand(0, Math.PI * 2);
      this.baseY = y;
      this.magnet = false;
      this.settle = 0;
    }

    /* Enemy drops pop out and fall before they start bobbing. */
    static drop(x, y, kind) {
      const p = new Pickup(x, y, kind, null);
      p.vx = U.rand(-130, 130);
      p.vy = U.rand(-330, -190);
      p.settle = 0.9;
      return p;
    }

    update(dt, level) {
      const player = level.player;

      if (this.settle > 0) {
        this.settle -= dt;
        DH.Physics.applyGravity(this, dt, 0.7);
        const hit = DH.Physics.move(this, level.solids, dt);
        this.vx *= Math.pow(0.9, dt * 60);
        if (hit.ground) { this.vx *= 0.4; this.settle = Math.min(this.settle, 0.05); }
        this.baseY = this.y;
      } else {
        this.phase += dt * 2.6;
        const dist = Math.hypot(player.cx - this.cx, player.cy - this.cy);
        if (dist < 130 && !player.dead) this.magnet = true;

        if (this.magnet) {
          const k = 9 * dt;
          this.x = U.lerp(this.x, player.cx - this.w / 2, k);
          this.y = U.lerp(this.y, player.cy - this.h / 2, k);
        } else {
          this.y = this.baseY + Math.sin(this.phase) * 4;
        }
      }

      if (!player.dead && this.overlaps(player)) this.collect(level);
    }

    collect(level) {
      this.dead = true;
      DH.Audio.play(this.kind);
      const g = level.game;

      if (this.kind === 'health') {
        level.player.heal(this.value);
        g.ui.setHealth(level.player.health, level.player.maxHealth);
        level.fx.number(this.cx, this.y - 6, '+' + this.value, '#66f0d0');
      } else if (this.kind === 'ammo') {
        /* Fills the pool the player is actually holding, so a box is never a
           refill for a gun they do not own. */
        level.player.addAmmoPool(level.player.pool, this.value);
        g.ui.setAmmo(level.player.shots, level.player.shotsMax);
        level.fx.number(this.cx, this.y - 6, '+' + this.value, '#ffd86b');
      } else {
        g.addDiamonds(this.value);
        if (this.value > 1) level.fx.number(this.cx, this.y - 6, '+' + this.value, '#ffd86b');
      }

      if (this.id !== null) level.collected.add(this.id);

      level.fx.burst(this.cx, this.cy, this.value > 1 ? 12 : 6, {
        speed: 190, life: 0.4, size: 4, color: this.color, gravity: 300, shape: 'shard'
      });
    }

    draw(ctx) {
      const sh = sheetFor(this.kind);
      if (sh) {
        ctx.save();
        ctx.translate(this.cx, this.cy);
        /* The art has no spin frames, so the horizontal squeeze that sold the
           procedural gem's rotation is applied to the sprite instead. */
        if (this.kind === 'diamond' || this.kind === 'gem') {
          ctx.scale(Math.max(0.3, Math.abs(Math.cos(this.phase * 0.8))), 1);
        }
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        const ok = sh.draw(ctx, 'idle', 0);
        ctx.restore();
        if (ok) return;
      }

      const cx = this.cx, cy = this.cy;
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 14;

      if (this.kind === 'health') {
        ctx.fillStyle = 'rgba(6,10,23,.85)';
        U.roundRect(ctx, this.x, this.y, this.w, this.h, 6); ctx.fill();
        ctx.fillStyle = this.color;
        ctx.fillRect(cx - 8, cy - 3, 16, 6);
        ctx.fillRect(cx - 3, cy - 8, 6, 16);
      } else if (this.kind === 'ammo') {
        ctx.fillStyle = 'rgba(6,10,23,.85)';
        U.roundRect(ctx, this.x, this.y, this.w, this.h, 5); ctx.fill();
        ctx.fillStyle = this.color;
        for (let i = 0; i < 3; i++) ctx.fillRect(this.x + 5 + i * 6, this.y + 6, 3, 10);
      } else {
        const spin = Math.cos(this.phase * 0.8);
        ctx.translate(cx, cy);
        ctx.scale(Math.max(0.25, Math.abs(spin)), 1);
        U.gemPath(ctx, 0, 0, this.w, this.h);
        const grd = ctx.createLinearGradient(0, -this.h / 2, 0, this.h / 2);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.45, this.color);
        grd.addColorStop(1, 'rgba(0,0,0,.35)');
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  DH.Pickup = Pickup;
})(window.DH);
