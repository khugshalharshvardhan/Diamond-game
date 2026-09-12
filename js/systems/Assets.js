/* Assets — image loading, deliberately fire-and-forget.

   The rule this file exists to enforce: a missing image can never stop the
   game. Nothing here blocks the boot sequence and nothing throws. Requests go
   out, the game starts immediately, and art appears the moment it arrives.
   Every draw site asks `image()` for a picture and falls back to procedural
   canvas drawing when the answer is null.

   That means the project is always runnable, with or without an assets folder,
   and art can be dropped in one file at a time. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  const cache = Object.create(null);

  const Assets = {
    base: '',
    requested: 0,
    settled: 0,
    missing: [],

    /* Turn a manifest path into a real URL.

       Paths are resolved against `base` — EXCEPT ones that begin with './',
       '/' or a scheme, which are already rooted and are left alone. That is
       what lets pack art ('items/diamond.png') and project-root art
       ('./cover page.png') live in the same manifest.

       Spaces are percent-encoded because several of the supplied filenames
       contain them, and a raw space in a URL is not reliable from file://. */
    resolve(src) {
      const rooted = /^(\.\/|\/|[a-z]+:)/i.test(src);
      return (rooted ? src : Assets.base + src).replace(/ /g, '%20');
    },

    /* Start loading `src` if it is not already in flight. Safe to call every
       frame — the cache makes repeat calls free. */
    request(src) {
      if (!src) return null;
      if (cache[src]) return cache[src];

      const rec = cache[src] = { src: src, img: new Image(), ok: false, failed: false };
      Assets.requested++;

      rec.img.onload = function () {
        /* A zero-sized decode counts as a failure: drawImage with it is a
           silent no-op, which would look like a bug rather than missing art. */
        if (!rec.img.naturalWidth) { rec.failed = true; Assets.missing.push(src); }
        else rec.ok = true;
        Assets.settled++;
      };
      rec.img.onerror = function () {
        rec.failed = true;
        Assets.settled++;
        Assets.missing.push(src);
      };

      rec.img.src = Assets.resolve(src);
      return rec;
    },

    /* The loaded image, or null. Null is a normal answer, not an error. */
    image(src) {
      const rec = cache[src];
      return rec && rec.ok ? rec.img : null;
    },

    ready(src) { return !!Assets.image(src); },

    preload(list) {
      for (let i = 0; i < list.length; i++) Assets.request(list[i]);
    },

    progress() {
      return Assets.requested ? Assets.settled / Assets.requested : 1;
    },

    /* Console summary, so "why is my PNG not showing" has an obvious answer. */
    report() {
      return {
        requested: Assets.requested,
        loaded: Assets.requested - Assets.missing.length,
        missing: Assets.missing.slice()
      };
    }
  };

  DH.Assets = Assets;
})(window.DH);
