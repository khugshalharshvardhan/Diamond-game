# Diamond Heroes

A 2D side-scrolling action game in vanilla JavaScript and HTML5 Canvas.
No frameworks, no build step, no external assets — every sprite is drawn with
canvas primitives at runtime.

**Run it:** open `index.html` in a browser. That's the whole setup.

## Controls

| Action | Keys |
| --- | --- |
| Move | `A` `D` or arrow keys |
| Jump | `Space` or `W` — hold for height, tap for a short hop |
| Drop through a thin platform | `S` + jump |
| Fire | `J`, `K` or `Enter` |
| Pause | `Esc` or `P` |

## What's in this build

Main menu, hero select, three playable heroes, side-scrolling movement with
coyote time and jump buffering, shooting, one enemy type, diamonds and health
pickups, three checkpoints, one full level, a three-attack boss with a second
phase, win and lose states, and progress saved to localStorage.

## Architecture

Scripts are classic (non-module) files on a single `DH` namespace so the game
runs from `file://` without a local server. Each file maps one-to-one onto what
would be an ES module, so the conversion is mechanical when a bundler arrives.

```
js/core       loop, input, physics, camera, particles
js/entities   player, enemy, boss, bullet, pickup, companion
js/world      level, checkpoint, parallax background
js/data       hero stats and level layouts — pure data
js/systems    save manager, DOM interface manager
```

Adding level 2 means writing `js/data/Level2.js`. It should not require
touching anything in `js/core` or `js/entities`.

## Next

Shop and inventory · purchasable weapons and ammo · upgrades · the rescued
companion in combat · levels 2 and 3 · story screens · sound.
