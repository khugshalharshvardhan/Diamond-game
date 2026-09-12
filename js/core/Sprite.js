/* Sprite — one image plus how to draw it. Two modes, one interface.

   STATIC mode (what the supplied art pack uses)
     The whole PNG is a single pose. `pad` trims the uniform transparent border
     the pack adds, so the anchor lands on real pixels rather than on padding.

   SHEET mode (for real animation, when it exists)
     The image is a grid of equal cells read left-to-right then top-to-bottom,
     and `anims` names inclusive frame ranges. Set `frameW` to switch it on.

   Both anchor the same way: feet at the origin, facing +x — the contract
   HeroArt already uses — so a sprite and the procedural fallback are
   interchangeable at the same draw site. `anchor: 'center'` is for things that
   fly or float rather than stand.

   draw() returns true if it drew. False means "no art, you draw it", which is
   the normal answer until the file loads and is what keeps the game running
   with an empty assets folder. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  class Sprite {
    constructor(def) {
      this.src = def.src;
      this.pad = def.pad || 0;
      this.anchor = def.anchor || 'feet';

      /* Target height in world pixels. Preferred over `scale`: it is derived
         from the trimmed art at draw time, so the numbers here stay correct
         even if a PNG is re-exported at a different resolution. */
      this.drawHeight = def.drawHeight || 0;
      this.scale = def.scale || 1;

      this.offsetX = def.offsetX || 0;
      this.offsetY = def.offsetY || 0;

      /* Sheet mode only. */
      this.frameW = def.frameW || 0;
      this.frameH = def.frameH || 0;
      this.fps = def.fps || 10;
      this.anims = def.anims || null;

      DH.Assets.request(this.src);
    }

    get ready() { return DH.Assets.ready(this.src); }

    draw(ctx, anim, t) {
      const img = DH.Assets.image(this.src);
      if (!img) return false;

      let sx, sy, sw, sh;

      if (this.frameW && this.anims) {
        const a = this.anims[anim] || this.anims.idle;
        if (!a) return false;
        const count = Math.max(1, a.to - a.from + 1);
        const fps = a.fps || this.fps;
        const raw = Math.floor((t || 0) * fps);
        const step = a.loop === false ? Math.min(raw, count - 1) : ((raw % count) + count) % count;
        const frame = a.from + step;
        const cols = Math.max(1, Math.floor(img.width / this.frameW));
        sx = (frame % cols) * this.frameW;
        sy = Math.floor(frame / cols) * this.frameH;
        sw = this.frameW;
        sh = this.frameH;
      } else {
        const p = this.pad;
        sx = p; sy = p;
        sw = img.width - p * 2;
        sh = img.height - p * 2;
        if (sw <= 0 || sh <= 0) return false;
      }

      const scale = this.drawHeight ? (this.drawHeight / sh) : this.scale;
      const w = sw * scale;
      const h = sh * scale;
      const dy = this.anchor === 'center' ? -h / 2 : -h;

      ctx.drawImage(img, sx, sy, sw, sh, -w / 2 + this.offsetX, dy + this.offsetY, w, h);
      return true;
    }
  }

  DH.Sprite = Sprite;
})(window.DH);
