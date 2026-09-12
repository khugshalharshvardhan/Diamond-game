# Project instructions for the coding assistant

## Current deliverable

This folder is an extracted PNG asset library, not a completed game. `preview.html` is an asset browser, not the game. Read `README.md` and `assets.json` before making changes.

## Use the provided files

- Treat `assets.json` as the source of truth for asset IDs, paths, native sizes, alpha treatment, and quality notes. File paths are relative to this folder.
- Use the individual PNGs under `assets/`. Do not crop the original board again in the browser or use a whole screen reference as an interactive game UI.
- Preserve this pack's filenames unless the user explicitly asks to rename them. Keep gameplay code in its own files so the asset browser remains usable.
- `upscaled-4x/` duplicates the artwork at four times the pixel dimensions. It does not add detail. Render with intentional logical dimensions, preserving aspect ratio.
- The original reference and screen crops are under `references/`. They are visual guidance only. They still contain flattened UI, text, characters, and scene overlays.

## Available art

Heroes: Assault, Tank, Scout. Enemies: Goblin, Sniper, Robot, Flying Drone, Dark Colossus. Companion: a clean circular portrait and an extremely small approximate idle cutout.

Main weapons: Pistol, Shotgun, Assault Rifle, Sniper Rifle, Rocket Launcher, Sword. Additional shop variants are separate icon drawings, not extra weapon types.

Main pickups: Diamond, Health Pack, Ammo Box, Power Up, Shield, Key. Additional ammo drawings are also included.

Interface: menu buttons; shop tabs and buy button; circular controls; hero-stat and upgrade icons; rewards; static bars; HUD samples; hero cards; inventory slots; map nodes; dialogue label/box; settings controls; logo.

## Do not invent missing art

The original image supplies a single static full-body pose for each main character. There are no walking, jumping, attack, damage, or death animation cycles. Guns held by characters are baked into their poses and cannot be removed as separate layers. There are no complete clean level backgrounds or modular terrain tiles in this pack.

For a prototype, movement can translate the supplied static sprite. Facing can be flipped by code where visually appropriate. Do not describe this as a real walking animation. Tell the user which additional art is needed for production. A placeholder background or a newly drawn shape must be clearly distinguished from original extracted art.

## Keep the implementation editable

Render dialogue, labels, prices, stats, health numbers, currency totals, cooldowns, and changing progress in HTML/CSS or canvas text. Button/card PNG text is baked into the image; editing a string in JavaScript will not change those pixels. Do not place duplicate text over an already labeled button without an explicit design decision.

Separate asset paths, game data, input logic, state transitions, and rendering. Define collision boxes separately from transparent image bounds. Use the manifest pivot only as a starting point. Preserve all image proportions and avoid stretching small native sprites across large screens.

Load assets with error handling. Show a clear missing-asset message rather than leaving a blank rectangle. Check that all paths exist. Prefer relative paths and no external network dependencies for the initial prototype.

Support keyboard controls and semantic accessible buttons for menus; add touch controls only where requested or appropriate to the game. Give buttons visible focus states. Do not put screenshots on top of functioning controls as a substitute for building the interface.

## Quality flags

- `source-resolution`: extracted artwork at its available native detail.
- `tiny-source`: extremely small companion pose; approximate edge and unsuitable for large close-ups.
- `approximate-edge`: manually guided extraction from illustrated scenery.
- `reference-state`: a baked UI state or map component that may keep source-background pixels.
- `reference-only`: complete flattened reference image, not a clean asset layer.

The companion portrait retains its illustrated interior background on purpose. Portrait busts are rectangular crops, not transparent character cutouts. Some items retain soft glow transparency.

## Before reporting a game change as complete

Check asset loading, path case, image aspect ratios, keyboard operation, visible button states, and responsive layout. Confirm that displayed stats come from code rather than frozen screenshot values. Do not claim that missing animation frames, clean backgrounds, or layered source artwork have been provided.

## Extraction tooling

`tools/extraction-config.json` records the original rectangles and mask modes. `tools/export_assets.py` can regenerate the PNGs from `references/source-overview.png`. It requires Pillow, NumPy, SciPy, and OpenCV. Regeneration updates PNGs and `assets.json`, but not the embedded manifest in `preview.html`; rebuild that page's data separately if the inventory changes.
