/* Boot. Nothing else touches the DOM at load time. */
(function () {
  'use strict';
  window.addEventListener('DOMContentLoaded', function () {
    /* Art is requested but never waited on. The game starts on procedural
       drawing and each picture swaps itself in as it decodes, so a missing or
       slow asset can never delay or block the first frame. */
    DH.Assets.base = DH.ART.base;
    DH.Assets.preload(DH.ART.all());

    const canvas = document.getElementById('game');
    const game = new DH.Game(canvas);
    window.DH.game = game;   // handy in the console while developing
    game.start();
  });
})();
