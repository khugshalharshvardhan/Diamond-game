/* Enemy — "Husk", the one basic enemy for the prototype.
   Patrols its platform using a ledge probe, notices the player at range,
   telegraphs for a beat, then lunges. Contact damage only: no enemy
   projectiles at this stage, which keeps early encounters readable. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;


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
    const flying = e.def.behaviour === 'flyer';

    /* Nothing airborne gets a contact shadow under its feet. */
    if (!flying) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(e.cx, e.bottom + 2, e.w * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    /* The drone's sprite is centre-anchored in the manifest, so it has to be
       translated to its centre rather than its feet. */
    ctx.translate(e.cx, flying ? e.cy + Math.sin(e.bob) * 3 : e.bottom);
    ctx.scale(e.facing, 1);
    if (e.state === 'alert' || e.state === 'aim') ctx.translate(U.rand(-1.2, 1.2), 0);
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
      const def = DH.enemyDef(kind);
      super(x, y, def.w, def.h);
      this.id = id;
      this.kind = kind || 'grunt';
      this.def = def;
      this.maxHealth = def.health;
      this.health = def.health;
      this.damage = def.contact;
      this.state = 'patrol';
      this.timer = 0;
      this.shotClock = U.rand(0, (def.shot && def.shot.cooldown) || 1);
      this.facing = -1;
      this.onGround = false;
      this.hitFlash = 0;
      this.step = U.rand(0, 6);
      this.hurtShow = 0;
      this.bob = U.rand(0, Math.PI * 2);
      /* Flyers wander around where they were placed until they see you. */
      this.spawnX = x;
    }

    hurt(amount, fromX, level) {
      if (this.dead) return;
      DH.Audio.play('hit');
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
      DH.Audio.play('enemyDie');
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
      /* Kills are the main way the magazine refills; the placed boxes are a
         safety net, not the supply. */
      if (Math.random() < 0.34) level.pickups.push(DH.Pickup.drop(this.cx, this.cy, 'ammo'));
    }

    update(dt, level) {
      const player = level.player;
      const d = this.def;
      this.hitFlash -= dt;
      this.hurtShow -= dt;
      this.timer -= dt;
      this.shotClock -= dt;

      const dx = player.cx - this.cx;
      const dy = player.cy - this.cy;
      const sees = !player.dead &&
                   Math.abs(dx) < d.sight.x && Math.abs(dy) < d.sight.y;

      if (d.behaviour === 'flyer') this._flyer(dt, level, dx, dy, sees);
      else if (d.behaviour === 'ranged') this._ranged(dt, level, dx, sees);
      else this._melee(dt, level, dx, sees);

      /* Flyers are not subject to the world; everything else is. */
      if (d.behaviour !== 'flyer') {
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
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.bob += dt * 3;
      }

      if (!player.dead && this.overlaps(player)) {
        player.hurt(this.damage, this.cx, level);
      }
    }

    /* Patrol, notice, telegraph, charge. Contact damage only. */
    _melee(dt, level, dx, sees) {
      const d = this.def;
      switch (this.state) {
        case 'patrol':
          this.vx = U.approach(this.vx, d.patrol * this.facing, 900 * dt);
          if (sees) { this.state = 'alert'; this.timer = d.windup; this.facing = Math.sign(dx) || 1; }
          break;
        case 'alert':
          this.vx = U.approach(this.vx, 0, 1400 * dt);
          this.facing = Math.sign(dx) || this.facing;
          if (this.timer <= 0) { this.state = 'charge'; this.timer = 1.0; }
          break;
        case 'charge':
          this.vx = U.approach(this.vx, d.charge * this.facing, 1600 * dt);
          if (this.timer <= 0) { this.state = 'patrol'; this.timer = 0; }
          break;
      }
    }

    /* Holds a standoff and shoots. Walks BACKWARDS if you close the gap, which
       is what makes it a different problem from the goblin. */
    _ranged(dt, level, dx, sees) {
      const d = this.def;
      const gap = Math.abs(dx);

      switch (this.state) {
        case 'patrol':
          this.vx = U.approach(this.vx, d.patrol * this.facing, 700 * dt);
          if (sees) { this.state = 'aim'; this.timer = d.windup; }
          break;

        case 'aim':
          this.facing = Math.sign(dx) || this.facing;
          /* Keep the gap open while lining the shot up. */
          if (gap < d.standoff * 0.72) {
            this.vx = U.approach(this.vx, -d.patrol * 1.5 * this.facing, 900 * dt);
          } else if (gap > d.standoff * 1.35) {
            this.vx = U.approach(this.vx, d.patrol * this.facing, 700 * dt);
          } else {
            this.vx = U.approach(this.vx, 0, 1200 * dt);
          }
          if (!sees) { this.state = 'patrol'; break; }
          if (this.timer <= 0 && this.shotClock <= 0) this._shoot(level);
          break;
      }
    }

    /* Ignores gravity and geometry: drifts to a point above the player and
       fires down at them. */
    _flyer(dt, level, dx, dy, sees) {
      const d = this.def;
      const player = level.player;

      if (!sees && this.state === 'patrol') {
        this.vx = U.approach(this.vx, d.patrol * this.facing * 0.45, 400 * dt);
        this.vy = U.approach(this.vy, Math.sin(this.bob) * 22, 300 * dt);
        if (Math.abs(this.x - this.spawnX) > 220) this.facing *= -1;
        return;
      }

      this.state = 'aim';
      this.facing = Math.sign(dx) || this.facing;

      /* Aim for a spot above and slightly behind, so it does not sit exactly
         on top of the player where it cannot be shot. */
      const wantX = player.cx - this.w / 2 - this.facing * 40;
      const wantY = player.cy - d.hover;
      this.vx = U.approach(this.vx, U.clamp((wantX - this.x) * 2.2, -d.patrol * 2, d.patrol * 2), 700 * dt);
      this.vy = U.approach(this.vy, U.clamp((wantY - this.y) * 2.2, -d.patrol * 2, d.patrol * 2), 700 * dt);

      if (this.shotClock <= 0 && Math.abs(dx) < d.sight.x) this._shoot(level);
    }

    _shoot(level) {
      const d = this.def;
      const s = d.shot;
      if (!s) return;

      const player = level.player;
      const ox = this.cx + this.facing * (this.w * 0.5);
      const oy = this.cy;
      const ang = Math.atan2(player.cy - oy, player.cx - ox);

      this.shotClock = s.cooldown;
      DH.Audio.play('shoot', { volume: 0.55, rate: 0.85 });

      level.bullets.push(new DH.Bullet({
        x: ox, y: oy,
        vx: Math.cos(ang) * s.speed,
        vy: Math.sin(ang) * s.speed,
        owner: 'enemy',
        damage: s.damage,
        size: s.size,
        color: s.color,
        life: s.life
      }));
      level.fx.burst(ox, oy, 4, {
        speed: 120, life: 0.16, size: 3, color: s.color, gravity: 0
      });
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

    /* Always shown, not just after a hit: knowing what is nearly dead is the
       point of the bar, and Level only calls draw for enemies on screen. It
       brightens briefly when struck so the hit still registers. */
    drawHealthBar(ctx) {
      const cx = this.cx;
      const w = 34;
      const frac = Math.max(0, this.health / this.maxHealth);
      const hot = this.hurtShow > 0;

      ctx.globalAlpha = hot ? 1 : 0.85;
      ctx.fillStyle = 'rgba(6,10,23,.8)';
      ctx.fillRect(cx - w / 2 - 1, this.y - 13, w + 2, 6);
      ctx.fillStyle = hot ? '#ff9db0' : '#ff5d6e';
      ctx.fillRect(cx - w / 2, this.y - 12, w * frac, 4);
      ctx.globalAlpha = 1;
    }
  }

  DH.Enemy = Enemy;
})(window.DH);
