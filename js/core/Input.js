/* Input — maps raw keys to named actions so gameplay code never sees key codes.
   `down()` is level-triggered, `pressed()` is edge-triggered and is consumed
   once per fixed update step (see Game's loop). */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const BINDINGS = {
    left:  ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up:    ['ArrowUp', 'KeyW'],
    down:  ['ArrowDown', 'KeyS'],
    jump:  ['Space', 'KeyW', 'ArrowUp'],
    fire:  ['KeyJ', 'KeyK', 'Enter'],
    ability: ['ShiftLeft', 'ShiftRight', 'KeyL'],
    pause: ['Escape', 'KeyP']
  };

  const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  class Input {
    constructor() {
      this.held = new Set();
      this.edge = new Set();
      this.enabled = true;

      window.addEventListener('keydown', (e) => {
        if (SWALLOW.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.held.add(e.code);
        this.edge.add(e.code);
      });

      window.addEventListener('keyup', (e) => this.held.delete(e.code));
      /* Losing focus mid-jump would otherwise leave keys stuck down. */
      window.addEventListener('blur', () => { this.held.clear(); this.edge.clear(); });
    }

    down(action) {
      if (!this.enabled) return false;
      return BINDINGS[action].some((code) => this.held.has(code));
    }

    pressed(action) {
      if (!this.enabled) return false;
      return BINDINGS[action].some((code) => this.edge.has(code));
    }

    /* Called at the end of every fixed step. */
    flush() { this.edge.clear(); }

    release() { this.held.clear(); this.edge.clear(); }
  }

  DH.Input = Input;
})(window.DH);
