/* Camera — world-space view window. Look-ahead in the facing direction,
   exponential smoothing, hard clamp to swappable bounds, draw-time shake. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const U = DH.Utils;

  class Camera {
    constructor(vw, vh) {
      this.vw = vw;
      this.vh = vh;
      this.x = 0;
      this.y = 0;
      this.bounds = { minX: 0, maxX: Infinity, minY: -Infinity, maxY: Infinity };
      this.lookahead = 90;
      this.shakeTime = 0;
      this.shakeMax = 0;
      this.shakePower = 0;
      this.ox = 0;
      this.oy = 0;
    }

    setBounds(minX, maxX, minY, maxY) {
      this.bounds = { minX, maxX, minY, maxY };
    }

    /* Drop the camera straight onto the target, no easing. Used on respawn. */
    snapTo(target) {
      this.x = this._desiredX(target);
      this.y = this._desiredY(target);
      this._clamp();
    }

    _desiredX(t) {
      return t.x + t.w / 2 + (t.facing || 1) * this.lookahead - this.vw / 2;
    }

    _desiredY(t) {
      return t.y + t.h / 2 - this.vh * 0.58;
    }

    follow(target, dt) {
      this.x = U.damp(this.x, this._desiredX(target), 0.0005, dt);

      // Vertical is lazier so routine jumps don't pump the view.
      const dy = this._desiredY(target);
      const slack = 70;
      if (Math.abs(dy - this.y) > slack) {
        const goal = dy + (dy > this.y ? -slack : slack);
        this.y = U.damp(this.y, goal, 0.02, dt);
      }
      this._clamp();

      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        const falloff = Math.max(this.shakeTime / this.shakeMax, 0);
        const amp = this.shakePower * falloff * falloff;
        this.ox = U.rand(-amp, amp);
        this.oy = U.rand(-amp, amp);
      } else {
        this.ox = this.oy = 0;
      }
    }

    _clamp() {
      const b = this.bounds;
      this.x = U.clamp(this.x, b.minX, Math.max(b.minX, b.maxX - this.vw));
      this.y = U.clamp(this.y, b.minY, Math.max(b.minY, b.maxY - this.vh));
    }

    shake(power, duration) {
      if (this.shakeTime > 0 && this.shakePower > power) return;
      this.shakePower = power;
      this.shakeTime = this.shakeMax = duration;
    }

    apply(ctx) {
      ctx.translate(-Math.round(this.x + this.ox), -Math.round(this.y + this.oy));
    }

    /* Broad-phase test: is this box worth simulating / drawing? */
    sees(box, margin) {
      const m = margin || 0;
      return box.x + box.w > this.x - m && box.x < this.x + this.vw + m &&
             box.y + box.h > this.y - m - 400 && box.y < this.y + this.vh + m + 400;
    }
  }

  DH.Camera = Camera;
})(window.DH);
