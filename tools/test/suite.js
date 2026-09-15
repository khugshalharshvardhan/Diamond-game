/* Regression suite for Diamond Heroes.

   Run from the project root:   node tools/test/suite.js

   Zero dependencies and no build step - it loads index.html's scripts into a
   minimal DOM/canvas/audio shim and drives the real game loop, so it exercises
   the shipping code rather than a copy of it. */
'use strict';
const H = require('./harness.js');
const DH = H.sandbox.window.DH;
const doc = H.document;

const fails = [];
let count = 0;
function head(t) { console.log('\n=== ' + t + ' ==='); }
function test(name, fn) {
  count++;
  try { const note = fn(); console.log('  ok   ' + name + (note ? '   ' + note : '')); }
  catch (e) {
    fails.push([name, e.message]);
    console.log('  FAIL ' + name);
    console.log('       ' + e.message);
  }
}
function eq(a, b, what) { if (a !== b) throw new Error(what + ': got ' + a + ', expected ' + b); }
function ok(c, msg) { if (!c) throw new Error(msg); }

function fresh(hero, lvl) {
  const g = new DH.Game(doc.getElementById('game'));
  H.sandbox.window.DH.game = g;
  g.openMenu();
  g.pendingLevel = lvl || 1;
  g.deploy(hero || 'assault');
  return g;
}
function run(g, n) { for (let i = 0; i < n; i++) g.update(1 / 60); }
/* Hold the player still and unkillable so a test measures one thing. */
function godmode(g) { const p = g.level.player; p.invuln = 9999; p.health = p.maxHealth; return p; }

head('physics');
test('gravity pulls the player down', () => {
  const g = fresh(); const p = g.level.player;
  p.y -= 200; p.vy = 0; p.onGround = false;
  const y0 = p.y; run(g, 30);
  ok(p.y > y0, 'did not fall');
});
test('lands on a solid floor and stops', () => {
  const g = fresh(); const p = g.level.player;
  run(g, 120);
  ok(p.onGround, 'never landed');
  eq(Math.round(p.vy), 0, 'vy after landing');
});
test('does not sink through solid floor over 3000 steps', () => {
  const g = fresh(); const p = godmode(g);
  run(g, 120);                      // let the spawn drop finish first
  const y0 = p.y;
  for (let i = 0; i < 3000; i++) { p.health = p.maxHealth; g.update(1 / 60); }
  ok(p.onGround && !p.dead, 'left the floor: y=' + p.y.toFixed(1));
  ok(Math.abs(p.y - y0) < 2, 'drifted from y=' + y0.toFixed(1) + ' to ' + p.y.toFixed(1));
  return 'held at y=' + p.y.toFixed(1);
});
test('walking off a ledge into a gap is fatal', () => {
  const g = fresh(); const p = g.level.player;
  p.x = 1150;                       // the floor ends at 1210, gap to 1320
  g.input.setTouch('right', true);
  for (let i = 0; i < 400 && g.mode === 'playing'; i++) g.update(1 / 60);
  g.input.setTouch('right', false);
  ok(p.dead, 'survived the gap');
  return 'died at x=' + p.x.toFixed(0);
});
test('S+jump on SOLID ground still jumps', () => {
  const g = fresh(); const p = g.level.player;
  run(g, 60);
  p.x = 200; p.y = 500 - p.h; p.vy = 0; run(g, 10);
  const y0 = p.y;
  g.input.setTouch('down', true); g.input.setTouch('jump', true);
  run(g, 6);
  g.input.setTouch('jump', false); g.input.setTouch('down', false);
  run(g, 10);
  ok(p.y < y0 - 8, 'did not leave the ground (y ' + y0.toFixed(0) + ' -> ' + p.y.toFixed(0) + ')');
});
test('drops through a thin shelf with S+jump', () => {
  const g = fresh(); const p = g.level.player;
  const shelf = g.level.solids.find((s) => s.oneWay);
  p.x = shelf.x + shelf.w / 2; p.y = shelf.y - p.h - 2; p.vy = 0;
  run(g, 20);
  ok(p.onGround, 'did not land on the shelf');
  const y0 = p.y;
  g.input.setTouch('down', true); g.input.setTouch('jump', true);
  run(g, 6);
  g.input.setTouch('jump', false); g.input.setTouch('down', false);
  run(g, 30);
  ok(p.y > y0 + 10, 'did not drop through');
});

