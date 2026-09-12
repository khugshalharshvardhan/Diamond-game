# Art in this project

Artwork comes from the supplied pack at `diamond-heroes-assets/`, used **in
place**. It is deliberately not copied: the pack's own `preview.html` and
`assets.json` stay valid, its filenames stay as its `CLAUDE.md` asks, and 123
files are not duplicated.

Paths are declared in exactly one place — [`js/data/Art.js`](js/data/Art.js).
Nothing else in the codebase hard-codes an image path.

To see what loaded, open the browser console:

    DH.Assets.report()

## What the pack provides, and what it does not

Confirmed against `assets.json`: `frames: 1` on all 141 entries, a uniform 4px
transparent border, bottom-centre pivots (the flying drone is centred).

**Provided** — one static full-body pose per hero, enemy and boss; six weapons;
pickups; portraits; text-free UI icons.

**Not provided, and not faked here:**

- **Animation frames.** No walk, jump, attack, hurt or death cycles. Movement
  translates and flips the single pose. Squash/stretch, muzzle flash, hit flash
  and the boss's corrupted-core glow are drawn procedurally on top. **This is
  not a walk animation.**
- **Clean level backgrounds.** `references/screens/` are flattened screenshots
  with characters, HUD and text still baked in — unusable as backgrounds. All
  three parallax layers therefore still draw their procedural bands.
- **Separable weapons.** Each hero's gun is part of their pose, so equipping a
  different weapon cannot change what the character is holding.
- **Editable UI text.** Button, card and dialogue PNGs have labels baked into
  the pixels. The interface stays real DOM with live text; only text-free icons
  are taken from the pack.

## Still needed to match the mock-up

| Need | Why it matters |
| --- | --- |
| Hero sprite sheets — idle / run / jump / fall / hurt | The single static pose is the largest remaining gap |
| Three tiling parallax background plates | The only part of the mock-up's look still entirely procedural |
| Enemy sheets for Gunner / Brute / Drone / Assassin | Art exists and is mapped; animation does not |
| Weapon art separated from the hero poses | Required before a weapon swap can change the character's look |

## Adding real sheets later

A sheet is a grid of equal cells read left-to-right then top-to-bottom, feet on
the bottom edge, facing right. Add `frameW`, `frameH` and `anims` to that
entry in `Art.js` and `Sprite` switches from static mode to sheet mode. No
other code changes.

```js
assault: {
  src: 'characters/heroes/assault.png',
  frameW: 64, frameH: 64, fps: 10,
  anims: { idle: { from: 0, to: 3, fps: 6 }, run: { from: 4, to: 11, fps: 12 } }
}
```
