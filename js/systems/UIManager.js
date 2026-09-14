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
  const PORTRAIT_SCALE = 1.48;

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
        hp: $('#hud-hp'),
        hpGhost: $('#hud-hp-ghost'),
        hpText: $('#hud-hp-text'),
        ammo: $('#hud-ammo'),
        ammoText: $('#hud-ammo-text'),
        gaugeAmmo: $('#gauge-ammo'),
        levelTag: $('#level-tag'),
        touch: $('#touch'),
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
        mapStars: $('#map-stars'),
        mapStarsWrap: $('#map-stars-wrap'),
        shopList: $('#shop-list'),
        shopDiamonds: $('#shop-diamonds'),
        shopFlash: $('#shop-flash'),
        settingsToggles: $('#settings-toggles'),
        settingsNote: $('#settings-note'),
        deadNote: $('#dead-note'),
        tally: $('#tally'),
        toggles: $('#toggles'),
        audioNote: $('#audio-note'),
        ability: $('#ability'),
        abilityName: $('#ability-name'),
        abilityFill: $('#ability-fill'),
        abilityState: $('#ability-state')
      };
      this.screens = {
        menu: $('#screen-menu'),
        select: $('#screen-select'),
        map: $('#screen-map'),
        shop: $('#screen-shop'),
        settings: $('#screen-settings'),
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
      this._enter(this.screens[name]);
      if (name === 'select') this._stagger('#roster .hero-card', 0.055);
    }

    /* ---- transitions.

       GSAP is used where it is present and skipped entirely where it is not:
       the game must never depend on a vendored library being there. Only the
       INCOMING screen animates — animating the outgoing one would make every
       state change async and open races between, say, pause and resume.

       Anyone who has asked their system for less motion gets none. */

    _motionOK() {
      if (!window.gsap) return false;
      return !(window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    _enter(el) {
      if (!el || !this._motionOK()) return;
      window.gsap.fromTo(el,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.26, ease: 'power2.out', overwrite: true, clearProps: 'opacity,transform' });
    }

    _stagger(selector, step) {
      if (!this._motionOK()) return;
      const items = document.querySelectorAll(selector);
      if (!items.length) return;
      window.gsap.fromTo(items,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out',
          stagger: step, overwrite: true, clearProps: 'opacity,transform' });
    }

    /* Targets the inner disc, never .map-node itself: the node is centred with
       translate(-50%,-50%) and a scale tween on it would fight that transform
       and make the nodes jump off their islands. */
    _pop(selector, step) {
      if (!this._motionOK()) return;
      const items = document.querySelectorAll(selector);
      if (!items.length) return;
      window.gsap.fromTo(items,
        { opacity: 0, scale: 0.55 },
        { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2)',
          stagger: step, overwrite: true, clearProps: 'opacity,transform' });
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

    setHealth(current, max) {
      const pct = Math.max(0, current / max) * 100 + '%';
      this.el.hp.style.width = pct;
      this.el.hpGhost.style.width = pct;
      this.el.hpText.textContent = Math.max(0, Math.round(current)) + '/' + Math.round(max);
    }

    setAmmo(current, max) {
      this.el.ammo.style.width = Math.max(0, current / max) * 100 + '%';
      this.el.ammoText.textContent = current + '/' + max;
      this.el.gaugeAmmo.dataset.empty = current <= 0 ? 'true' : 'false';
    }

    /* Firing on empty: draw the eye to the gauge that explains why. */
    flashAmmo() {
      const g = this.el.gaugeAmmo;
      g.classList.remove('shake');
      void g.offsetWidth;
      g.classList.add('shake');
    }

    setLevelName(name) {
      const entry = DH.levelById(this.game.state.level);
      this.el.levelTag.textContent =
        'Level ' + (entry ? entry.id : 1) + ' — ' + name;
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

    /* Toggles. The same markup appears in the pause menu and on the Settings
       screen, so one delegated handler serves both and they can never show
       different states. Every write goes through DH.Audio.set, which persists
       via SaveManager — nothing here touches localStorage. */
    _bindToggles() {
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle');
        if (!btn) return;
        const key = btn.dataset.toggle;
        const on = DH.Audio.toggle(key);
        /* The click sound is the confirmation, so it is suppressed when the
           thing that would have made it is what just went off. */
        if (on) DH.Audio.play('uiClick');
        this._applySideEffects(key);
        this.refreshToggles();
      });

      this._applySideEffects('highContrast');
      this.refreshToggles();
    }

    /* Settings that change something outside the audio graph. */
    _applySideEffects(key) {
      if (key !== 'highContrast') return;
      document.body.classList.toggle('high-contrast', !!DH.Audio.settings.highContrast);
    }

    refreshToggles() {
      this._paintToggles(this.el.toggles);
      this._paintToggles(this.el.settingsToggles);

      const note = this.el.audioNote;
      if (!note) return;
      const r = DH.Audio.report();
      if (!r.webAudio) note.textContent = 'This browser has no Web Audio support, so the game is silent.';
      else if (!r.speech) note.textContent = 'This browser has no speech synthesiser, so Voice does nothing.';
      else if (!r.voicesInstalled) note.textContent = 'No speech voices are installed, so Voice does nothing.';
      else note.textContent = '';
    }

    /* State is carried by the word On/Off as well as aria-pressed, so it never
       depends on seeing a colour. */
    _paintToggles(box) {
      if (!box || !DH.Audio.settings) return;
      const items = box.querySelectorAll('.toggle');
      for (let i = 0; i < items.length; i++) {
        const on = !!DH.Audio.settings[items[i].dataset.toggle];
        items[i].setAttribute('aria-pressed', String(on));
        items[i].querySelector('.toggle-state').textContent = on ? 'On' : 'Off';
      }
    }

    _touchIcons() {
      const map = { left: 'padLeft', right: 'padRight', fire: 'padFire', jump: 'padJump' };
      const btns = this.el.touch ? this.el.touch.querySelectorAll('.touch-btn') : [];
      for (let i = 0; i < btns.length; i++) {
        const img = btns[i].querySelector('img');
        const key = map[btns[i].dataset.hold];
        const path = key && DH.ART.ui[key];
        if (!img || !path) continue;
        img.onerror = function () { img.style.display = 'none'; };
        img.src = DH.ART.url(path);
      }
    }

    /* On-screen controls. They push ACTIONS into Input rather than faking key
       events, and they are real buttons so they stay keyboard reachable.

       Pointer capture is what makes them usable: without it, sliding a thumb
       off a button leaves the action stuck down forever. */
    _bindTouch() {
      const box = this.el.touch;
      if (!box) return;
      const input = this.game.input;

      const set = (btn, on) => {
        btn.dataset.on = on ? 'true' : 'false';
        input.setTouch(btn.dataset.hold, on);
      };

      box.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.touch-btn');
        if (!btn) return;
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        set(btn, true);
      });

      const release = (e) => {
        const btn = e.target.closest('.touch-btn');
        if (btn) set(btn, false);
      };
      box.addEventListener('pointerup', release);
      box.addEventListener('pointercancel', release);

      /* Keyboard users get the same buttons: hold on keydown, drop on keyup. */
      box.addEventListener('keydown', (e) => {
        const btn = e.target.closest('.touch-btn');
        if (!btn || e.repeat) return;
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); set(btn, true); }
      });
      box.addEventListener('keyup', (e) => {
        const btn = e.target.closest('.touch-btn');
        if (btn) set(btn, false);
      });
      box.addEventListener('blur', (e) => {
        const btn = e.target.closest && e.target.closest('.touch-btn');
        if (btn) set(btn, false);
      }, true);
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

    /* ------------------------------------------------ shop */

    /* Rebuilt on every open from the save, so what it offers and what it costs
       can never drift from what the player actually owns. */
    refreshShop() {
      const g = this.game;
      this.el.shopDiamonds.textContent = g.state.diamonds;
      this.el.shopFlash.textContent = '';

      this.el.shopList.innerHTML = DH.UPGRADE_ORDER.map((key) => {
        const track = DH.UPGRADES[key];
        const level = g.state.upgrades[key] || 0;
        const next = DH.nextUpgrade(key, g.state.upgrades);
        const maxed = !next;
        const afford = next && g.state.diamonds >= next.step.cost;
        const icon = DH.ART.ui[track.icon];

        /* Owned levels are shown as filled pips AND as "Level n of 3", so the
           state does not live only in a row of dots. */
        let pips = '';
        for (let i = 0; i < track.levels.length; i++) {
          pips += '<span class="pip' + (i < level ? ' on' : '') + '"></span>';
        }

        return '' +
          '<div class="shop-row" data-key="' + key + '">' +
            (icon ? '<img class="shop-icon" src="' + DH.ART.url(icon) + '" alt="">'
                  : '<span class="shop-icon"></span>') +
            '<div class="shop-info">' +
              '<span class="shop-name">' + track.name + '</span>' +
              '<span class="shop-blurb">' +
                (maxed ? 'Fully upgraded.' : next.step.label + ' \u00b7 ' + track.blurb) +
              '</span>' +
              '<span class="shop-level"><span class="pips">' + pips + '</span>' +
                'Level ' + level + ' of ' + track.levels.length + '</span>' +
            '</div>' +
            (maxed
              ? '<span class="shop-maxed">Maxed</span>'
              : '<span class="shop-price"><img class="gem-icon" alt="" aria-hidden="true">' +
                  next.step.cost + '</span>' +
                '<button class="shop-buy" type="button" data-buy="' + key + '"' +
                  (afford ? '' : ' data-poor="true"') + '>Buy</button>') +
          '</div>';
      }).join('');

      this._iconAll('#shop-list .gem-icon', 'diamond');
    }

    /* Purchase feedback. Never an alert(): a message in the panel that the
       screen reader also announces, per the design doc. */
    _shopFlash(text, bad) {
      const el = this.el.shopFlash;
      el.textContent = text;
      el.dataset.bad = bad ? 'true' : 'false';
      if (window.gsap && this._motionOK()) {
        window.gsap.fromTo(el, { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', overwrite: true });
      }
    }

    /* ------------------------------------------------ settings */

    refreshSettings() {
      this._paintToggles(this.el.settingsToggles);
      const note = this.el.settingsNote;
      if (!note) return;
      const r = DH.Audio.report();
      if (!r.webAudio) note.textContent = 'This browser has no Web Audio support, so the game is silent.';
      else if (!r.speech) note.textContent = 'This browser has no speech synthesiser, so Voice does nothing.';
      else if (!r.voicesInstalled) note.textContent = 'No speech voices are installed, so Voice does nothing.';
      else note.textContent = '';
    }

    /* ------------------------------------------------ world map */

    _applyMapArt() {
      const img = this.el.mapArt;
      if (!img || !DH.ART) return;
      const src = DH.ART.scene('skyward');
      if (src) {
        img.onerror = function () { img.style.display = 'none'; };
        img.src = DH.Assets.resolve(src);
      }
      /* The map's chrome icons. Each hides itself if its file is missing, and
         the text beside it still carries the meaning. */
      this._icon('#map-back-icon', 'arrowLeft');
      this._icon('#icon-heart', 'heart');
      this._icon('#icon-ammo', 'ammoIcon');
      this._touchIcons();
      this._iconAll('.back-icon', 'arrowLeft');
      this._iconAll('.gem-icon', 'diamond');
      this._icon('#map-gem', 'diamond');
      this._icon('#map-star', 'star');
    }

    _iconAll(sel, key) {
      const path = DH.ART && DH.ART.ui[key];
      if (!path) return;
      const list = document.querySelectorAll(sel);
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        el.onerror = function () { el.style.display = 'none'; };
        el.src = DH.ART.url(path);
      }
    }

    _icon(sel, key) {
      const el = document.querySelector(sel);
      const path = DH.ART && DH.ART.ui[key];
      if (!el || !path) return;
      el.onerror = function () { el.style.display = 'none'; };
      el.src = DH.ART.url(path);
    }

    /* Rebuilt every time the map opens, straight from DH.LEVELS and the save,
       so it can never claim a level is open that the save does not have, or
       offer a level that has no data behind it. */
    refreshMap() {
      const save = DH.SaveManager.load();
      const unlocked = {};
      (save.unlockedLevels || [1]).forEach((n) => { unlocked[n] = true; });
      const cleared = {};
      (save.completedLevels || []).forEach((n) => { cleared[n] = true; });

      /* "You are here" is the first unlocked level still unfinished. */
      let current = 0;
      for (let i = 0; i < DH.LEVELS.length; i++) {
        const L = DH.LEVELS[i];
        if (unlocked[L.id] && !cleared[L.id]) { current = L.id; break; }
      }

      this.el.mapDiamonds.textContent = save.diamonds;
      const doneCount = (save.completedLevels || []).length;
      this.el.mapStars.textContent = doneCount + '/' + DH.LEVELS.length;
      this.el.mapStarsWrap.setAttribute('aria-label',
        doneCount + ' of ' + DH.LEVELS.length + ' levels cleared');

      const padlock = DH.ART.ui.padlock ? DH.ART.url(DH.ART.ui.padlock) : '';
      const bossImg = DH.ART.ui.bossMarker ? DH.ART.url(DH.ART.ui.bossMarker) : '';

      this.el.mapNodes.innerHTML = DH.LEVELS.map((L) => {
        const isOpen = !!unlocked[L.id];
        const isDone = !!cleared[L.id];

        /* Five states. Each has its own shape or glyph as well as its own
           colour, and its own word in the accessible label — a progress map is
           exactly where colour-only status fails people. */
        let state, word;
        if (isDone) { state = 'done'; word = 'Cleared'; }
        else if (!isOpen) { state = 'locked'; word = 'Locked'; }
        else if (!L.data) { state = 'soon'; word = 'Coming soon'; }
        else if (L.id === current) { state = 'current'; word = 'Play now'; }
        else { state = 'open'; word = 'Ready'; }

        /* Locked levels are not interactive at all. Unlocked-but-unbuilt ones
           stay clickable so the tap gets an answer instead of silence. */
        const dead = state === 'locked';

        let face;
        if (L.boss) {
          face = bossImg
            ? '<img class="map-boss-img" src="' + bossImg + '" alt="">'
            : '<span class="map-glyph">!</span>';
        } else if (state === 'done') {
          face = '<span class="map-glyph map-tick"></span>';
        } else if (state === 'locked') {
          face = padlock
            ? '<img class="map-lock-img" src="' + padlock + '" alt="">'
            : '<span class="map-glyph">&#8226;</span>';
        } else {
          face = '<span class="map-num">' + L.id + '</span>';
        }

        return '' +
          '<button class="map-node" type="button" data-level="' + L.id + '"' +
            ' data-state="' + state + '"' + (L.boss ? ' data-boss="true"' : '') +
            (dead ? ' disabled' : '') +
            ' style="left:' + (L.map.x * 100) + '%;top:' + (L.map.y * 100) + '%"' +
            ' title="' + L.name + ' \u2014 ' + word + '"' +
            ' aria-label="Level ' + L.id + ', ' + L.name + ', ' + word + '">' +
            '<span class="map-disc" aria-hidden="true">' + face + '</span>' +
            (L.boss ? '<span class="map-boss-label" aria-hidden="true">Boss</span>' : '') +
            (state === 'current' ? '<span class="map-here" aria-hidden="true"></span>' : '') +
          '</button>';
      }).join('');

      this._drawMapPath(unlocked);
      this._pop('#map-nodes .map-node > *', 0.06);
    }

    /* The route. Segments up to the last unlocked level draw solid; the rest
       stay dotted, so "where am I and what is next" reads at a glance. */
    _drawMapPath(unlocked) {
      let out = '';
      for (let i = 0; i < DH.LEVELS.length - 1; i++) {
        const a = DH.LEVELS[i].map;
        const b = DH.LEVELS[i + 1].map;
        const reached = unlocked[DH.LEVELS[i + 1].id];
        out += '<line x1="' + (a.x * 100) + '" y1="' + (a.y * 100) + '"' +
                    ' x2="' + (b.x * 100) + '" y2="' + (b.y * 100) + '"' +
                    ' class="map-link' + (reached ? ' on' : '') + '"/>';
      }
      this.el.mapPath.innerHTML = out;
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
      DH.Audio.play('uiSelect');
      DH.Audio.say('heroSelected', DH.HEROES[id]);
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

      this.el.shopList.addEventListener('click', (e) => {
        const buy = e.target.closest('[data-buy]');
        if (!buy) return;
        const key = buy.dataset.buy;
        const result = g.buyUpgrade(key);
        if (result === 'ok') {
          DH.Audio.play('uiSelect');
          this._shopFlash(DH.UPGRADES[key].name + ' upgraded', false);
        } else if (result === 'poor') {
          DH.Audio.play('uiDenied');
          this._shopFlash('Not enough diamonds', true);
        } else {
          DH.Audio.play('uiDenied');
          this._shopFlash(DH.UPGRADES[key].name + ' is already at maximum', true);
        }
        this.refreshShop();
      });

      const reset = document.getElementById('btn-reset');
      const confirm = document.getElementById('reset-confirm');
      if (reset && confirm) {
        reset.addEventListener('click', () => { confirm.hidden = false; reset.hidden = true; });
        document.getElementById('btn-reset-no').addEventListener('click', () => {
          confirm.hidden = true; reset.hidden = false;
        });
        document.getElementById('btn-reset-yes').addEventListener('click', () => {
          /* Run data only. Audio and accessibility preferences live in their
             own key and are deliberately not erased here. */
          DH.SaveManager.clear();
          g.state.diamonds = 100;
          g.state.upgrades = {};
          g.state.hero = null;
          confirm.hidden = true; reset.hidden = false;
          this.refreshSaveLine();
          this.toast('Save cleared');
        });
      }

      this.el.mapNodes.addEventListener('click', (e) => {
        const node = e.target.closest('.map-node');
        if (!node || node.disabled) return;
        const id = Number(node.dataset.level);
        /* chooseLevel refuses levels with no data. Say so rather than letting
           the tap do nothing at all. */
        if (!g.chooseLevel(id)) {
          const L = DH.levelById(id);
          DH.Audio.play('uiClick');
          this.toast((L ? L.name : 'That level') + ' is not in this build yet');
        }
      });

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        DH.Audio.play('uiClick');
        switch (btn.dataset.act) {
          /* Flow spec: PLAY checks the save — an existing run goes to the
             world map to pick a level, a fresh one goes to hero select. */
          case 'new':      DH.SaveManager.exists() ? g.openMap() : g.openSelect(); break;
          case 'characters': g.openSelect(); break;
          case 'map':     g.openMap(); break;
          case 'shop':    g.openShop(); break;
          case 'settings': g.openSettings(); break;
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
      this._bindToggles();
      this._bindTouch();

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