head('combat');
test('bullets damage an enemy', () => {
  const g = fresh(); const L = g.level; const p = godmode(g);
  const e = new DH.Enemy(p.x + 120, 500 - 38, 900, 'grunt');
  L.enemies.push(e);
  const h0 = e.health;
  p.facing = 1; p.ammo[p.pool] = 50;
  g.input.setTouch('fire', true); run(g, 90); g.input.setTouch('fire', false);
  ok(e.health < h0 || e.dead, 'enemy took no damage');
});
test('enemy bullets damage the player', () => {
  const g = fresh(); const L = g.level; const p = g.level.player;
  p.invuln = 0;
  const e = new DH.Enemy(p.x + 260, 500 - 46, 901, 'gunner');
  L.enemies.push(e);
  const h0 = p.health;
  for (let i = 0; i < 400 && p.health >= h0; i++) g.update(1 / 60);
  ok(p.health < h0, 'sniper never landed a shot');
});
test('the drone reaches the player without terrain help', () => {
  const g = fresh(); const L = g.level; const p = godmode(g);
  const e = new DH.Enemy(p.x + 400, 120, 902, 'drone');
  L.enemies.push(e);
  const d0 = Math.abs(e.cx - p.cx);
  run(g, 240);
  ok(Math.abs(e.cx - p.cx) < d0, 'drone did not close in');
});
test('boss enrages below half health', () => {
  const g = fresh(); const L = g.level;
  L.player.x = L.data.bossTrigger + 10; run(g, 120);
  ok(L.boss, 'no boss');
  L.boss.invuln = 0;
  L.boss.hurt(L.boss.maxHealth * 0.55, L.boss.cx - 10, L);
  ok(L.boss.enraged, 'did not enrage at 45% health');
});

head('progression');
test('diamonds survive death', () => {
  const g = fresh(); const p = g.level.player;
  g.addDiamonds(50);
  const d = g.state.diamonds;
  p.medkits = 0; p.invuln = 0;
  p.hurt(9999, p.cx + 10, g.level);
  run(g, 120);
  g.restartFromCheckpoint();
  eq(g.state.diamonds, d, 'diamonds after death');
});
test('a collected pickup does not respawn on death', () => {
  const g = fresh(); const L = g.level;
  const pk = L.pickups[0];
  const id = pk.id;
  pk.collect(L);
  L.pickups = L.pickups.filter((x) => !x.dead);
  g.restartFromCheckpoint();
  ok(!g.level.pickups.some((x) => x.id === id), 'collected pickup came back - farmable');
});
test('cleared enemies stay dead past a checkpoint', () => {
  const g = fresh(); const L = g.level;
  const e = L.enemies[0]; const id = e.id;
  e.hurt(9999, e.cx - 5, L);
  const cp = L.checkpoints[0];
  L._reachCheckpoint(cp);
  g.restartFromCheckpoint();
  ok(!g.level.enemies.some((x) => x.id === id), 'enemy killed before a checkpoint respawned');
});
test('enemies killed AFTER the last checkpoint do come back', () => {
  const g = fresh(); const L = g.level;
  const e = L.enemies[1]; const id = e.id;
  e.hurt(9999, e.cx - 5, L);
  g.restartFromCheckpoint();
  ok(g.level.enemies.some((x) => x.id === id), 'pending kill was wrongly committed');
});
test('clearing level 1 unlocks level 2', () => {
  const g = fresh(); const L = g.level;
  L.player.x = L.data.bossTrigger + 10; run(g, 120);
  L.boss.invuln = 0; L.boss.hurt(99999, L.boss.cx - 10, L);
  for (let i = 0; i < 600; i++) { g.level.player.health = g.level.player.maxHealth; g.update(1 / 60); }
  eq(g.mode, 'complete', 'mode');
  const s = DH.SaveManager.load();
  ok(s.unlockedLevels.indexOf(2) >= 0, 'level 2 not unlocked: ' + JSON.stringify(s.unlockedLevels));
  ok(s.completedLevels.indexOf(1) >= 0, 'level 1 not marked complete');
});

