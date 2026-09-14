# Art in this project

All artwork lives under `assets/images/`, grouped by role. The original
pack's manifest, catalogue and source boards are kept in `docs/asset-pack/`
for reference; the game does not read from them.

Paths are declared in exactly one place — [`js/data/Art.js`](../js/data/Art.js).
Nothing else in the codebase hard-codes an image path, so the whole tree can be
rearranged by editing that file alone.

To see what loaded, open the browser console:

    DH.Assets.report()

## What the pack provides, and what it does not

Confirmed against `docs/asset-pack/assets.json`: `frames: 1` on all 141 entries, a uniform 4px
transparent border, bottom-centre pivots (the flying drone is centred).

**Provided** — one static full-body pose per hero, enemy and boss; six weapons;
pickups; portraits; text-free UI icons.

**Not provided, and not faked here:**

- **Animation frames for enemies and the boss.** No walk, attack, hurt or death
  cycles. Movement translates and flips the single pose. Hit flash and the
  boss's corrupted-core glow are drawn procedurally on top.
  The three HEROES are the exception — see below.
- **Clean level backgrounds.** `docs/asset-pack/references/screens/` are flattened screenshots
  with characters, HUD and text still baked in — unusable as backgrounds. All
  three parallax layers therefore still draw their procedural bands.
- **Separable weapons.** Each hero's gun is part of their pose, so equipping a
  different weapon cannot change what the character is holding.
- **Editable UI text.** Button, card and dialogue PNGs have labels baked into
  the pixels. The interface stays real DOM with live text; only text-free icons
  are taken from the pack.

## Hero walk cycles

`assets/images/characters/heroes/{assault,tank,scout}-walk.png` are real sheets: a 4x2 grid,
8 frames of a walk, read left-to-right then top-to-bottom.

They were re-exported from the supplied art rather than used as delivered:

- the source pitch was **443.5px**, so slicing on integer boundaries bled a
  sliver of the neighbouring frame into every cell;
- **row 2 sat about 8px higher than row 1**, which read as a limp. Every frame
  is now shifted so the planted foot rests on one baseline.

Horizontal placement is untouched — the weapons skew any automatic centring,
and measuring the leg region showed the bodies were already centred to within
one world pixel.

The cycle advances on **distance travelled**, not on a timer (`perPixel` in the
manifest), so the feet cannot skate and a slower hero steps more slowly for
free. Lower `perPixel` = faster steps.

There is still no idle, jump, fall or hurt artwork: those poses reuse the most
plausible walk frame. Only `run` is a real animation.

## Still needed to match the mock-up

| Need | Why it matters |
| --- | --- |
| Hero idle / jump / fall / hurt frames | The walk cycle exists; these poses reuse a walk frame |
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

## Terrain pieces

`assets/images/terrain/level-01/` holds the cut-out art Level 1 is built from:
`ground-strip`, `ledge-wide`, `ledge-short`, `bridge-rope`, `pillar-ledge`,
`tower-arch`, `tower-balcony`.

Each is described in `js/data/Terrain.js` by where its **walkable surface**
sits inside the image:

| Field | Meaning |
| --- | --- |
| `deck` | how far down the image the walking surface is, 0..1 |
| `span` | the horizontal slice that is actually standable — not the mossy overhang |

Both were measured by profiling the longest opaque run per row, not guessed.
The files were also cropped to their `alpha > 8` bounds first: every one
carried a large invisible halo (`ground-strip` was 1672x896 with only 222 rows
of real content).

**Collision stays authoritative.** A platform in the level data keeps its own
box and names a piece; the engine scales the art so its deck lands on the box's
top edge, tiles it horizontally to fill the width, and clips it to the box so
it cannot bleed across a gap. Art conforms to the level, never the reverse. If
a piece has not loaded, the palette in `js/data/Palettes.js` draws instead, so
the level stays playable.

`props` in the level data are the same pieces with no collision — scenery to
stand in front of. They are scaled down and faded so the play space stays
readable.

### Reachability

The Tank is the constraint: 107px of jump height and only **128px of flat
reach**. Every gap in Level 1 is 110px or less, or crossed by the bridge or the
pillar shelf, and every shelf-to-shelf step is 90px or under. Verified by
walking the platform graph for all three heroes.

## Backdrop focus

Scene plates are paintings of ruins and fortresses, so they contain painted
ledges, arches and bridges. Left sharp, those read as things you could stand on
and players try to jump to them.

`Background` therefore renders each plate **out of focus** — `SCENE_BLUR`,
default 7px — which settles it into depth and leaves the real terrain as the
only thing that looks solid. The blur is applied once into a cached offscreen
canvas keyed on source and size, not per frame. Where `ctx.filter` is missing,
it falls back to a downscale-and-upscale blur, so there is no hard dependency.

Per level: `sceneDim` and `sceneBlur` in the level data.

## Level 2 terrain

Level 2 has no cut-out art. Its platforms come from the `foundry` palette in
`js/data/Palettes.js` — cold basalt, hot ember edges, embers drifting off the
surfaces. To give it real art later: drop pieces into
`assets/images/terrain/level-02/`, describe them in `Terrain.js`, and name them
on the platforms in `Level2.js`. Nothing else changes.
