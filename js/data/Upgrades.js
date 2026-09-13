/* Upgrades — what the shop sells. Pure data.

   Three tracks, three levels each, matching the design doc. Each level states
   the TOTAL effect at that level, not an increment on the one before, so the
   numbers here read exactly as the shop prints them and there is no compounding
   to reason about.

   Costs rise steeply enough that a track is a real decision rather than
   something you buy on the way past.

   Stored in the save as { damage: 2, health: 1 } — the level owned per track,
   absent meaning none. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  DH.UPGRADES = {
    damage: {
      id: 'damage',
      name: 'Damage',
      icon: 'upgradeDamage',
      blurb: 'Every shot hits harder.',
      levels: [
        { cost: 60,  label: '+5% damage',  damageMul: 1.05 },
        { cost: 150, label: '+10% damage', damageMul: 1.10 },
        { cost: 300, label: '+20% damage', damageMul: 1.20 }
      ]
    },
    health: {
      id: 'health',
      name: 'Health',
      icon: 'upgradeHealth',
      blurb: 'Raises your maximum health.',
      levels: [
        { cost: 50,  label: '+10 health', healthAdd: 10 },
        { cost: 130, label: '+20 health', healthAdd: 20 },
        { cost: 270, label: '+30 health', healthAdd: 30 }
      ]
    },
    speed: {
      id: 'speed',
      name: 'Speed',
      icon: 'upgradeSpeed',
      blurb: 'Move and reposition faster.',
      levels: [
        { cost: 55,  label: '+5% speed',  speedMul: 1.05 },
        { cost: 140, label: '+10% speed', speedMul: 1.10 },
        { cost: 285, label: '+15% speed', speedMul: 1.15 }
      ]
    }
  };

  DH.UPGRADE_ORDER = ['damage', 'health', 'speed'];

  /* Collapse an owned-levels map into the numbers the Player actually applies.
     One place does this, so the shop's promise and the hero's stats can never
     disagree. */
  DH.upgradeEffect = function (owned) {
    const out = { damageMul: 1, healthAdd: 0, speedMul: 1 };
    if (!owned) return out;

    DH.UPGRADE_ORDER.forEach(function (key) {
      const track = DH.UPGRADES[key];
      const level = owned[key] || 0;
      if (level <= 0) return;
      const step = track.levels[Math.min(level, track.levels.length) - 1];
      if (step.damageMul) out.damageMul = step.damageMul;
      if (step.healthAdd) out.healthAdd = step.healthAdd;
      if (step.speedMul) out.speedMul = step.speedMul;
    });
    return out;
  };

  /* The next purchasable step on a track, or null when it is maxed. */
  DH.nextUpgrade = function (key, owned) {
    const track = DH.UPGRADES[key];
    const level = (owned && owned[key]) || 0;
    if (!track || level >= track.levels.length) return null;
    return { level: level + 1, step: track.levels[level] };
  };
})(window.DH);