head('economy');
test('buying deducts exactly once', () => {
  const g = fresh(); g.state.diamonds = 200;
  g.buyWeapon('pistol');
  eq(g.state.diamonds, 160, 'balance after a 40 purchase');
});
test('buying the same weapon twice is refused', () => {
  const g = fresh(); g.state.diamonds = 500;
  g.buyWeapon('pistol');
  const before = g.state.diamonds;
  eq(g.buyWeapon('pistol'), 'owned', 'second purchase');
  eq(g.state.diamonds, before, 'balance unchanged');
});
test('ammo pools do not leak between weapons', () => {
  let g = fresh(); g.state.diamonds = 500;
  g.buyWeapon('shotgun');
  g = fresh();
  const p = g.level.player;
  p.ammo.shotgun = 5; p.ammo.cell = 50;
  p.selectSlot(p.weapons.indexOf('shotgun'), g.level);
  const cell0 = p.ammo.cell;
  g.input.setTouch('fire', true); run(g, 120); g.input.setTouch('fire', false);
  eq(p.ammo.cell, cell0, 'cell pool changed while firing the shotgun');
});
test('upgrades actually change the hero', () => {
  const g = fresh(); g.state.diamonds = 999;
  g.buyUpgrade('health'); g.buyUpgrade('damage');
  const g2 = fresh();
  eq(g2.level.player.maxHealth, DH.HEROES.assault.health + 10, 'max health with Health L1');
  ok(g2.level.player.curDamage() > DH.HEROES.assault.damage, 'damage not raised');
});
test('diamonds carry into the next run', () => {
  let g = fresh(); g.addDiamonds(200); g.saveProgress();
  g = fresh();
  ok(g.state.diamonds >= 200, 'diamonds reset to ' + g.state.diamonds);
});

head('stability');
test('particles stay capped', () => {
  const g = fresh(); const L = g.level;
  for (let i = 0; i < 4000; i++) L.fx.burst(100, 100, 12, { speed: 200, life: 3, size: 3, color: '#fff' });
  ok(L.fx.list.length <= L.fx.limit, 'particle list grew to ' + L.fx.list.length);
  return 'capped at ' + L.fx.list.length;
});
test('bullets are reaped', () => {
  const g = fresh(); const p = godmode(g);
  p.ammo[p.pool] = 9999;
  g.input.setTouch('fire', true); run(g, 600); g.input.setTouch('fire', false);
  run(g, 240);
  ok(g.level.bullets.length < 60, 'bullets accumulated: ' + g.level.bullets.length);
  return g.level.bullets.length + ' alive';
});
test('a long session does not leak entities', () => {
  const g = fresh(); godmode(g);
  const L = g.level;
  for (let i = 0; i < 6000; i++) {
    g.input.setTouch('right', i % 300 < 200);
    g.input.setTouch('fire', i % 7 === 0);
    g.update(1 / 60);
  }
  g.input.setTouch('right', false); g.input.setTouch('fire', false);
  ok(L.bullets.length < 80, 'bullets ' + L.bullets.length);
  ok(L.fx.list.length <= L.fx.limit, 'particles ' + L.fx.list.length);
  return 'bullets ' + L.bullets.length + ', particles ' + L.fx.list.length + ', enemies ' + L.enemies.length;
});
test('camera stays inside the level bounds', () => {
  const g = fresh(); const L = g.level; const p = godmode(g);
  p.x = -500; run(g, 60);
  ok(g.camera.x >= -1, 'camera went left of 0: ' + g.camera.x.toFixed(1));
  p.x = L.data.width + 500; run(g, 60);
  ok(g.camera.x <= L.data.width, 'camera went past the level end');
});

head('levels');
[1, 2].forEach((id) => {
  test('level ' + id + ' data is complete', () => {
    const e = DH.levelById(id);
    ok(e && e.data, 'no data');
    ['width', 'height', 'deathY', 'spawn', 'reward', 'platforms', 'enemies',
     'pickups', 'checkpoints', 'bossTrigger', 'gate', 'arena', 'boss']
      .forEach((k) => ok(e.data[k] !== undefined, 'missing ' + k));
    e.data.enemies.forEach((en, i) => ok(DH.ENEMIES[en.kind], 'enemy ' + i + ' has unknown kind ' + en.kind));
  });
  test('level ' + id + ' plays through without throwing', () => {
    const g = fresh('scout', id); const p = godmode(g);
    for (let i = 0; i < 3000; i++) { p.health = p.maxHealth; g.input.setTouch('right', true); g.update(1 / 60); g.render(); }
    g.input.setTouch('right', false);
    return 'reached x=' + p.x.toFixed(0) + ' of ' + g.level.data.width;
  });
});

head('RESULT');
console.log('  ' + (count - fails.length) + '/' + count + ' passed');
if (fails.length) { console.log('\n  FAILURES:'); fails.forEach((f) => console.log('   - ' + f[0] + '\n     ' + f[1])); }
process.exit(fails.length ? 1 : 0);
