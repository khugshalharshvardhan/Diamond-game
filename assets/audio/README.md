# Audio

This folder is intentionally empty.

Every sound in the game is **synthesised at runtime** by
`js/systems/AudioManager.js` from the recipes in `js/data/Audio.js` — no files
are loaded, so nothing here can go missing and there is nothing to license.
Voice lines use the browser's speech synthesiser.

## Dropping in real recordings

Put the file here, then give that sound a `src` in `js/data/Audio.js`:

```js
shoot: {
  src: 'assets/audio/shoot.mp3',
  layers: [ /* kept as the fallback if the file fails to load */ ]
}
```

`AudioManager` plays files through `<audio>` elements rather than decoded
buffers, because `fetch`/XHR are blocked on `file://` in Chrome while media
elements load local files fine. The synth recipe stays as the fallback.
