/* Boss — "The Warden".
   A timer-driven state machine: entrance → idle → (volley | slam | dash) → idle.
   Below half health it enrages: shorter pauses, wider fans, faster dashes.
   Every attack telegraphs through the chest core so the fight stays readable. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  let sheet;
  function sheetFor() {
    if (sheet !== undefined) return sheet;
    const def = DH.ART && DH.ART.boss;
    sheet = def ? new DH.Sprite(def) : null;
    return sheet;
  }

  /* Artwork if loaded, shapes if not. The art is one static pose, so the
     telegraph shake, the phase tint and the hit flash are all painted on top
     rather than being separate frames. */
  function drawArt(ctx, b) {
    const sh = sheetFor();
    if (!sh) return false;

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(b.cx, b.bottom + 3, b.w * 0.46, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(b.cx, b.bottom);
    ctx.scale(b.facing, 1);
    if (b.state === 'wind') ctx.translate(U.rand(-2, 2), U.rand(-1, 1));
    const ok = sh.draw(ctx, 'idle', 0);
    ctx.restore();
    if (!ok) return false;

    /* Corrupted core: brighter and more agitated as health falls, which is the
       phase tell the design asks for and the static art cannot carry. */
    const heat = 1 - (b.health / b.maxHealth);
    ctx.save();
    ctx.globalAlpha = (0.25 + b.core * 0.5) * (0.4 + heat * 0.6);
    ctx.shadowColor = b.enraged ? '#ff9d5c' : '#7fe6ff';
    ctx.shadowBlur = 22 + b.core * 34 + heat * 20;
    ctx.fillStyle = b.enraged ? '#ff9d5c' : '#7fe6ff';
    U.gemPath(ctx, b.cx, b.y + b.h * 0.42, 26 + heat * 8, 34 + heat * 10);
    ctx.fill();
    ctx.restore();

    if (b.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 6, b.y - 16, b.w + 12, b.h + 16);
      ctx.restore();
    }
    return true;
  }

  class Boss extends DH.Entity {
    constructor(def, arena) {
      super(def.x, def.y, 104, 118);
      this.name = def.name;
      this.maxHealth = def.health;
      this.health = def.health;
      this.arena = arena;
      this.contactDamage = 24;
      this.state = 'entrance';
      this.timer = 1.4;
      this.shots = 0;
      this.shotClock = 0;
      this.enraged = false;
      this.hitFlash = 0;
      this.core = 0;
      this.step = 0;
      this.facing = -1;
      this.onGround = false;
      this.invuln = 1.2;
      this.dying = 0;
    }

    get phase() { return this.enraged ? 2 : 1; }

    hurt(amount, fromX, level) {
      if (this.dead || this.invuln > 0 || this.dying > 0) return;
      this.health -= amount;
      this.hitFlash = 0.09;
      level.fx.number(this.cx + U.rand(-20, 20), this.y + 20, String(Math.round(amount)), '#ffffff');
      level.fx.burst(fromX < this.cx ? this.x : this.x + this.w, this.cy, 5, {
        speed: 190, life: 0.26, size: 3, color: '#ffd86b', gravity: 420
      });

      if (this.health <= this.maxHealth * 0.5 && !this.enraged) this.enrage(level);
      if (this.health <= 0) this.beginDeath(level);
    }

    enrage(level) {
      this.enraged = true;
      this.state = 'idle';
      this.timer = 0.7;
      this.core = 1;
      level.cam.shake(14, 0.6);
      level.fx.burst(this.cx, this.cy, 30, {
        speed: 340, life: 0.7, size: 5, color: '#ff9d5c', gravity: 300
      });
      level.game.ui.toast('The Warden splits its casing');
    }

    beginDeath(level) {
      this.health = 0;
      this.dying = 1.6;
      this.vx = 0;
      level.onBossDefeated();
    }

    update(dt, level) {
      const player = level.player;
      this.hitFlash -= dt;
      this.invuln -= dt;
      this.core = Math.max(0, this.core - dt * 1.6);

      if (this.dying > 0) {
        this.dying -= dt;
        this.vx *= 0.9;
        DH.Physics.applyGravity(this, dt);
        DH.Physics.move(this, level.solids, dt);
        if (Math.random() < 0.4) {
          level.fx.burst(
            this.x + U.rand(0, this.w), this.y + U.rand(0, this.h), 6,
            { speed: 260, life: 0.6, size: 5, color: U.pick(['#ff5d9e', '#ffd86b', '#ffffff']), gravity: 340 }
          );
        }
        if (this.dying <= 0) {
          this.dead = true;
          level.fx.burst(this.cx, this.cy, 60, { speed: 520, life: 1.1, size: 7, color: '#ffd86b', gravity: 500, shape: 'shard' });
          level.cam.shake(20, 0.7);
        }
        return;
      }

      this.timer -= dt;
      if (!this.dead && player && !player.dead) {
        const d = Math.sign(player.cx - this.cx);
        if (d !== 0 && this.state !== 'dash') this.facing = d;
      }

      switch (this.state) {
        case 'entrance':
          this.vx = 0;
          if (this.timer <= 0) { this.state = 'idle'; this.timer = 0.8; }
          break;

        case 'idle': {
          this.vx = U.approach(this.vx, this.facing * 60, 700 * dt);
          if (this.timer <= 0) this._chooseAttack(level);
          break;
        }

        case 'wind':
          this.vx = U.approach(this.vx, 0, 1400 * dt);
          this.core = 1;
          if (this.timer <= 0) this._commit(level);
          break;

        case 'volley': {
          this.vx = U.approach(this.vx, 0, 1200 * dt);
          this.shotClock -= dt;
          if (this.shotClock <= 0 && this.shots > 0) {
            this._fire(level);
            this.shots--;
            this.shotClock = this.enraged ? 0.12 : 0.18;
          }
          if (this.shots <= 0 && this.timer <= 0) { this.state = 'idle'; this.timer = this.enraged ? 0.5 : 0.9; }
          break;
        }

        case 'slam': {
          this.vx = U.approach(this.vx, this.facing * 190, 900 * dt);
          break;
        }

        case 'dash': {
          this.vx = U.approach(this.vx, this.facing * (this.enraged ? 620 : 500), 2600 * dt);
          if (this.timer <= 0) { this.state = 'idle'; this.timer = this.enraged ? 0.5 : 0.95; }
          break;
        }
      }

      const wasAir = !this.onGround;
      DH.Physics.applyGravity(this, dt);
      const hit = DH.Physics.move(this, level.solids, dt);
      this.onGround = hit.ground;
      this.step += Math.abs(this.vx) * dt * 0.04;

      if (this.state === 'slam' && wasAir && this.onGround) this._land(level);

      if (this.state === 'dash') {
        const a = this.arena;
        if (this.x <= a.x + 20 || this.x + this.w >= a.x + a.w - 20) {
          this.facing *= -1;
          this.vx = 0;
          level.cam.shake(8, 0.2);
        }
      }

      if (player && !player.dead && this.overlaps(player)) {
        player.hurt(this.contactDamage, this.cx, level);
      }
    }

    _chooseAttack(level) {
      const player = level.player;
      const far = Math.abs(player.cx - this.cx) > 340;
      const roll = Math.random();
      if (far && roll < 0.45) this.next = 'dash';
      else if (roll < 0.6) this.next = 'slam';
      else this.next = 'volley';

      this.state = 'wind';
      this.timer = this.enraged ? 0.32 : 0.5;
    }

    _commit(level) {
      if (this.next === 'volley') {
        this.state = 'volley';
        this.shots = this.enraged ? 5 : 3;
        this.shotClock = 0;
        this.timer = 0.4;
      } else if (this.next === 'slam') {
        this.state = 'slam';
        this.vy = -900;
        this.onGround = false;
        level.cam.shake(6, 0.15);
      } else {
        this.state = 'dash';
        this.timer = this.enraged ? 1.1 : 0.95;
      }
    }

    _fire(level) {
      const player = level.player;
      const ox = this.cx + this.facing * 40;
      const oy = this.y + 46;
      const ang = Math.atan2(player.cy - oy, player.cx - ox) + U.rand(-0.12, 0.12);
      const speed = this.enraged ? 480 : 400;
      level.bullets.push(new DH.Bullet({
        x: ox, y: oy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        owner: 'enemy', damage: 16, size: 12,
        color: '#ff5d9e', life: 2.4
      }));
      level.fx.burst(ox, oy, 5, { speed: 160, life: 0.2, size: 3, color: '#ff9d5c', gravity: 0 });
    }

    _land(level) {
      level.cam.shake(16, 0.4);
      level.fx.burst(this.cx, this.bottom, 24, {
        speed: 330, life: 0.5, size: 5, color: '#9fb3e8', gravity: 800, lift: 80
      });
      level.fx.spawn({ x: this.cx, y: this.bottom, life: 0.45, max: 0.45, gravity: 0, size: 8, color: '#ffd86b', shape: 'ring' });

      for (const dir of [-1, 1]) {
        level.bullets.push(new DH.Bullet({
          x: this.cx + dir * 50, y: this.bottom - 14,
          vx: dir * 330, vy: 0,
          owner: 'enemy', damage: 18, size: 22,
          color: '#ffd86b', life: 2.0, passesWalls: true
        }));
      }
      this.state = 'idle';
      this.timer = this.enraged ? 0.45 : 0.85;
    }

    draw(ctx) {
      if (!drawArt(ctx, this)) this.drawShapes(ctx);
    }

    drawShapes(ctx) {
      const cx = this.cx, by = this.bottom;
      const flash = this.hitFlash > 0;
      const shell = flash ? '#ffffff' : (this.enraged ? '#4b2340' : '#2c2350');
      const plate = flash ? '#ffffff' : (this.enraged ? '#7b3457' : '#473a72');
      const trim = this.enraged ? '#ff9d5c' : '#7fe6ff';
      const glow = 0.35 + this.core * 0.65;

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, by + 3, this.w * 0.46, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(this.facing, 1);
      if (this.state === 'wind') ctx.translate(U.rand(-2, 2), U.rand(-1, 1));

      const swing = Math.sin(this.step) * 7;
      ctx.fillStyle = '#1b1638';
      ctx.fillRect(-34 + swing, -34, 20, 34);
      ctx.fillRect(14 - swing, -34, 20, 34);

      ctx.fillStyle = shell;
      U.roundRect(ctx, -40, -100, 80, 70, 14); ctx.fill();

      ctx.fillStyle = plate;
      U.roundRect(ctx, -52, -100, 30, 34, 10); ctx.fill();
      U.roundRect(ctx, 22, -100, 30, 34, 10); ctx.fill();

      ctx.save();
      ctx.shadowColor = trim;
      ctx.shadowBlur = 16 + this.core * 26;
      ctx.globalAlpha = glow;
      ctx.fillStyle = trim;
      U.gemPath(ctx, 4, -66, 26, 34);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = flash ? '#ffffff' : '#171232';
      U.roundRect(ctx, -20, -124, 46, 28, 9); ctx.fill();

      ctx.shadowColor = '#ff5d9e';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff5d9e';
      ctx.fillRect(-4, -116, 26, 6);
      ctx.shadowBlur = 0;

      ctx.fillStyle = plate;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-14 + i * 16, -124);
        ctx.lineTo(-8 + i * 16, -142);
        ctx.lineTo(-2 + i * 16, -124);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  DH.Boss = Boss;
})(window.DH);
