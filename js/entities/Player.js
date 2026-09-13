/* Player — the only entity that reads Input.
   Stats come entirely from the hero table, so the three heroes are data, not
   subclasses. Game feel lives here: coyote time, jump buffering, variable jump
   height, squash and stretch, and invulnerability after a hit. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  const GROUND_ACCEL = 4200;
  const AIR_ACCEL = 2700;
  const GROUND_FRICTION = 4000;
  const AIR_FRICTION = 900;
  const COYOTE = 0.10;   // grace period after walking off a ledge
  const BUFFER = 0.12;   // grace period for pressing jump before landing
  const LOW_HEALTH = 0.25;   // fraction at which the hero calls it out

  class Player extends DH.Entity {
    constructor(x, y, hero, upgrades) {
      super(x, y, 34, 52);
      this.hero = hero;
      /* Shop upgrades are resolved once here, never re-read mid-run, so a
         purchase cannot change a hero already in the field. */
      this.mods = DH.upgradeEffect(upgrades);
      this.maxHealth = hero.maxHealth + this.mods.healthAdd;
      this.health = this.maxHealth;

      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.fireTimer = 0;
      this.invuln = 0;
      this.hitFlash = 0;
      this.muzzle = 0;
      this.runT = 0;
      this.animT = 0;   // free-running clock for idle breathing, scarf, reactor
      this.walkDist = 0;   // odometer, in world px, that drives the walk cycle
      this.sx = 1;
      this.sy = 1;
      this.control = true;
      this.dead = false;

      /* Ability. `powerTimer` is remaining active time, `powerCool` is
         remaining lockout. Which of the three it runs is decided entirely by
         hero.power in the data file. */
      this.powerTimer = 0;
      this.powerCool = 0;
      this.hurtPose = 0;
      this.warnedLow = false;
    }

    respawn(x, y) {
      this.x = x; this.y = y;
      this.vx = this.vy = 0;
      this.health = this.maxHealth;
      this.dead = false;
      this.control = true;
      this.invuln = 1.1;
      this.facing = 1;
      this.sx = this.sy = 1;
      this.powerTimer = 0;
      this.powerCool = 0;
      this.hurtPose = 0;
      this.warnedLow = false;
    }

    /* ---- current stats, after whatever the ability is doing. Every consumer
       reads these rather than hero.* directly, so a buff can never apply to
       movement but get forgotten for damage. */

    get power() { return this.hero.power; }
    get powerReady() { return this.powerCool <= 0 && this.powerTimer <= 0; }
    get dashing() { return this.powerTimer > 0 && this.power.id === 'phasedash'; }

    curSpeed() {
      const p = this.power;
      return this.hero.speedPx * this.mods.speedMul *
             (this.powerTimer > 0 && p.speedMul ? p.speedMul : 1);
    }

    curDamage() {
      const p = this.power;
      return this.hero.damage * this.mods.damageMul *
             (this.powerTimer > 0 && p.damageMul ? p.damageMul : 1);
    }

    curFireRate() {
      const p = this.power;
      return this.hero.fireRate * (this.powerTimer > 0 && p.fireRateMul ? p.fireRateMul : 1);
    }

    usePower(level) {
      if (!this.powerReady || !this.control || this.dead) return;
      const p = this.power;
      this.powerTimer = p.duration;
      this.powerCool = p.cooldown;

      if (p.id === 'phasedash') {
        this.vx = this.facing * p.dashSpeed;
        this.vy = Math.min(this.vy, 0);
        this.invuln = Math.max(this.invuln, p.duration + 0.08);
      }

      DH.Audio.play(p.id === 'phasedash' ? 'dash' : 'ability');
      level.cam.shake(6, 0.18);
      level.fx.burst(this.cx, this.cy, 18, {
        speed: 260, life: 0.45, size: 4, color: this.hero.accent, gravity: 120, shape: 'shard'
      });
      level.fx.spawn({
        x: this.cx, y: this.cy, life: 0.5, max: 0.5, gravity: 0,
        size: 9, color: this.hero.trim, shape: 'ring'
      });
      level.game.ui.toast(p.name);
    }

    heal(amount) {
      this.health = Math.min(this.maxHealth, this.health + amount);
      /* Healing back over the line re-arms the warning for next time. */
      if (this.health / this.maxHealth > LOW_HEALTH) this.warnedLow = false;
    }

    hurt(amount, fromX, level) {
      if (this.dead || this.invuln > 0) return;

      /* Shield Core soaks a fraction rather than granting flat immunity, so
         the Tank still feels pressure while the ability is up — and so the
         ability can never trivialise the boss. */
      const p = this.power;
      const shielded = this.powerTimer > 0 && p.id === 'shieldcore';
      const taken = shielded ? amount * (1 - p.absorb) : amount;

      DH.Audio.play(shielded ? 'shielded' : 'playerHurt');
      this.health -= taken;
      this.invuln = 0.9;
      this.hitFlash = 0.14;
      this.hurtPose = 0.3;
      const dir = Math.sign(this.cx - fromX) || 1;
      this.vx = dir * (shielded ? 120 : 260);
      this.vy = shielded ? -120 : -240;
      level.cam.shake(shielded ? 4 : 9, 0.25);
      level.fx.burst(this.cx, this.cy, shielded ? 14 : 10, {
        speed: 240, life: 0.4, size: 4,
        color: shielded ? this.hero.trim : '#ff5d9e', gravity: 500
      });
      level.game.ui.setHealth(this.health, this.maxHealth);

      /* Warn once per trip below the line, not once per hit taken under it. */
      if (this.health > 0 && this.health / this.maxHealth <= LOW_HEALTH && !this.warnedLow) {
        this.warnedLow = true;
        DH.Audio.say('lowHealth');
      }

      if (this.health <= 0) this.die(level);
    }

    die(level) {
      if (this.dead) return;
      this.health = 0;
      this.dead = true;
      this.control = false;
      DH.Audio.play('playerDie');
      DH.Audio.say('playerDown');
      level.cam.shake(16, 0.5);
      level.fx.burst(this.cx, this.cy, 34, {
        speed: 360, life: 0.8, size: 5, color: this.hero.accent, gravity: 620, shape: 'shard'
      });
      level.game.onPlayerDied();
    }

    update(dt, level) {
      const input = level.game.input;

      this.invuln -= dt;
      this.hitFlash -= dt;
      this.fireTimer -= dt;
      this.coyote -= dt;
      this.jumpBuffer -= dt;
      this.muzzle -= dt;
      this.dropThrough -= dt;
      this.hurtPose -= dt;
      this.powerTimer -= dt;
      this.powerCool -= dt;

      if (this.control && input.pressed('ability')) this.usePower(level);

      let dir = 0;
      if (this.control) {
        if (input.down('left')) dir -= 1;
        if (input.down('right')) dir += 1;
      }
      if (dir !== 0) this.facing = dir;

      // ---- horizontal
      if (this.dashing) {
        /* The dash owns velocity outright: steering mid-dash would turn it
           into flight rather than a committed burst. */
        this.vx = this.facing * this.power.dashSpeed;
        level.fx.spawn({
          x: this.cx, y: this.cy, vx: 0, vy: 0,
          life: 0.22, max: 0.22, gravity: 0,
          size: 7, color: this.hero.accent
        });
      } else {
        const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
        if (dir !== 0) {
          this.vx = U.approach(this.vx, dir * this.curSpeed(), accel * dt);
        } else {
          this.vx = U.approach(this.vx, 0, (this.onGround ? GROUND_FRICTION : AIR_FRICTION) * dt);
        }
      }

      // ---- jump: buffered input, coyote grace, variable height
      if (this.control && input.pressed('jump')) this.jumpBuffer = BUFFER;

      if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
        /* Down+jump drops through, but only with a thin platform actually
           underfoot. On solid ground it has to stay a normal jump, or the
           input is silently swallowed and the player just doesn't leave. */
        const dropping = this.control && input.down('down') &&
                         DH.Physics.oneWayUnder(this, level.solids);
        if (dropping) {
          this.dropThrough = 0.16;          // drop through thin platforms
        } else {
          DH.Audio.play('jump');
          this.vy = -this.hero.jumpPx;
          this.onGround = false;
          this.coyote = 0;
          this.sx = 0.78; this.sy = 1.22;
          level.fx.burst(this.cx, this.bottom, 7, {
            speed: 120, life: 0.3, size: 3, color: '#9fb3e8', gravity: 500
          });
        }
        this.jumpBuffer = 0;
      }

      const rising = this.vy < 0;
      const cut = rising && !input.down('jump');
      /* The dash hangs. Full gravity through it would drop the Scout out of the
         air mid-burst and make it useless for crossing gaps. */
      DH.Physics.applyGravity(this, dt, this.dashing ? 0 : (cut ? 2.3 : 1));

      // ---- move against the world
      const wasAir = !this.onGround;
      const hit = DH.Physics.move(this, level.solids, dt);
      this.onGround = hit.ground;
      if (this.onGround) {
        this.coyote = COYOTE;
        if (wasAir) {
          DH.Audio.play('land');
          this.sx = 1.25; this.sy = 0.76;
          level.fx.burst(this.cx, this.bottom, 6, {
            speed: 130, life: 0.26, size: 3, color: '#9fb3e8', gravity: 600
          });
        }
      }

      // ---- fire
      if (this.control && input.down('fire') && this.fireTimer <= 0) this.fire(level);

      // ---- animation state
      this.sx = U.damp(this.sx, 1, 0.0001, dt);
      this.sy = U.damp(this.sy, 1, 0.0001, dt);
      this.animT += dt;
      /* Never reset: the cycle should resume where it left off after a jump,
         not snap back to the contact frame. */
      this.walkDist += Math.abs(this.vx) * dt;
      if (this.onGround) this.runT += Math.abs(this.vx) * dt * 0.055;
      else this.runT = 0;

      if (this.y > level.data.deathY) this.die(level);
    }

    fire(level) {
      const h = this.hero;
      DH.Audio.play(h.bulletSize >= 9 ? 'shootHeavy' : 'shoot');
      this.fireTimer = this.curFireRate();
      this.muzzle = 0.06;
      this.vx -= this.facing * 28;

      const ox = this.cx + this.facing * 20;
      const oy = this.y + 22;

      level.bullets.push(new DH.Bullet({
        x: ox, y: oy,
        vx: this.facing * h.bulletSpeedPx,
        vy: 0,
        owner: 'player',
        damage: this.curDamage(),
        size: h.bulletSize,
        color: h.accent,
        life: 1.1
      }));

      level.fx.burst(ox + this.facing * 6, oy, 4, {
        speed: 130, life: 0.14, size: 3, color: '#ffffff', gravity: 0
      });
      level.cam.shake(h.bulletSize * 0.35, 0.07);
    }

    draw(ctx) {
      if (this.dead) return;

      const cx = this.cx, by = this.bottom;
      /* Blink on i-frames, and run a brighter strobe during Phase Dash so the
         two never read as the same state. */
      const blink = this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0;

      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, by + 2, this.w * 0.4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* Ability aura, under the body so it never hides the silhouette. */
      if (this.powerTimer > 0 && !this.dashing) {
        ctx.save();
        ctx.globalAlpha = 0.30 + Math.sin(this.animT * 9) * 0.10;
        ctx.shadowColor = this.hero.accent;
        ctx.shadowBlur = 26;
        ctx.fillStyle = this.hero.accent;
        ctx.beginPath();
        ctx.ellipse(cx, by - this.h * 0.5, this.w * 0.78, this.h * 0.66, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      if (this.dashing) ctx.globalAlpha = 0.65;
      else if (blink) ctx.globalAlpha = 0.4;
      ctx.translate(cx, by);
      ctx.scale(this.facing * this.sx, this.sy);

      DH.HeroArt.draw(ctx, this.hero, {
        pose: DH.HeroArt.poseFor(this),
        runT: this.runT,
        vx: this.vx,
        muzzle: this.muzzle,
        flash: this.hitFlash > 0,
        t: this.animT,
        dist: this.walkDist
      });

      ctx.restore();
    }
  }

  DH.Player = Player;
})(window.DH);
