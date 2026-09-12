/* Level — owns the simulated world for one level and can rebuild itself from
   data at any time. That rebuild is the whole checkpoint system:

     collected      pickup ids taken. Permanent, so diamonds never respawn
                    and dying can never be used to farm placed gems.
     cleared        enemy ids killed and committed at a checkpoint.
     clearedPending enemy ids killed since the last checkpoint. Discarded on
                    death, which is what makes the run resumable but not free. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  class Level {
    constructor(data, game) {
      this.data = data;
      this.game = game;
      this.fx = game.particles;
      this.cam = game.camera;

      this.collected = new Set();
      this.cleared = new Set();
      this.clearedPending = new Set();
      this.checkpointIndex = -1;

      this.player = null;
      this.completeTimer = 0;
      this.bossDefeated = false;
    }

    /* ---------------------------------------------------- construction */

    build() {
      const d = this.data;

      this.solids = d.platforms.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, oneWay: !!p.oneWay }));
      /* Invisible walls at both ends. Without these the player can simply run
         off the last slab, which reads as a bug rather than a hazard. */
      this.solids.push({ x: -160, y: -1400, w: 160, h: 3200 });
      this.solids.push({ x: d.width, y: -1400, w: 160, h: 3200 });
      this.gate = null;

      this.enemies = [];
      d.enemies.forEach((e, i) => {
        if (!this.cleared.has(i)) this.enemies.push(new DH.Enemy(e.x, e.y, i, e.kind));
      });

      this.pickups = [];
      d.pickups.forEach((p, i) => {
        if (!this.collected.has(i)) this.pickups.push(new DH.Pickup(p.x, p.y, p.kind, i));
      });

      this.checkpoints = d.checkpoints.map((c, i) => new DH.Checkpoint(c.x, c.y, i, c.label));
      for (let i = 0; i <= this.checkpointIndex; i++) this.checkpoints[i].active = true;

      this.bullets = [];
      this.boss = null;
      this.bossActive = false;
      this.clearedPending.clear();
      this.companion = null;

      this.palette = DH.paletteFor(d.scene);
      this.cam.setBounds(0, d.width, -420, d.height + 220);
    }

    spawnPoint() {
      const cp = this.data.checkpoints[this.checkpointIndex];
      if (!cp) return { x: this.data.spawn.x, y: this.data.spawn.y };
      return { x: cp.x - 6, y: cp.y - 8 };
    }

    /* Fresh start, or resume from a stored checkpoint index. */
    start(hero, restore) {
      if (restore) {
        this.checkpointIndex = restore.checkpoint;
        (restore.cleared || []).forEach((i) => this.cleared.add(i));
        (restore.collected || []).forEach((i) => this.collected.add(i));
      }
      this.build();
      const p = this.spawnPoint();
      this.player = new DH.Player(p.x, p.y, hero);
      if (this.game.state.companionRescued) {
        this.companion = new DH.Companion(p.x - 40, p.y - 20);
      }
      this.fx.clear();
      this.cam.snapTo(this.player);
    }

    /* Death → rebuild at the last checkpoint. Diamonds are untouched. */
    restartFromCheckpoint() {
      this.bossDefeated = false;
      this.completeTimer = 0;
      this.build();
      const p = this.spawnPoint();
      this.player.respawn(p.x, p.y);
      if (this.companion) this.companion = new DH.Companion(p.x - 40, p.y - 20);
      this.fx.clear();
      this.game.ui.hideBoss();
      this.game.ui.setHealth(this.player.health, this.player.maxHealth);
      this.cam.snapTo(this.player);
    }

    /* ---------------------------------------------------- simulation */

    update(dt) {
      const player = this.player;
      const cam = this.cam;

      player.update(dt, this);
      if (this.companion) this.companion.update(dt, this);

      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (cam.sees(e, 700)) e.update(dt, this);
      }

      if (this.boss) this.boss.update(dt, this);

      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];
        b.update(dt, this);
        if (!b.dead) this._resolveBullet(b);
      }

      for (let i = 0; i < this.pickups.length; i++) this.pickups[i].update(dt, this);
      for (let i = 0; i < this.checkpoints.length; i++) {
        const c = this.checkpoints[i];
        c.update(dt);
        if (!c.active && !player.dead && U.overlaps(c.trigger, player)) this._reachCheckpoint(c);
      }

      this._maybeStartBoss();

      if (this.completeTimer > 0) {
        this.completeTimer -= dt;
        if (this.completeTimer <= 0) this.game.completeLevel();
      }

      this.bullets = this.bullets.filter((b) => !b.dead);
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.pickups = this.pickups.filter((p) => !p.dead);
      if (this.boss && this.boss.dead) this.boss = null;

      cam.follow(player, dt);

      this.game.ui.setAbility(player);
      if (this.bossActive && this.boss) {
        this.game.ui.setBossHealth(this.boss.health / this.boss.maxHealth);
      }
    }

    _resolveBullet(b) {
      if (b.owner === 'player') {
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (e.dead || !DH.Utils.overlaps(b, e)) continue;
          e.hurt(b.damage, b.cx, this);
          b.burst(this);
          return;
        }
        if (this.boss && !this.boss.dead && DH.Utils.overlaps(b, this.boss)) {
          this.boss.hurt(b.damage, b.cx, this);
          b.burst(this);
        }
      } else {
        const p = this.player;
        if (!p.dead && DH.Utils.overlaps(b, p)) {
          p.hurt(b.damage, b.cx, this);
          b.burst(this);
        }
      }
    }

    _reachCheckpoint(c) {
      if (!c.activate(this)) return;
      this.checkpointIndex = Math.max(this.checkpointIndex, c.index);
      this.clearedPending.forEach((id) => this.cleared.add(id));
      this.clearedPending.clear();
      this.cam.shake(4, 0.18);
      this.game.ui.toast(c.label);
      this.game.saveProgress();
    }

    _maybeStartBoss() {
      const d = this.data;
      if (this.bossActive || this.bossDefeated) return;
      if (this.player.cx < d.bossTrigger) return;

      this.bossActive = true;
      this.gate = { x: d.gate.x, y: d.gate.y, w: d.gate.w, h: d.gate.h };
      this.solids.push(this.gate);
      this.boss = new DH.Boss(d.boss, d.arena);
      this.cam.setBounds(d.arena.x, d.arena.x + d.arena.w, -420, d.height + 220);
      this.cam.shake(13, 0.6);
      this.game.ui.showBoss(d.boss.name);
      this.fx.burst(this.boss.cx, this.boss.cy, 26, {
        speed: 300, life: 0.8, size: 5, color: '#ff5d9e', gravity: 200
      });
    }

    onBossDefeated() {
      this.bossDefeated = true;
      this.bossActive = false;
      this.completeTimer = 2.0;
      this.player.control = false;
      this.game.timeScale = 0.35;
      this.game.ui.hideBoss();
      this.clearedPending.forEach((id) => this.cleared.add(id));
      this.clearedPending.clear();
    }

    /* ---------------------------------------------------- rendering */

    draw(ctx) {
      const cam = this.cam;

      ctx.save();
      cam.apply(ctx);

      this._drawPlatforms(ctx);
      if (this.gate) this._drawGate(ctx);

      for (let i = 0; i < this.checkpoints.length; i++) {
        const c = this.checkpoints[i];
        if (cam.sees(c, 120)) c.draw(ctx);
      }
      for (let i = 0; i < this.pickups.length; i++) {
        const p = this.pickups[i];
        if (cam.sees(p, 90)) p.draw(ctx);
      }
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (cam.sees(e, 90)) e.draw(ctx);
      }
      if (this.boss) this.boss.draw(ctx);
      if (this.companion) this.companion.draw(ctx);
      this.player.draw(ctx);
      for (let i = 0; i < this.bullets.length; i++) this.bullets[i].draw(ctx);

      this.fx.draw(ctx);
      ctx.restore();
    }

    _drawPlatforms(ctx) {
      const cam = this.cam;
      const P = this.palette || DH.PALETTES.default;

      for (let i = 0; i < this.solids.length; i++) {
        const s = this.solids[i];
        if (s === this.gate) continue;
        if (s.x < 0 || s.x >= this.data.width) continue;   // boundary walls
        if (!cam.sees(s, 80)) continue;

        if (s.oneWay) {
          ctx.fillStyle = P.ledge;
          U.roundRect(ctx, s.x, s.y, s.w, s.h, 5);
          ctx.fill();
          ctx.fillStyle = P.ledgeTop;
          ctx.fillRect(s.x + 3, s.y, s.w - 6, 3);
          ctx.fillStyle = 'rgba(6,10,23,.45)';
          ctx.fillRect(s.x + 6, s.y + s.h, s.w - 12, 4);
        } else {
          const grd = ctx.createLinearGradient(0, s.y, 0, s.y + Math.min(s.h, 200));
          grd.addColorStop(0, P.rockTop);
          grd.addColorStop(1, P.rockBottom);
          ctx.fillStyle = grd;
          ctx.fillRect(s.x, s.y, s.w, s.h);

          ctx.fillStyle = P.edge;
          ctx.fillRect(s.x, s.y, s.w, 4);

          this._drawMasonry(ctx, s);
        }

        this._drawSurfaceDetail(ctx, s, P);
      }
    }

    /* Block courses across a solid face. Without these the ground is one flat
       fill, which reads as a placeholder next to the painted scenery behind
       it. Joints are seeded from world position so they never crawl with the
       camera, and every course is offset like real masonry. */
    _drawMasonry(ctx, s) {
      const COURSE = 26;
      const y0 = s.y + 4;
      const y1 = s.y + Math.min(s.h, 210);

      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x, y0, s.w, y1 - y0);
      ctx.clip();

      ctx.lineWidth = 1;
      for (let row = 0, y = y0; y < y1; row++, y += COURSE) {
        ctx.strokeStyle = 'rgba(0,0,0,.20)';
        ctx.beginPath();
        ctx.moveTo(s.x, y + 0.5);
        ctx.lineTo(s.x + s.w, y + 0.5);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.beginPath();
        ctx.moveTo(s.x, y + 1.5);
        ctx.lineTo(s.x + s.w, y + 1.5);
        ctx.stroke();

        /* Vertical joints, staggered by row and jittered per block. */
        const width = 46 + U.hash(row * 3.1) * 22;
        const shift = (row % 2) * width * 0.5;
        const first = Math.floor((s.x - shift) / width);
        const last = Math.ceil((s.x + s.w - shift) / width);
        ctx.strokeStyle = 'rgba(0,0,0,.17)';
        for (let k = first; k <= last; k++) {
          const jx = k * width + shift + U.hash(k + row * 7.7) * 6;
          if (jx <= s.x || jx >= s.x + s.w) continue;
          ctx.beginPath();
          ctx.moveTo(jx + 0.5, y);
          ctx.lineTo(jx + 0.5, Math.min(y + COURSE, y1));
          ctx.stroke();
        }
      }

      /* Let the base fall into shadow so the ground reads as depth, not a wall. */
      if (s.h > 60) {
        const fade = ctx.createLinearGradient(0, y1 - 90, 0, s.y + s.h);
        fade.addColorStop(0, 'rgba(0,0,0,0)');
        fade.addColorStop(1, 'rgba(0,0,0,.5)');
        ctx.fillStyle = fade;
        ctx.fillRect(s.x, y1 - 90, s.w, s.h);
      }
      ctx.restore();
    }

    /* Scatter along the top of a platform. Seeded from world position, so a
       given tuft is always in the same place and nothing flickers as the
       camera moves. */
    _drawSurfaceDetail(ctx, s, P) {
      if (P.detail === 'none') return;

      ctx.fillStyle = P.detailColor;
      const step = s.oneWay ? 34 : 56;
      const from = Math.floor(s.x / step);
      const to = Math.ceil((s.x + s.w) / step);

      for (let k = from; k < to; k++) {
        const seed = U.hash(k);
        if (seed < 0.45) continue;
        const x = k * step + seed * 20;
        if (x < s.x + 8 || x > s.x + s.w - 20) continue;
        const top = s.y + (s.oneWay ? 1 : 4);
        const h = (s.oneWay ? 5 : 8) + seed * (s.oneWay ? 8 : 16);

        if (P.detail === 'tuft') {
          /* Three blades leaning off the same root. */
          const seed2 = U.hash(k + 41.7);
          for (let b = -1; b <= 1; b++) {
            ctx.beginPath();
            ctx.moveTo(x + b * 3, top);
            ctx.quadraticCurveTo(x + b * 5, top - h * 0.6,
                                 x + b * 4 + (seed2 - 0.5) * 8, top - h);
            ctx.lineTo(x + b * 3 + 2, top);
            ctx.closePath();
            ctx.fill();
          }
        } else if (P.detail === 'ember') {
          const r = 1.4 + seed * 2.2;
          ctx.save();
          ctx.shadowColor = P.detailColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x, top - 2 - seed * 5, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x + 6, top - h);
          ctx.lineTo(x + 12, top);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    _drawGate(ctx) {
      const g = this.gate;
      ctx.save();
      ctx.fillStyle = '#161f42';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.shadowColor = '#ff5d9e';
      ctx.shadowBlur = 22;
      ctx.fillStyle = 'rgba(255,93,158,.7)';
      ctx.fillRect(g.x + 8, g.y, g.w - 16, g.h);
      ctx.restore();
    }
  }

  DH.Level = Level;
})(window.DH);
