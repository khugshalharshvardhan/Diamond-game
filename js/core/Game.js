/* Game — owns the loop, the run state, and the transitions between screens.
   Fixed timestep with an accumulator: physics always sees exactly 1/60s, so
   jump arcs are identical on a 60Hz laptop and a 240Hz monitor. Rendering runs
   once per animation frame regardless. `timeScale` is a single multiplier and
   is currently used for the slow-motion beat when the boss dies. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const VW = 960;
  const VH = 540;
  const STEP = 1 / 60;
  const MAX_FRAME = 0.25;   // a backgrounded tab must not fast-forward the world

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = 1;

      this.input = new DH.Input();
      this.camera = new DH.Camera(VW, VH);
      this.particles = new DH.Particles(480);
      /* Audio first: UIManager's settings toggles read DH.Audio.settings as
         they are built, so the settings have to exist before it runs. */
      DH.Audio.init();
      this.ui = new DH.UIManager(this);

      this.mode = 'menu';
      this.level = null;
      this.timeScale = 1;
      this.accumulator = 0;
      this.clock = 0;
      this.playTime = 0;
      this.deathTimer = 0;
      this.runDiamonds = 0;
      this.pendingLevel = 1;

      this.state = {
        hero: null, diamonds: 100, upgrades: {}, level: 1, checkpoint: -1,
        cleared: [], collected: [], companionRescued: false, ammo: 0
      };

      this._resize();
      window.addEventListener('resize', () => this._resize());
    }

    start() {
      this.openMenu();
      this.last = performance.now();
      const tick = (now) => {
        const frame = Math.min((now - this.last) / 1000, MAX_FRAME);
        this.last = now;
        this.clock += frame;
        this.accumulator += frame;

        while (this.accumulator >= STEP) {
          this.update(STEP);
          this.accumulator -= STEP;
        }
        this.render();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    /* ---------------------------------------------------- flow */

    openMenu() {
      this.mode = 'menu';
      DH.Audio.music('menu');
      this.level = null;
      this.timeScale = 1;
      this.particles.clear();
      this.ui.setHudVisible(false);
      this.ui.hideBoss();
      this.ui.show('menu');
      this.input.release();
    }

    openSelect() {
      this.mode = 'select';
      this.ui.show('select');
    }

    /* Pick a level from the world map. Refuses levels that are not built yet
       rather than pretending — DH.LEVELS carries `data: null` for those. */
    chooseLevel(id) {
      const entry = DH.levelById(id);
      if (!entry || !entry.data) return false;
      this.pendingLevel = id;
      this.openSelect();
      return true;
    }

    /* Diamonds and upgrades live in the save, but `state` is only filled when
       a run starts. Opening the shop straight off a page load would otherwise
       show the constructor's placeholder 100 rather than what was earned. */
    _syncWallet() {
      if (this.level) return;
      const s = DH.SaveManager.load();
      if (!s.updatedAt) return;
      this.state.diamonds = s.diamonds;
      this.state.upgrades = s.upgrades || {};
    }

    openShop() {
      this._syncWallet();
      this.mode = 'shop';
      this.ui.show('shop');
      this.ui.refreshShop();
    }

    openSettings() {
      this.mode = 'settings';
      this.ui.show('settings');
      this.ui.refreshSettings();
    }

    /* Spend on an upgrade. Returns why it failed so the UI can say so rather
       than just refusing. */
    buyUpgrade(key) {
      const next = DH.nextUpgrade(key, this.state.upgrades);
      if (!next) return 'maxed';
      if (this.state.diamonds < next.step.cost) return 'poor';

      this.state.diamonds -= next.step.cost;
      this.state.upgrades[key] = next.level;
      DH.SaveManager.save({
        diamonds: this.state.diamonds,
        upgrades: this.state.upgrades
      });
      this.ui.setDiamonds(this.state.diamonds, true);
      return 'ok';
    }

    openMap() {
      this.mode = 'map';
      this.ui.show('map');
      this.ui.refreshMap();
    }

    deploy(heroId) {
      const id = this.pendingLevel || 1;
      const entry = DH.levelById(id);
      if (!entry || !entry.data) return;

      /* Diamonds and upgrades are account-level, not run-level: they are what
         the shop spends and they must survive starting a new run. Only the
         in-level progress below is reset. Previously this wiped the save and
         forced 100 diamonds, which made buying anything pointless. */
      const prior = DH.SaveManager.load();
      /* "Never saved anything" is updatedAt, not hero: buying an upgrade before
         the first run writes a record with no hero, and testing hero there
         would refund the purchase. */
      const first = !prior.updatedAt;

      this.state = {
        hero: heroId,
        diamonds: first ? 100 : prior.diamonds,
        upgrades: prior.upgrades || {},
        level: id, checkpoint: -1,
        cleared: [], collected: [], companionRescued: false, ammo: 0
      };
      this._enterLevel(entry.data, null);
      this.saveProgress();
    }

    continueRun() {
      const s = DH.SaveManager.load();
      /* No hero, or one this build no longer ships: there is nothing to resume.
         UIManager disables the button for the same reason, but the guard has to
         live here too so the entry point is safe on its own. */
      if (!s.hero || !DH.HEROES[s.hero]) return;
      this.state = {
        hero: s.hero,
        diamonds: s.diamonds,
        level: s.level,
        checkpoint: s.checkpoint,
        upgrades: s.upgrades || {},
        cleared: s.clearedEnemies || [],
        collected: s.collectedPickups || [],
        companionRescued: s.companionRescued,
        ammo: (s.ammo && s.ammo.blaster) || 0
      };
      /* Resume the level that was saved. Falling back to level 1 would
         silently throw away progress the moment level 2 exists. */
      const entry = DH.levelById(s.level) || DH.levelById(1);
      if (!entry || !entry.data) return;
      this.pendingLevel = entry.id;
      this._enterLevel(entry.data, {
        checkpoint: s.checkpoint,
        cleared: s.clearedEnemies,
        collected: s.collectedPickups
      });
    }

    _enterLevel(data, restore) {
      const hero = DH.HEROES[this.state.hero];
      this.level = new DH.Level(data, this);
      this.level.start(hero, restore);

      this.runDiamonds = 0;
      this.timeScale = 1;
      this.playTime = 0;

      this.ui.hideAll();
      this.ui.setHudVisible(true);
      this.ui.setHero(hero);
      this.ui.setAbilityHero(hero);
      this.ui.setHealth(hero.maxHealth, hero.maxHealth);
      this.ui.setDiamonds(this.state.diamonds, false);
      this.ui.hideBoss();
      this.ui.toast(data.name);
      DH.Audio.music('level');
      DH.Audio.say('levelStart', data);

      this.mode = 'playing';
      this.input.release();
    }

    pause() {
      if (this.mode !== 'playing') return;
      this.mode = 'paused';
      this.ui.show('pause');
      this.input.release();
    }

    resume() {
      if (this.mode !== 'paused') return;
      this.mode = 'playing';
      this.ui.hideAll();
      this.input.release();
    }

    restartFromCheckpoint() {
      if (!this.level) return;
      DH.Audio.music('level');
      this.timeScale = 1;
      this.level.restartFromCheckpoint();
      this.ui.hideAll();
      this.ui.setHudVisible(true);
      this.mode = 'playing';
      this.input.release();
    }

    onPlayerDied() {
      this.mode = 'dying';
      this.deathTimer = 1.0;
      const cp = this.level.checkpointIndex;
      this.ui.setDeathNote(cp >= 0
        ? 'Your diamonds are safe. You restart at checkpoint ' + (cp + 1) + '.'
        : 'Your diamonds are safe. You restart at the entrance.');
    }

    completeLevel() {
      this.mode = 'complete';
      DH.Audio.play('levelComplete');
      DH.Audio.say('levelComplete');
      DH.Audio.music('menu');
      this.timeScale = 1;
      const reward = this.level.data.reward;
      this.addDiamonds(reward, false);

      this.state.checkpoint = -1;
      DH.SaveManager.save({
        hero: this.state.hero,
        diamonds: this.state.diamonds,
        level: this.state.level,
        checkpoint: -1,
        upgrades: this.state.upgrades,
        clearedEnemies: [],
        collectedPickups: [],
        unlockedLevels: this._unlockedAfter(this.state.level),
        completedLevels: this._completedWith(this.state.level),
        companionRescued: this.state.companionRescued,
        ammo: { blaster: this.state.ammo }
      });

      this.ui.showTally([
        ['Diamonds gathered', this.runDiamonds - reward],
        ['Clear bonus', reward],
        ['Carried forward', this.state.diamonds]
      ]);
      this.ui.setHudVisible(false);
      this.ui.show('complete');
      this.input.release();
    }

    /* Levels cleared, for the map's tick marks and star count. Additive: a
       replay can never un-clear something. */
    _completedWith(levelId) {
      const done = DH.SaveManager.load().completedLevels || [];
      return done.indexOf(levelId) >= 0 ? done : done.concat([levelId]).sort((a, b) => a - b);
    }

    /* Clearing level N unlocks N+1, and never revokes anything already open. */
    _unlockedAfter(levelId) {
      const saved = DH.SaveManager.load().unlockedLevels || [1];
      const set = {};
      saved.forEach((n) => { set[n] = true; });
      set[1] = true;
      set[levelId] = true;
      if (DH.levelById(levelId + 1)) set[levelId + 1] = true;
      return Object.keys(set).map(Number).sort((a, b) => a - b);
    }

    quitToMenu() {
      this.saveProgress();
      this.openMenu();
    }

    /* ---------------------------------------------------- run state */

    addDiamonds(n, bump) {
      this.state.diamonds += n;
      this.runDiamonds += n;
      this.ui.setDiamonds(this.state.diamonds, bump !== false);
    }

    addAmmo(n) {
      this.state.ammo += n;
    }

    saveProgress() {
      if (!this.level || !this.state.hero) return;
      // The completion save is authoritative; leaving the results screen must
      // not write the mid-level checkpoint back over it.
      if (this.mode === 'complete') return;
      DH.SaveManager.save({
        hero: this.state.hero,
        diamonds: this.state.diamonds,
        level: this.state.level,
        checkpoint: this.level.checkpointIndex,
        upgrades: this.state.upgrades,
        clearedEnemies: Array.from(this.level.cleared),
        collectedPickups: Array.from(this.level.collected),
        companionRescued: this.state.companionRescued,
        ammo: { blaster: this.state.ammo }
      });
    }

    /* ---------------------------------------------------- loop body */

    update(step) {
      if (this.input.pressed('pause')) {
        if (this.mode === 'playing') this.pause();
        else if (this.mode === 'paused') this.resume();
      }

      if (this.mode === 'playing' || this.mode === 'dying') {
        const dt = step * this.timeScale;
        this.level.update(dt);
        this.particles.update(dt);
        this.playTime += step;
        if (this.playTime > 7) this.ui.fadeHint();
      }

      if (this.mode === 'dying') {
        this.deathTimer -= step;
        if (this.deathTimer <= 0) {
          this.mode = 'dead';
          this.ui.show('dead');
        }
      }

      this.input.flush();
    }

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, VW, VH);

      if (this.level) {
        const d = this.level.data;
        /* Progress along the level drives the pan across the painted plate, so
           its full width is used regardless of how long the level is. */
        const progress = this.camera.x / Math.max(1, d.width - VW);
        DH.Background.draw(ctx, this.camera.x, this.camera.y, this.clock,
                           VW, VH, d.scene, progress, d.sceneDim);
        this.level.draw(ctx);
      } else {
        // Title and select screens get the same world, slowly drifting past.
        DH.Background.draw(ctx, this.clock * 26, 0, this.clock, VW, VH);
      }

      this._vignette(ctx);
    }

    _vignette(ctx) {
      const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(2,4,12,.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }

    _resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = VW * this.dpr;
      this.canvas.height = VH * this.dpr;
      this.ctx.imageSmoothingEnabled = true;
    }
  }

  DH.Game = Game;
})(window.DH);
