/* Input — maps raw keys to named actions so gameplay code never sees key codes.
   `down()` is level-triggered, `pressed()` is edge-triggered and is consumed
   once per fixed update step (see Game's loop). */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  /* Space fires. It is deliberately NOT also bound to jump: one key doing two
     things means every shot is a hop. Jump is W or the up arrow. */
  const BINDINGS = {
    left:  ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up:    ['ArrowUp', 'KeyW'],
    down:  ['ArrowDown', 'KeyS'],
    jump:  ['KeyW', 'ArrowUp'],
    fire:  ['Space', 'KeyJ', 'KeyK', 'Enter'],
    ability: ['ShiftLeft', 'ShiftRight', 'KeyL'],
    slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'],
    pause: ['Escape', 'KeyP']
  };

  const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  class Input {
    constructor() {
      this.held = new Set();
      this.edge = new Set();
      /* On-screen buttons push ACTIONS in here rather than fake key codes, so
         a touch control never has to pretend to be a keyboard. */
      this.touch = new Set();
      this.touchEdge = new Set();
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
      if (this.touch.has(action)) return true;
      return BINDINGS[action].some((code) => this.held.has(code));
    }

    pressed(action) {
      if (!this.enabled) return false;
      if (this.touchEdge.has(action)) return true;
      return BINDINGS[action].some((code) => this.edge.has(code));
    }

    /* An on-screen button going down or up. */
    setTouch(action, on) {
      if (on) {
        if (!this.touch.has(action)) this.touchEdge.add(action);
        this.touch.add(action);
      } else {
        this.touch.delete(action);
      }
    }

    /* Called at the end of every fixed step. */
    flush() { this.edge.clear(); this.touchEdge.clear(); }

    release() {
      this.held.clear(); this.edge.clear();
      this.touch.clear(); this.touchEdge.clear();
    }
  }

  DH.Input = Input;
})(window.DH);
