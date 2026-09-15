# Tests

```bash
node tools/test/suite.js
```

No dependencies, no build step, nothing to install beyond Node itself — which
is why this can live in a project whose whole point is running from `file://`.

`harness.js` loads the scripts listed in `index.html` into a minimal DOM,
canvas and audio shim, then `suite.js` drives the **real game loop**: it
deploys heroes, walks them, fires, kills enemies, dies, respawns, fights the
boss, buys from the shop, and saves and reloads. It exercises the shipping
code, not a copy of it.

Also worth running after any edit:

```bash
node --check js/core/Game.js      # or any single file
```

That catches the class of syntax error — a stray comma after a class method,
a duplicate object key — that silently discards a whole file and leaves the
game on a blank screen.
