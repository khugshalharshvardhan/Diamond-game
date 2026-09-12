/* Palettes — how the world geometry is painted, per location.

   The platforms are the one thing the player is always looking at, so dark
   navy slabs sitting on a bright green ruin read as two different games. Each
   scene gets stone that belongs to it: the rock body, the lit cap along the
   top, and the scatter of detail growing out of it.

   Keyed by the `scene` name in the level data. A level with no scene — or a
   scene with no entry — falls back to `default`, which is the original navy
   vault look, so nothing regresses when art is absent.

   `detail` picks what grows on the surface:
     tuft     grass blades        overgrown stone
     crystal  angular shards      the original vault look
     ember    glowing embers      anything volcanic */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  DH.PALETTES = {
    /* Original vault look. Used whenever no painted scene is in play. */
    default: {
      rockTop: '#22305a', rockBottom: '#0c1330', edge: '#46649f',
      ledge: '#233156', ledgeTop: '#3f5da8',
      detail: 'crystal', detailColor: 'rgba(127,230,255,.12)'
    },

    /* location 1 — sunlit ruins, grey stone under heavy moss. */
    ruins: {
      rockTop: '#7c7462', rockBottom: '#2f2b22', edge: '#9ed15f',
      ledge: '#6f6a55', ledgeTop: '#9ed15f',
      detail: 'tuft', detailColor: 'rgba(150,205,90,.55)'
    },

    /* location 2 — the molten keep. Cold basalt, hot edges. */
    foundry: {
      rockTop: '#4e4756', rockBottom: '#181320', edge: '#ff8a3c',
      ledge: '#443d4d', ledgeTop: '#ff9d4a',
      detail: 'ember', detailColor: 'rgba(255,140,60,.7)'
    },

    /* location 3 — the sunken grove. Wet stone, cold light. */
    grove: {
      rockTop: '#54655a', rockBottom: '#1d2523', edge: '#7fd98f',
      ledge: '#4b5850', ledgeTop: '#7fd98f',
      detail: 'crystal', detailColor: 'rgba(120,230,255,.3)'
    },

    /* level monitoring image — the skyward vault. Pale stone, bright grass. */
    skyward: {
      rockTop: '#8b8879', rockBottom: '#3c3a33', edge: '#8ed15c',
      ledge: '#7d7a6b', ledgeTop: '#8ed15c',
      detail: 'tuft', detailColor: 'rgba(150,210,95,.5)'
    }
  };

  DH.paletteFor = function (scene) {
    return (scene && DH.PALETTES[scene]) || DH.PALETTES.default;
  };
})(window.DH);
