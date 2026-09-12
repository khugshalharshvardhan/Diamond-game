/* HeroArt — the single procedural renderer for all three heroes.

   Player.draw() and the character-select portraits both call this, which is
   the point: the hero you picked on the select screen cannot drift away from
   the hero you control, because there is only one drawing routine.

   Nothing here is per-hero code. Proportions and features come from the `art`
   flags in Heroes.js, colours from the hero's palette, so a fourth hero is a
   data entry and not a new branch.

   Contract: draws a hero with feet at the origin, facing +x, roughly 52px tall
   at build 1.0. The caller owns translate, scale, facing and alpha. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  /* pose → how the body is carried. `bob` is idle breathing, `tuck` pulls the
     legs up, `lean` tips the torso, `swing` enables the run cycle. */
  const POSES = {
    idle: { swing: 0, tuck: 0.00, lean: 0.00, bob: 1 },
    run:  { swing: 1, tuck: 0.00, lean: 0.10, bob: 0 },
    jump: { swing: 0, tuck: 1.00, lean: 0.07, bob: 0 },
    fall: { swing: 0, tuck: 0.40, lean: -0.06, bob: 0 },
    hurt: { swing: 0, tuck: 0.25, lean: -0.30, bob: 0 }
  };

  /* One Sprite per hero, built on first use so a hero nobody picks never
     requests its sheet. */
  const sheets = Object.create(null);

  function sheetFor(hero) {
    if (hero.id in sheets) return sheets[hero.id];
    const def = DH.ART && DH.ART.heroes && DH.ART.heroes[hero.id];
    sheets[hero.id] = def ? new DH.Sprite(def) : null;
    return sheets[hero.id];
  }

  /* The swap point for the whole project: artwork if it has loaded, shapes if
     it has not. Both the gameplay player and the character-select portraits
     come through here, so they can never end up showing different heroes. */
  function draw(ctx, hero, s) {
    const sheet = sheetFor(hero);
    if (sheet && sheet.draw(ctx, s.pose || 'idle', s.t || 0)) {
      /* The supplied art is a single static pose with no firing frame, so the
         muzzle flash stays procedural and is drawn over it. Without this,
         switching to artwork would silently lose a piece of game feel. */
      if (s.muzzle > 0) muzzleFlash(ctx, hero);
      return;
    }
    drawShapes(ctx, hero, s);
  }

  function muzzleFlash(ctx, hero) {
    ctx.save();
    ctx.shadowColor = hero.accent;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    U.gemPath(ctx, 30, -30, 14, 18);
    ctx.fill();
    ctx.restore();
  }

  function drawShapes(ctx, hero, s) {
    const a = hero.art;
    const b = a.build;
    const p = POSES[s.pose] || POSES.idle;
    const t = s.t || 0;
    const flash = !!s.flash;

    const body = flash ? '#ffffff' : hero.shade;
    const armor = flash ? '#ffffff' : hero.accent;
    const trim = flash ? '#ffffff' : hero.trim;
    const dark = flash ? '#ffffff' : '#141c3a';

    ctx.save();
    ctx.scale(b, b);

    const breathe = p.bob * Math.sin(t * 2.2) * 1.2;
    ctx.translate(0, breathe);

    /* ---- legs. The run cycle is the only thing driven by distance travelled,
       so it stays in step with actual movement instead of wall-clock time. */
    const swing = p.swing ? Math.sin(s.runT || 0) * 6 : 0;
    const tuck = p.tuck * 7;
    ctx.fillStyle = dark;
    ctx.fillRect(-11 + swing, -16 + tuck, 9, 16 - tuck);
    ctx.fillRect(2 - swing, -16 + tuck * 0.6, 9, 16 - tuck * 0.6);

    ctx.save();
    ctx.rotate(p.lean * -0.3);

    /* ---- torso */
    ctx.fillStyle = body;
    U.roundRect(ctx, -13, -42, 26, 28, 8); ctx.fill();
    ctx.fillStyle = armor;
    U.roundRect(ctx, -13, -42, 26, 10, 5); ctx.fill();

    /* ---- back pack / plating */
    ctx.fillStyle = dark;
    U.roundRect(ctx, -19, -40, 8, 18, 3); ctx.fill();

    /* ---- Tank's reactor: a lit core in the chest, the silhouette cue that
       reads at distance even when the colour is washed out. */
    if (a.reactor) {
      ctx.save();
      ctx.shadowColor = armor;
      ctx.shadowBlur = 12 + Math.sin(t * 3) * 4;
      ctx.fillStyle = trim;
      U.gemPath(ctx, -1, -28, 13, 16);
      ctx.fill();
      ctx.restore();
    }

    /* ---- Assault's scarf: trails behind, lifted by movement. */
    if (a.scarf) {
      const lift = Math.min(1, Math.abs(s.vx || 0) / 260);
      ctx.fillStyle = armor;
      ctx.beginPath();
      ctx.moveTo(-8, -42);
      ctx.lineTo(-24 - lift * 12, -38 + Math.sin(t * 6) * 2 - lift * 8);
      ctx.lineTo(-22 - lift * 10, -30 + Math.sin(t * 6 + 1) * 2 - lift * 4);
      ctx.lineTo(-6, -33);
      ctx.closePath(); ctx.fill();
    }

    /* ---- head */
    ctx.fillStyle = dark;
    U.roundRect(ctx, -11, -60, 23, 19, 7); ctx.fill();

    /* ---- Scout's hood: a peak over the head, the slim silhouette's signature. */
    if (a.hood) {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-13, -41);
      ctx.lineTo(-14, -58);
      ctx.lineTo(-2, -65);
      ctx.lineTo(11, -59);
      ctx.lineTo(9, -47);
      ctx.lineTo(-2, -50);
      ctx.closePath(); ctx.fill();
    }

    /* ---- visor. Shape is the per-hero tell; all three glow the accent. */
    ctx.save();
    ctx.shadowColor = armor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = armor;
    if (a.visor === 'slit') ctx.fillRect(1, -54, 10, 3);
    else if (a.visor === 'wide') ctx.fillRect(-2, -56, 13, 6);
    else ctx.fillRect(0, -55, 11, 5);
    ctx.restore();

    /* ---- arm + weapon, always levelled forward */
    ctx.fillStyle = body;
    U.roundRect(ctx, 4, -34, 12, 8, 3); ctx.fill();
    ctx.fillStyle = dark;
    if (a.weapon === 'cannon') {
      U.roundRect(ctx, 12, -35, 18, 10, 3); ctx.fill();
      ctx.fillStyle = armor;
      ctx.fillRect(26, -34, 4, 8);
    } else if (a.weapon === 'pistols') {
      U.roundRect(ctx, 12, -33, 11, 5, 2); ctx.fill();
      ctx.fillStyle = body;
      U.roundRect(ctx, 6, -27, 10, 4, 2); ctx.fill();   // offhand pistol
      ctx.fillStyle = dark;
      U.roundRect(ctx, 13, -27, 9, 4, 2); ctx.fill();
    } else {
      U.roundRect(ctx, 12, -33, 14, 6, 2); ctx.fill();
    }

    ctx.restore();   // lean

    /* ---- muzzle flash, drawn last so it sits over the barrel */
    if (s.muzzle > 0) {
      const mx = a.weapon === 'cannon' ? 34 : 30;
      ctx.save();
      ctx.shadowColor = armor;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      U.gemPath(ctx, mx, -30, 14, 18);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /* Pick the animation state from raw motion, so callers never hand-manage it. */
  function poseFor(e) {
    if (e.hurtPose > 0) return 'hurt';
    if (!e.onGround) return e.vy < 0 ? 'jump' : 'fall';
    return Math.abs(e.vx) > 18 ? 'run' : 'idle';
  }

  DH.HeroArt = { draw, poseFor };
})(window.DH);
