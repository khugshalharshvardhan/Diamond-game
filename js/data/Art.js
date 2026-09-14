/* Art — the manifest. This is the file you edit when artwork changes.

   SOURCE
   ------
   Every path is relative to assets/images/. Nothing else in the codebase
   hard-codes an image path, so moving or renaming art means editing this file
   and nothing else. The pack's own documentation lives in docs/asset-pack/.

   WHAT THIS ART IS
   ----------------
   Per the pack's own README, every PNG is a SINGLE STATIC POSE. `frames: 1` on
   all 141 entries. There are no walk, jump, attack or death cycles, and the
   weapons are baked into the character poses. So the sprites below run in the
   Sprite class's static mode: movement translates and flips the pose, and the
   squash/stretch, muzzle flash and hit flash stay procedural on top. That is
   not a walk animation and is not described as one.

   Every asset in the pack carries a uniform 4px transparent border, and its
   pivot is bottom-centre of the trimmed content (the flying drone is centred,
   because it flies). `pad: 4` trims that border so feet land on the ground
   rather than 4px above it.

   `drawHeight` is the target height in world pixels. It is deliberately a
   little taller than each entity's collision box — art overhanging its hitbox
   is normal and reads better than art shrunk to fit. Collision boxes are
   defined in the entities, never from these numbers.

   Anything missing here simply falls back to procedural drawing. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const IMAGES = 'assets/images/';

  DH.ART = {
    base: IMAGES,

    /* ---- heroes. Keys match the ids in Heroes.js. Collision box is 34x52.

       These are REAL sheets: a 4x2 grid, 8 frames of a walk cycle, read
       left-to-right then top-to-bottom. They were re-exported from the
       supplied art onto an integer grid (the source pitch was 443.5px, so
       slicing it directly bled a sliver of the next frame in), and every
       frame was shifted so the planted foot sits on one baseline — the
       source had row 2 sitting ~8px higher, which read as a limp.

       `perPixel` advances the cycle every N world pixels travelled rather
       than on a timer, so the feet cannot skate. Lower = faster steps. A
       slower hero therefore steps more slowly for free.

       There is no idle, jump, fall or hurt artwork: those poses reuse the
       most plausible walk frame. Only `run` is a real animation. */
    heroes: {
      assault: {
        src: 'characters/heroes/assault-walk.png',
        frameW: 220, frameH: 217, drawHeight: 66,
        anims: {
          idle: { from: 0, to: 0 },
          run:  { from: 0, to: 7, perPixel: 16 },
          jump: { from: 1, to: 1 },
          fall: { from: 5, to: 5 },
          hurt: { from: 0, to: 0 }
        }
      },
      tank: {
        src: 'characters/heroes/tank-walk.png',
        frameW: 220, frameH: 211, drawHeight: 72,
        anims: {
          idle: { from: 0, to: 0 },
          run:  { from: 0, to: 7, perPixel: 18 },
          jump: { from: 1, to: 1 },
          fall: { from: 5, to: 5 },
          hurt: { from: 0, to: 0 }
        }
      },
      scout: {
        src: 'characters/heroes/scout-walk.png',
        frameW: 220, frameH: 216, drawHeight: 63,
        anims: {
          idle: { from: 0, to: 0 },
          run:  { from: 0, to: 7, perPixel: 16 },
          jump: { from: 1, to: 1 },
          fall: { from: 5, to: 5 },
          hurt: { from: 0, to: 0 }
        }
      }
    },

    /* ---- enemies. Only `grunt` is wired today; the rest are here so Phase 6
       is a data change rather than a code change. Collision box is 40x38. */
    enemies: {
      grunt:    { src: 'characters/enemies/goblin.png',        pad: 4, drawHeight: 48 },
      gunner:   { src: 'characters/enemies/sniper.png',        pad: 4, drawHeight: 52 },
      brute:    { src: 'characters/enemies/robot.png',         pad: 4, drawHeight: 56 },
      drone:    { src: 'characters/enemies/flying-drone.png',  pad: 4, drawHeight: 40, anchor: 'center' },
      assassin: { src: 'characters/enemies/sniper.png',        pad: 4, drawHeight: 50 }
    },

    /* ---- boss. Collision box is 104x118. The spec wants the Warden at 3-4x
       the player's height; reaching that means growing the hitbox and the
       arena together, which is boss-polish work, not an art number. */
    boss: { src: 'characters/enemies/dark-colossus.png', pad: 4, drawHeight: 132 },

    companion: { src: 'characters/companion/nova.png', pad: 4, drawHeight: 36 },

    /* ---- world pickups, keyed by Pickup kind. */
    pickups: {
      diamond: { src: 'items/diamond.png',     pad: 4, drawHeight: 26, anchor: 'center' },
      gem:     { src: 'items/power-up.png',    pad: 4, drawHeight: 40, anchor: 'center' },
      health:  { src: 'items/health-pack.png', pad: 4, drawHeight: 30, anchor: 'center' },
      ammo:    { src: 'items/ammo-box.png',    pad: 4, drawHeight: 28, anchor: 'center' }
    },

    /* ---- full-scene plates, one per location plus the title.

       All five are 1672x941, i.e. 16:9 to within 0.06%, which is the same
       aspect as the stage. That is why they can be placed by percentage and
       stay aligned at every window size. */
    scenes: {
      cover:   'branding/title-screen.png',
      ruins:   'backgrounds/forgotten-ruins.png',
      foundry: 'backgrounds/dark-fortress.png',
      grove:   'backgrounds/enchanted-forest.png',
      skyward: 'backgrounds/sky-kingdom.png'
    },

    scene(key) { return this.scenes[key] || null; },

    /* ---- flat icons for the DOM interface, used as <img> sources.
       Only text-free art is listed. The pack's button and card PNGs have their
       labels baked into the pixels, so using them would freeze every string
       and fight the real, focusable buttons already in the markup — its
       CLAUDE.md warns against exactly that. */
    ui: {
      diamond: 'ui/icons/diamond.png',
      heartEmpty: 'ui/icons/heart-empty.png',
      statHealth: 'ui/icons/stat-health.png',
      statDamage: 'ui/icons/stat-damage.png',
      statSpeed: 'ui/icons/stat-speed.png',
      statFireRate: 'ui/icons/stat-fire-rate.png',

      /* World map. The numbered node PNGs in the pack are deliberately NOT
         used: they are flagged `reference-state`, carry cropped rings, and
         have their numbers baked in, so states and numbers could not stay
         live. These four are clean cut-outs. */
      arrowLeft: 'ui/icons/arrow-left.png',
      padlock: 'ui/map/padlock.png',
      bossMarker: 'ui/map/boss-marker.png',
      star: 'ui/rewards/star-large.png',

      upgradeDamage: 'ui/icons/upgrade-damage.png',
      upgradeHealth: 'ui/icons/upgrade-health.png',
      upgradeSpeed: 'ui/icons/upgrade-speed.png',

      /* HUD and on-screen controls. */
      heart: 'ui/icons/heart.png',
      ammoIcon: 'ui/icons/ammo.png',
      padLeft: 'ui/controls/gameplay-left.png',
      padRight: 'ui/controls/gameplay-right.png',
      padJump: 'ui/controls/gameplay-jump.png',
      padFire: 'ui/controls/gameplay-aim.png'
    },

    /* ---- parallax background.
       The pack supplies NO clean background plates — its references/screens/
       crops still contain characters, HUD and text baked in, and it says so.
       So every layer falls back to its procedural band. Real plates dropped at
       these paths will be picked up with no code change. */
    background: {
      layers: [
        { src: null, speed: 0.12, fallback: { spacing: 330, color: '#101a3d', minH: 150, maxH: 330, baseY: 0.82 } },
        { src: null, speed: 0.28, fallback: { spacing: 240, color: '#16234c', minH: 110, maxH: 250, baseY: 0.90 } },
        { src: null, speed: 0.48, fallback: { spacing: 170, color: '#1b2b5c', minH: 70,  maxH: 170, baseY: 0.98 } }
      ]
    },

    /* Every path worth preloading at boot. */
    all() {
      const out = [];
      const push = (o) => Object.keys(o).forEach((k) => { if (o[k] && o[k].src) out.push(o[k].src); });
      push(this.heroes);
      push(this.enemies);
      push(this.pickups);
      out.push(this.boss.src, this.companion.src);
      Object.keys(this.ui).forEach((k) => out.push(this.ui[k]));
      Object.keys(this.scenes).forEach((k) => out.push(this.scenes[k]));
      this.background.layers.forEach((l) => { if (l.src) out.push(l.src); });
      return out;
    },

    /* Path for DOM <img> use. Delegates so there is exactly one place that
       knows how a manifest path becomes a URL. */
    url(rel) { return DH.Assets.resolve(rel); }
  };
})(window.DH);
