/* Background — three parallax layers drawn in screen space before the camera
   transform is applied. Shapes are generated from a deterministic hash of the
   column index, so the same spire is always in the same place, but no assets
   and no level data are needed. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  function spires(ctx, offset, vw, spacing, color, minH, maxH, baseY) {
    const first = Math.floor(offset / spacing) - 1;
    const count = Math.ceil(vw / spacing) + 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = first; i < first + count; i++) {
      const sx = i * spacing - offset;
      const seed = U.hash(i);
      const seed2 = U.hash(i + 91.3);
      const w = spacing * (0.42 + seed * 0.5);
      const h = minH + seed2 * (maxH - minH);
      const cx = sx + spacing * 0.5;
      ctx.moveTo(cx - w / 2, baseY);
      ctx.lineTo(cx - w * 0.22, baseY - h * 0.72);
      ctx.lineTo(cx, baseY - h);
      ctx.lineTo(cx + w * 0.26, baseY - h * 0.64);
      ctx.lineTo(cx + w / 2, baseY);
      ctx.closePath();
    }
    ctx.fill();
  }

  /* Repeat a layer image horizontally across the view. Returns false when the
     art has not loaded, which is how each layer independently decides between
     a painted plate and its procedural band. Anchored to the bottom so layers
     of different heights still share a horizon. */
  function tile(ctx, src, offset, drift, vw, vh) {
    const img = src && DH.Assets.image(src);
    if (!img) return false;

    const scale = vh / img.height;
    const w = img.width * scale;
    if (w <= 0) return false;

    let x = -(((offset % w) + w) % w);
    const y = drift;
    while (x < vw) {
      ctx.drawImage(img, x, y, w, vh);
      x += w;
    }
    return true;
  }

  /* Zoom applied to a full-scene plate. The plates are the same 16:9 as the
     view, so at scale-to-cover there would be no spare width and the backdrop
     could not move at all. 1.3 buys travel to parallax across without cropping
     enough to lose the composition. */
  const SCENE_ZOOM = 1.3;

  /* Painted scenes are bright and busy. A scrim keeps the player, enemies and
     projectiles readable against them; without it the action gets lost in the
     artwork. Level data can override per scene. */
  const SCENE_DIM = 0.34;

  /* Draw a full-scene plate, panning across it as the camera crosses the level.
     `progress` is 0..1 along the level, so the plate's whole width is used no
     matter how long the level is — no tuning per level. */
  function scene(ctx, src, progress, camY, vw, vh, dim) {
    const img = DH.Assets.image(src);
    if (!img) return false;

    const scale = Math.max(vw / img.width, vh / img.height) * SCENE_ZOOM;
    const w = img.width * scale;
    const h = img.height * scale;

    const travelX = Math.max(0, w - vw);
    const travelY = Math.max(0, h - vh);
    const p = U.clamp(progress || 0, 0, 1);

    const x = -p * travelX;
    /* Sit low in the frame so the painted ground stays near the play area,
       then let the camera's height nudge it a little. */
    const y = -travelY * U.clamp(0.62 + (camY / vh) * 0.12, 0, 1);

    ctx.drawImage(img, x, y, w, h);

    const d = (dim === undefined || dim === null) ? SCENE_DIM : dim;
    if (d > 0) {
      ctx.fillStyle = 'rgba(6,10,23,' + d + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
    return true;
  }

  DH.Background = {
    /* `backdropKey` names an entry in DH.ART.scenes. When that plate has
       loaded it replaces the whole procedural sky: drawing the shape bands on
       top of a painted scene would read as two backgrounds fighting. Until it
       loads — or with no key at all — the original procedural sky is used
       unchanged, so the game still looks deliberate with no art present. */
    draw(ctx, camX, camY, t, vw, vh, backdropKey, progress, dim) {
      const src = backdropKey && DH.ART && DH.ART.scene(backdropKey);
      if (src && scene(ctx, src, progress, camY, vw, vh, dim)) return;

      const sky = ctx.createLinearGradient(0, 0, 0, vh);
      sky.addColorStop(0, '#0a1230');
      sky.addColorStop(0.55, '#14204a');
      sky.addColorStop(1, '#1d2c5e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, vw, vh);

      // A cold vault light somewhere far behind everything.
      const lamp = ctx.createRadialGradient(vw * 0.7, vh * 0.18, 10, vw * 0.7, vh * 0.18, vh * 0.8);
      lamp.addColorStop(0, 'rgba(127,230,255,.16)');
      lamp.addColorStop(1, 'rgba(127,230,255,0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, vw, vh);

      const drift = -camY * 0.05;
      const layers = (DH.ART && DH.ART.background && DH.ART.background.layers) || [];
      for (let i = 0; i < layers.length; i++) {
        const L = layers[i];
        const offset = camX * L.speed;
        if (!tile(ctx, L.src, offset, drift, vw, vh)) {
          const f = L.fallback;
          spires(ctx, offset, vw, f.spacing, f.color, f.minH, f.maxH, vh * f.baseY + drift);
        }
      }

      // Slow motes so the world is never completely static.
      ctx.fillStyle = 'rgba(159,179,232,.35)';
      for (let i = 0; i < 34; i++) {
        const seed = U.hash(i * 3.7);
        const seed2 = U.hash(i * 8.1);
        const x = ((seed * 2600 - camX * 0.6) % (vw + 60) + vw + 60) % (vw + 60) - 30;
        const y = (seed2 * vh + Math.sin(t * 0.4 + i) * 12 + vh) % vh;
        const s = 1 + seed2 * 2.2;
        ctx.globalAlpha = 0.2 + seed * 0.45;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }
  };
})(window.DH);
