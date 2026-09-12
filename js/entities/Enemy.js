/* Enemy — "Husk", the one basic enemy for the prototype.
   Patrols its platform using a ledge probe, notices the player at range,
   telegraphs for a beat, then lunges. Contact damage only: no enemy
   projectiles at this stage, which keeps early encounters readable. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  const PATROL_SPEED = 74;
  const CHARGE_SPEED = 215;
  const SIGHT_X = 330;
  const SIGHT_Y = 90;

  /* One Sprite per enemy kind, built on first use. `kind` is data, so Phase 6
     adds enemy types by naming a different key rather than by new draw code. */
  const sheets = Object.create(null);

  function sheetFor(kind) {
    if (kind in sheets) return sheets[kind];
    const def = DH.ART && DH.ART.enemies && DH.ART.enemies[kind];
    sheets[kind] = def ? new DH.Sprite(def) : null;
    return sheets[kind];
  }

  /* Artwork if it has loaded, shapes if not. The supplied art is one static
     pose, so the walk is a flip plus translation, not an animation. */
  function drawArt(ctx, e) {
    const sheet = sheetFor(e.kind);
    if (!sheet) return false;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(e.cx, e.bottom + 2, e.w * 0.42, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(e.cx, e.bottom);
    ctx.scale(e.facing, 1);
    if (e.state === 'alert') ctx.translate(U.rand(-1.2, 1.2), 0);
    const ok = sheet.draw(ctx, 'idle', 0);
    ctx.restore();

    /* The art has no damage frame, so the white hit flash is painted over the
       sprite to keep hits readable. */
    if (ok && e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(e.x - 4, e.y - 10, e.w + 8, e.h + 10);
      ctx.restore();
    }
    return ok;
  }

  class Enemy extends DH.Entity {
    constructor(x, y, id, kind) {
      super(x, y, 40, 38);
      this.id = id;
      this.kind = kind || 'grunt';
      this.maxHealth = 40;
      this.health = 40;
      this.damage = 13;
      this.state = 'patrol';
      this.timer = 0;
      this.facing = -1;
      this.onGround = false;
      this.hitFlash = 0;
      this.step = U.rand(0, 6);
      this.bobSeed = U.rand(0, 6);
      this.hurtShow = 0;
    }

    hurt(amount, fromX, level) {
      if (this.dead) return;
      this.health -= amount;
      this.hitFlash = 0.12;
      this.hurtShow = 1.6;
      this.vx += Math.sign(this.cx - fromX) * 90;
      level.fx.number(this.cx, this.y - 4, String(Math.round(amount)), '#ffffff');
      level.fx.burst(this.cx, this.cy, 6, {
        speed: 210, life: 0.3, size: 3, color: '#ff8fb6', gravity: 500
      });
      if (this.health <= 0) this.die(level);
      else if (this.state === 'patrol') this.state = 'alert', this.timer = 0.25;
    }

    die(level) {
      this.dead = true;
      level.clearedPending.add(this.id);
      level.fx.burst(this.cx, this.cy, 18, {
        speed: 280, life: 0.55, size: 5, color: '#ff5d9e', gravity: 620
      });
      level.fx.burst(this.cx, this.cy, 6, {
        speed: 120, life: 0.7, size: 4, color: '#9fb3e8', gravity: 200
      });
      level.cam.shake(5, 0.14);

      const n = U.randInt(2, 3);
      for (let i = 0; i < n; i++) level.pickups.push(DH.Pickup.drop(this.cx, this.cy, 'diamond'));
      if (Math.random() < 0.16) level.pickups.push(DH.Pickup.drop(this.cx, this.cy, 'health'));
    }

    update(dt, level) {
      const player = level.player;
      this.hitFlash -= dt;
      this.hurtShow -= dt;
      this.timer -= dt;

      const dx = player.cx - this.cx;
      const dy = Math.abs(player.cy - this.cy);
      const sees = !player.dead && Math.abs(dx) < SIGHT_X && dy < SIGHT_Y;

      switch (this.state) {
        case 'patrol': {
          this.vx = U.approach(this.vx, PATROL_SPEED * this.facing, 900 * dt);
          if (sees) { this.state = 'alert'; this.timer = 0.36; this.facing = Math.sign(dx) || 1; }
          break;
        }
        case 'alert': {
          this.vx = U.approach(this.vx, 0, 1400 * dt);
          this.facing = Math.sign(dx) || this.facing;
          if (this.timer <= 0) { this.state = 'charge'; this.timer = 1.0; }
          break;
        }
        case 'charge': {
          this.vx = U.approach(this.vx, CHARGE_SPEED * this.facing, 1600 * dt);
          if (this.timer <= 0) { this.state = 'patrol'; this.timer = 0; }
          break;
        }
      }

      DH.Physics.applyGravity(this, dt);
      const hit = DH.Physics.move(this, level.solids, dt);
      this.onGround = hit.ground;

      // Turn at walls, and at ledges: probe one step past the front foot.
      if (hit.wallLeft || hit.wallRight) this.facing *= -1;
      if (this.onGround) {
        const probeX = this.facing > 0 ? this.x + this.w + 6 : this.x - 6;
        if (!DH.Physics.solidAt(probeX, this.bottom + 8, level.solids)) {
          if (this.state === 'charge') { this.vx = 0; this.state = 'patrol'; }
          this.facing *= -1;
        }
      }

      this.step += Math.abs(this.vx) * dt * 0.05;

      if (!player.dead && this.overlaps(player)) {
        player.hurt(this.damage, this.cx, level);
      }
    }

    draw(ctx) {
      if (!drawArt(ctx, this)) this.drawShapes(ctx);
      this.drawHealthBar(ctx);
    }

    drawShapes(ctx) {
      const cx = this.cx, by = this.bottom;
      const flash = this.hitFlash > 0;
      const wind = this.state === 'alert';
      const shell = flash ? '#ffffff' : '#3a2b52';
      const plate = flash ? '#ffffff' : '#584070';
      const eye = wind ? '#ffd86b' : '#ff5d9e';

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, by + 2, this.w * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(this.facing, 1);
      if (wind) ctx.translate(U.rand(-1.2, 1.2), 0);

      const swing = Math.sin(this.step) * 5;
      ctx.fillStyle = '#241a36';
      ctx.fillRect(-11 + swing, -12, 8, 12);
      ctx.fillRect(3 - swing, -12, 8, 12);

      ctx.fillStyle = shell;
      U.roundRect(ctx, -15, -32, 30, 22, 7); ctx.fill();

      ctx.fillStyle = plate;
      U.roundRect(ctx, -4, -36, 19, 16, 6); ctx.fill();

      // Back fin reads as a silhouette cue at distance.
      ctx.fillStyle = '#1b1430';
      ctx.beginPath();
      ctx.moveTo(-14, -32); ctx.lineTo(-24, -22); ctx.lineTo(-13, -18);
      ctx.closePath(); ctx.fill();

      ctx.shadowColor = eye;
      ctx.shadowBlur = 10;
      ctx.fillStyle = eye;
      ctx.fillRect(4, -31, 10, 4);
      ctx.restore();

    }

    drawHealthBar(ctx) {
      const cx = this.cx;
      if (this.hurtShow > 0 && this.health < this.maxHealth) {
        const w = 34;
        ctx.globalAlpha = Math.min(1, this.hurtShow);
        ctx.fillStyle = 'rgba(6,10,23,.8)';
        ctx.fillRect(cx - w / 2, this.y - 12, w, 4);
        ctx.fillStyle = '#ff5d9e';
        ctx.fillRect(cx - w / 2, this.y - 12, w * (this.health / this.maxHealth), 4);
        ctx.globalAlpha = 1;
      }
    }
  }

  DH.Enemy = Enemy;
})(window.DH);
