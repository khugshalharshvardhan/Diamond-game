/* UIManager — every pixel of interface that is not gameplay.
   Menus and the HUD are real DOM, not canvas text: they stay crisp at any
   resolution, they are keyboard accessible for free, and restyling them never
   touches game code. The manager reads from Game and never writes to it
   directly; it only calls the handful of intent methods below. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  /* Card portrait box, in CSS pixels. The hero is ~52px tall at build 1.0, so
     the scale lifts it to fill the box without cropping the Tank's shoulders. */
  const PORTRAIT_W = 116;
  const PORTRAIT_H = 128;
  const PORTRAIT_SCALE = 1.60;

  /* Stat label -> key in DH.ART.ui. Icons are decorative: every row still
     prints its name and its number, so nothing depends on the picture. */
  const STAT_ICON = {
    Health: 'statHealth',
    Damage: 'statDamage',
    Speed: 'statSpeed',
    'Fire rate': 'statFireRate'
  };

  class UIManager {
    constructor(game) {
      this.game = game;
      this.el = {
        hud: $('#hud'),
        crest: $('#hud-crest'),
        initial: $('#hud-initial'),
        name: $('#hud-name'),
        hp: $('#hud-hp'),
        hpGhost: $('#hud-hp-ghost'),
        purse: $('.purse'),
        diamonds: $('#hud-diamonds'),
        gem: $('#hud-gem'),
        bossBar: $('#boss-bar'),
        bossName: $('#boss-name'),
        bossFill: $('#boss-fill'),
        toast: $('#toast'),
        hint: $('#hint'),
        roster: $('#roster'),
        deploy: $('#btn-deploy'),
        continue: $('#btn-continue'),
        saveLine: $('#save-line'),
        coverArt: $('#cover-art'),
        coverUI: $('#cover-ui'),
        fullscreen: $('#btn-fullscreen'),
        mapArt: $('#map-art'),
        mapNodes: $('#map-nodes'),
        mapPath: $('#map-path'),
        mapDiamonds: $('#map-diamonds'),
        mapLegend: $('#map-legend'),
        deadNote: $('#dead-note'),
        tally: $('#tally'),
        ability: $('#ability'),
        abilityName: $('#ability-name'),
        abilityFill: $('#ability-fill'),
        abilityState: $('#ability-state')
      };
      this.screens = {
        menu: $('#screen-menu'),
        select: $('#screen-select'),
        map: $('#screen-map'),
        pause: $('#screen-pause'),
        dead: $('#screen-dead'),
        complete: $('#screen-complete')
      };
      this.picked = null;
      this._bossPct = -1;
      this._abilityKey = '';
      this._portraitRAF = 0;
      this._applyIcons();
      this._buildRoster();
      this._bind();
    }

    /* Interface artwork comes from the manifest, never from hard-coded paths.
       A missing file leaves the element empty rather than showing a broken
       image, and the text beside it still carries the meaning. */
    _applyIcons() {
      const gem = this.el.gem;
      if (gem && DH.ART && DH.ART.ui.diamond) {
        gem.onerror = function () { gem.style.display = 'none'; };
        gem.src = DH.ART.url(DH.ART.ui.diamond);
      }
      this._applyCover();
      this._applyMapArt();
    }

    /* The cover plate only takes over once the image has actually decoded.
       Until then — and for good if the file is missing — the text title block
       stays on screen, so the menu is never blank and never half-dressed. */
    _applyCover() {
      const img = this.el.coverArt;
      const src = DH.ART && DH.ART.scene('cover');
      if (!img || !src) return;
      const menu = this.screens.menu;
      const ui = this.el.coverUI;
      img.onload = function () {
        if (!img.naturalWidth) return;
        menu.classList.add('cover');
        ui.hidden = false;
      };
      img.onerror = function () { img.remove(); };
      img.src = DH.Assets.resolve(src);
    }

    /* ------------------------------------------------ screens */

    show(name) {
      Object.keys(this.screens).forEach((k) => this.screens[k].classList.toggle('on', k === name));
      if (name === 'menu') this.refreshSaveLine();
      if (name === 'select') { this._focusFirstHero(); this._animatePortraits(); }
    }

    hideAll() {
      Object.keys(this.screens).forEach((k) => this.screens[k].classList.remove('on'));
    }

    setHudVisible(on) {
      this.el.hud.classList.toggle('hidden', !on);
    }

    /* ------------------------------------------------ ability meter */

    setAbilityHero(hero) {
      this.el.abilityName.textContent = hero.power.name;
      this.el.ability.style.setProperty('--accent', hero.accent);
      this.el.ability.classList.remove('hidden');
      this._abilityKey = '';
    }

    /* Called every fixed step, so like the boss bar it only writes on a change.
       State is spelled out in words as well as shown by the bar: a player who
       cannot separate the ready and cooling colours still gets the answer. */
    setAbility(player) {
      let fill, label, mode;
      if (player.powerTimer > 0) {
        fill = player.powerTimer / player.power.duration;
        label = 'Active';
        mode = 'active';
      } else if (player.powerCool > 0) {
        fill = 1 - (player.powerCool / player.power.cooldown);
        label = Math.ceil(player.powerCool) + 's';
        mode = 'cooling';
      } else {
        fill = 1;
        label = 'Ready';
        mode = 'ready';
      }

      const key = mode + '|' + label + '|' + Math.round(fill * 60);
      if (key === this._abilityKey) return;
      this._abilityKey = key;

      this.el.abilityFill.style.width = Math.max(0, Math.min(1, fill)) * 100 + '%';
      this.el.abilityState.textContent = label;
      this.el.ability.dataset.mode = mode;
    }

    refreshSaveLine() {
      const s = DH.SaveManager.exists() ? DH.SaveManager.load() : null;
      /* A save naming a hero this build no longer ships cannot be resumed, so
         it has to read as "no run" rather than throw here and take the whole
         title screen down with it. */
      const hero = s && DH.HEROES[s.hero];

      /* The text menu and the cover plate each have their own Continue button
         and save line. Both are driven from here so they can never disagree
         about whether there is a run to resume. */
      const buttons = document.querySelectorAll('[data-act="continue"]');
      for (let i = 0; i < buttons.length; i++) buttons[i].disabled = !hero;

      const lines = [this.el.saveLine, document.getElementById('save-line-cover')];
      const text = !hero
        ? (DH.SaveManager.available
            ? 'No run in progress'
            : 'Saving is unavailable in this browser, so progress lasts for this session only')
        : hero.name + ' · ' + s.diamonds + ' diamonds · resuming at ' +
          (s.checkpoint >= 0 ? 'checkpoint ' + (s.checkpoint + 1) : 'the entrance');
      for (let i = 0; i < lines.length; i++) if (lines[i]) lines[i].textContent = text;
    }

    /* ------------------------------------------------ HUD */

    setHero(hero) {
      this.el.name.textContent = hero.name;
      this.el.initial.textContent = hero.name[0];
      this.el.crest.style.background = 'linear-gradient(150deg,' + hero.accent + ',' + hero.shade + ')';
      this.el.hp.style.background = 'linear-gradient(90deg,' + hero.shade + ',' + hero.accent + ')';
    }

    setHealth(current, max) {
      const pct = Math.max(0, current / max) * 100 + '%';
      this.el.hp.style.width = pct;
      this.el.hpGhost.style.width = pct;
    }

    setDiamonds(n, bump) {
      this.el.diamonds.textContent = n;
      if (!bump) return;
      this.el.purse.classList.remove('bump');
      void this.el.purse.offsetWidth;
      this.el.purse.classList.add('bump');
    }

    showBoss(name) {
      this.el.bossName.textContent = name;
      this.el.bossFill.style.width = '100%';
      this._bossPct = 1;
      this.el.bossBar.classList.remove('hidden');
      this.el.hint.classList.add('gone');
    }

    /* Level calls this every fixed step. Writing an unchanged width 60 times a
       second forces needless style recalculation, so only write on a change. */
    setBossHealth(fraction) {
      const pct = Math.max(0, fraction);
      if (pct === this._bossPct) return;
      this._bossPct = pct;
      this.el.bossFill.style.width = pct * 100 + '%';
    }

    hideBoss() {
      this._bossPct = -1;
      this.el.bossBar.classList.add('hidden');
    }

    toast(message) {
      const t = this.el.toast;
      t.textContent = message;
      t.classList.remove('hidden');
      t.style.animation = 'none';
      void t.offsetWidth;
      t.style.animation = '';
    }

    fadeHint() {
      this.el.hint.classList.add('gone');
    }

    showTally(rows) {
      this.el.tally.innerHTML = rows
        .map((r) => '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>')
        .join('');
    }

    setDeathNote(text) {
      this.el.deadNote.textContent = text;
    }

    /* Fullscreen. Kept in UIManager because it is presentation, not gameplay,
       and because the browser only grants it from a real user gesture. */
    _bindFullscreen() {
      const btn = this.el.fullscreen;
      if (!btn) return;

      const supported = !!(document.documentElement.requestFullscreen ||
                           document.documentElement.webkitRequestFullscreen);
      if (!supported) { btn.remove(); return; }

      const toggle = () => {
        const on = document.fullscreenElement || document.webkitFullscreenElement;
        try {
          if (on) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          else {
            const el = document.documentElement;
            (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
          }
        } catch (err) { /* denied by the browser; the game is unaffected */ }
      };

      btn.addEventListener('click', toggle);

      const sync = () => {
        const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
        btn.dataset.on = String(on);
        btn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
        btn.title = (on ? 'Exit fullscreen' : 'Fullscreen') + ' (F)';
      };
      document.addEventListener('fullscreenchange', sync);
      document.addEventListener('webkitfullscreenchange', sync);
      sync();

      /* F toggles, but never while a text field has focus and never as a
         second action when a button already has it. */
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        toggle();
      });
    }

    /* ------------------------------------------------ world map */

    _applyMapArt() {
      const img = this.el.mapArt;
      if (!img || !DH.ART) return;
      const src = DH.ART.scene('skyward');
      if (!src) return;
      img.onerror = function () { img.style.display = 'none'; };
      img.src = DH.Assets.resolve(src);
    }

    /* Rebuilt every time the map opens, straight from DH.LEVELS and the save,
       so it can never claim a level is open that the save does not have, or
       offer a level that has no data behind it. */
    refreshMap() {
      const save = DH.SaveManager.load();
      const unlocked = {};
      (save.unlockedLevels || [1]).forEach((n) => { unlocked[n] = true; });
      const current = save.hero ? save.level : 1;

      this.el.mapDiamonds.textContent = save.diamonds;

      let built = 0;
      this.el.mapNodes.innerHTML = DH.LEVELS.map((L) => {
        const isOpen = !!unlocked[L.id];
        const playable = isOpen && !!L.data;
        if (L.data) built++;

        /* Four distinct states. Each gets its own WORD as well as its own
           colour, because the map is exactly the kind of screen where
           colour-only status fails people. */
        let state, badge;
        if (!isOpen) { state = 'locked'; badge = 'Locked'; }
        else if (!L.data) { state = 'soon'; badge = 'Coming soon'; }
        else if (L.id === current && save.hero) { state = 'current'; badge = 'Current'; }
        else { state = 'open'; badge = 'Ready'; }

        return '' +
          '<button class="map-node" type="button" data-level="' + L.id + '"' +
            ' data-state="' + state + '"' + (playable ? '' : ' disabled') +
            ' style="left:' + (L.map.x * 100) + '%;top:' + (L.map.y * 100) + '%"' +
            ' aria-label="Level ' + L.id + ', ' + L.name + ', ' + badge + '">' +
            '<span class="map-disc" aria-hidden="true">' +
              (state === 'locked' ? '<span class="map-lock"></span>' : (L.boss ? '★' : L.id)) +
            '</span>' +
            '<span class="map-card">' +
              '<span class="map-name">' + L.name + '</span>' +
              '<span class="map-badge">' + badge + '</span>' +
            '</span>' +
          '</button>';
      }).join('');

      this._drawMapPath(unlocked);
      this.el.mapLegend.textContent =
        built + ' of ' + DH.LEVELS.length + ' levels built. Locked and coming-soon levels cannot be started.';
    }

    /* The route. Segments up to the last unlocked level draw solid; the rest
       dashed, so "where am I and what is next" reads at a glance. */
    _drawMapPath(unlocked) {
      const svg = this.el.mapPath;
      let out = '';
      for (let i = 0; i < DH.LEVELS.length - 1; i++) {
        const a = DH.LEVELS[i].map;
        const b = DH.LEVELS[i + 1].map;
        const reached = unlocked[DH.LEVELS[i + 1].id];
        out += '<line x1="' + (a.x * 100) + '" y1="' + (a.y * 100) + '"' +
                    ' x2="' + (b.x * 100) + '" y2="' + (b.y * 100) + '"' +
                    ' class="map-link' + (reached ? ' on' : '') + '"/>';
      }
      svg.innerHTML = out;
    }

    /* ------------------------------------------------ hero select */

    _buildRoster() {
      this.el.roster.innerHTML = DH.HERO_ORDER.map((id) => {
        const h = DH.HEROES[id];

        /* Every stat prints its number as well as its bar. A bar alone would
           put the comparison entirely in a visual channel, which fails anyone
           reading at low vision or in high-contrast mode. */
        const stats = Object.keys(h.bars).map((label) => {
          const pct = Math.round(h.bars[label] * 100);
          const icon = STAT_ICON[label];
          const img = icon
            ? '<img class="stat-icon" src="' + DH.ART.url(DH.ART.ui[icon]) + '" alt="">'
            : '<span class="stat-icon"></span>';
          return '' +
            '<div class="stat">' +
              img +
              '<span class="stat-name">' + label + '</span>' +
              '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
              '<span class="stat-val">' + h.readout[label] + '</span>' +
            '</div>';
        }).join('');

        return '' +
          '<button class="hero-card" type="button" data-hero="' + h.id + '" aria-pressed="false" ' +
          'style="--accent:' + h.accent + ';--shade:' + h.shade + '">' +
            '<span class="hero-portrait"><canvas data-portrait="' + h.id + '"></canvas></span>' +
            '<h3>' + h.name + '</h3>' +
            '<p class="hero-role">' + h.role + '</p>' +
            '<div class="stats">' + stats + '</div>' +
            '<div class="hero-power">' +
              '<span class="power-label">Ability</span>' +
              '<span class="power-name">' + h.power.name + '</span>' +
              '<span class="power-blurb">' + h.power.blurb + '</span>' +
            '</div>' +
            '<span class="hero-pick">Select</span>' +
          '</button>';
      }).join('');

      /* Portraits are the same procedural renderer the gameplay uses, so the
         hero on the card and the hero you control cannot drift apart. */
      this._portraits = DH.HERO_ORDER.map((id) => {
        const canvas = this.el.roster.querySelector('[data-portrait="' + id + '"]');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = PORTRAIT_W * dpr;
        canvas.height = PORTRAIT_H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { hero: DH.HEROES[id], ctx };
      });
      this._drawPortraits(0);
    }

    _drawPortraits(t) {
      for (let i = 0; i < this._portraits.length; i++) {
        const p = this._portraits[i];
        const ctx = p.ctx;
        ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);

        ctx.save();
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(PORTRAIT_W / 2, PORTRAIT_H - 12, 24, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(PORTRAIT_W / 2, PORTRAIT_H - 12);
        ctx.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
        DH.HeroArt.draw(ctx, p.hero, { pose: 'idle', runT: 0, vx: 0, muzzle: 0, t: t + i });
        ctx.restore();
      }
    }

    /* Runs only while the select screen is up, and stops itself the moment it
       is not — an idle menu must not hold a frame loop open. */
    _animatePortraits() {
      if (this._portraitRAF) return;
      const tick = () => {
        if (!this.screens.select.classList.contains('on')) { this._portraitRAF = 0; return; }
        this._drawPortraits(performance.now() / 1000);
        this._portraitRAF = requestAnimationFrame(tick);
      };
      this._portraitRAF = requestAnimationFrame(tick);
    }

    _focusFirstHero() {
      const first = this.el.roster.querySelector('.hero-card');
      if (first) first.focus();
    }

    pickHero(id) {
      this.picked = id;
      this.el.roster.querySelectorAll('.hero-card').forEach((card) => {
        card.setAttribute('aria-pressed', String(card.dataset.hero === id));
      });
      this.el.deploy.disabled = false;
    }

    /* ------------------------------------------------ wiring */

    _bind() {
      const g = this.game;

      this.el.roster.addEventListener('click', (e) => {
        const card = e.target.closest('.hero-card');
        if (card) this.pickHero(card.dataset.hero);
      });

      this.el.mapNodes.addEventListener('click', (e) => {
        const node = e.target.closest('.map-node');
        if (node && !node.disabled) g.chooseLevel(Number(node.dataset.level));
      });

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        switch (btn.dataset.act) {
          /* Flow spec: PLAY checks the save — an existing run goes to the
             world map to pick a level, a fresh one goes to hero select. */
          case 'new':      DH.SaveManager.exists() ? g.openMap() : g.openSelect(); break;
          case 'characters': g.openSelect(); break;
          case 'map':     g.openMap(); break;
          case 'continue': g.continueRun(); break;
          case 'back':     g.openMenu(); break;
          case 'deploy':   if (this.picked) g.deploy(this.picked); break;
          case 'resume':   g.resume(); break;
          case 'restart':  g.restartFromCheckpoint(); break;
          case 'respawn':  g.restartFromCheckpoint(); break;
          case 'quit':     g.quitToMenu(); break;
        }
      });

      this._bindFullscreen();

      // Number keys on the select screen; the roster is a real toolbar, so
      // Tab and Enter already work without extra handling.
      window.addEventListener('keydown', (e) => {
        if (!this.screens.select.classList.contains('on')) return;
        const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (index >= 0) this.pickHero(DH.HERO_ORDER[index]);
        if (e.code === 'Enter' && this.picked) this.game.deploy(this.picked);
      });
    }
  }

  DH.UIManager = UIManager;
})(window.DH);
