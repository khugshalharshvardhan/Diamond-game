# Diamond Heroes

A 2D side-scrolling action platformer in vanilla JavaScript and HTML5 Canvas.
No framework, no build step, no backend.

**Run it:** open `index.html`. That is the whole setup — it works from
`file://` as well as from a server.

## Controls

| Action | Keys |
| --- | --- |
| Move | `A` `D` or arrow keys |
| **Fire** | **`Space`**, `J`, `K` or `Enter` |
| Jump | `W` or up arrow — hold for height, tap for a short hop |
| Drop through a thin platform | `S` + jump |
| Ability | `Shift` or `L` |
| Pause | `Esc` or `P` |
| Fullscreen | `F` |

Space is deliberately not also bound to jump: one key doing two things means
every shot is a hop.

There are on-screen controls too — move left/right at the bottom left, fire and
jump at the bottom right. They drive the same actions as the keys.

## Project layout

```
index.html            the only HTML file
css/                  one stylesheet per area of the interface
js/                   all game code, one concern per folder
assets/               everything the game loads at runtime
docs/                 specs and source material — not shipped
```

### css/

Loaded in the order listed in `index.html`. Only `tokens-and-base.css`
defines custom properties; every other file consumes them.

| File | Covers |
| --- | --- |
| `tokens-and-base.css` | Colour tokens, reset, the 16:9 play frame |
| `screens.css` | Shared overlay chrome, headings, buttons, cards |
| `hud.css` | Vitals, diamond purse, boss bar, toast, hint |
| `ability-meter.css` | Ability cooldown meter |
| `fullscreen.css` | Fullscreen toggle |
| `toggles.css` | On/off rows, shared by pause and settings |
| `title-screen.css` | The cover plate and its controls |
| `hero-select.css` | Character select cards |
| `world-map.css` | Route, nodes, counters |
| `panels.css` | Shop and settings |
| `accessibility.css` | High contrast, reduced motion |

### js/

Classic scripts on a single `DH` namespace, so the game runs from `file://`
with no bundler. Each file maps one-to-one onto what would be an ES module.

| Folder | Holds |
| --- | --- |
| `core/` | Loop, input, physics, camera, particles, sprite |
| `entities/` | Player, enemy, boss, bullet, pickup, companion, hero art |
| `world/` | Level, checkpoint, background |
| `data/` | Heroes, enemies, levels, terrain, upgrades, art manifest, palettes, sounds — **pure data, no logic** |
| `systems/` | Save, audio, interface |
| `vendor/` | GSAP, vendored rather than linked from a CDN |

Adding a level means writing `js/data/Level2.js` and listing it in
`js/data/Levels.js`. It should not require touching `core/` or `entities/`.

### assets/

```
assets/images/backgrounds/    one full-scene plate per location
assets/images/branding/       title screen, logo
assets/images/characters/     heroes (walk sheets + static), enemies, companion
assets/images/portraits/      card and inventory busts
assets/images/terrain/        platform and prop pieces, per level
assets/images/items/          pickups
assets/images/weapons/        weapon icons
assets/images/ui/             interface art, grouped by role
assets/audio/                 empty on purpose — see the README inside
```

**Every image path lives in `js/data/Art.js` and nowhere else.** Moving or
renaming art means editing that one file.

## Docs

- `docs/art-pipeline.md` — what the art provides, what it does not, and how to
  add sprite sheets
- `docs/asset-pack/` — the original asset pack's manifest, catalogue, browser
  and source boards. Reference only; the game does not read from it.

## Enemies

Four types, each a different fight rather than the same one with new numbers.
Defined in `js/data/Enemies.js`; `behaviour` picks the state machine.

| Type | Behaviour | What makes it different |
| --- | --- | --- |
| Goblin | `melee` | Patrols, telegraphs, charges. Contact damage — counter is spacing |
| Sniper | `ranged` | Holds a standoff and shoots; **backs away** if you close |
| Robot | `brute` melee | 130 HP and slow. Soaks a magazine |
| Flying Drone | `flyer` | Ignores gravity and geometry, hovers above you and fires down |

Level data places them by the **surface** they stand on; `Level` derives the
box from the type's height, so moving one never means recomputing an offset.
Flyers take their `y` as an altitude instead.

Levels declare `stages` — an x position and a label — which announce as the
player crosses them, so a level reads as a sequence of fights. Purely
presentational; nothing gates on it.
