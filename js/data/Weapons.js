/* Weapons — what the shop sells and what the player shoots with. Pure data.

   Weapons are MULTIPLIERS on the hero, not replacements for them. A Scout with
   a rifle is still a Scout: fast, fragile, high rate of fire. That keeps the
   hero choice meaningful after the first purchase instead of flattening every
   hero into whatever gun they happen to be holding.

     final damage   = hero.damage   x weapon.damageMul   x upgrades x ability
     final delay    = hero.fireRate x weapon.fireRateMul x ability

   `pellets` above 1 fires a cone — the shotgun's whole identity. Its per-pellet
   damage is low, so it is devastating point blank and nearly useless at range,
   which is the trade the player is buying.

   Each weapon draws from a named ammo pool. Pools are shared across weapons
   that use the same type, and the shop sells them separately. */
window.DH = window.DH || {};
(function (DH) {
  'use strict';

  DH.AMMO_TYPES = {
    cell:    { name: 'Energy Cell', max: 60 },
    pistol:  { name: 'Pistol Ammo', max: 60 },
    shotgun: { name: 'Shotgun Shells', max: 30 },
    rifle:   { name: 'Rifle Ammo', max: 90 }
  };

  DH.WEAPONS = {
    /* Free, owned from the first run. Deliberately unremarkable: it is the
       baseline everything else is measured against. */
    blaster: {
      id: 'blaster',
      name: 'Basic Blaster',
      blurb: 'Standard issue. Reliable and balanced.',
      icon: 'wpnPistol',
      price: 0,
      starter: true,
      ammoType: 'cell',
      damageMul: 1.0,
      fireRateMul: 1.0,
      speedMul: 1.0,
      pellets: 1,
      spread: 0,
      sizeMul: 1.0,
      color: '#7fe6ff',
      sound: 'shoot'
    },

    pistol: {
      id: 'pistol',
      name: 'Basic Pistol',
      blurb: 'Reliable and balanced.',
      icon: 'wpnPistol',
      price: 40,
      ammoType: 'pistol',
      damageMul: 1.25,
      fireRateMul: 0.95,
      speedMul: 1.05,
      pellets: 1,
      spread: 0,
      sizeMul: 1.0,
      color: '#ffd86b',
      sound: 'shoot'
    },

    shotgun: {
      id: 'shotgun',
      name: 'Shotgun',
      blurb: 'High damage, short range.',
      icon: 'wpnShotgun',
      price: 80,
      ammoType: 'shotgun',
      damageMul: 0.55,
      fireRateMul: 2.0,
      speedMul: 0.8,
      pellets: 5,
      spread: 0.30,
      /* Short-lived pellets are what makes it short range, not a damage
         falloff rule nobody can see. */
      life: 0.34,
      sizeMul: 0.8,
      color: '#ff9d5c',
      sound: 'shootHeavy'
    },

    rifle: {
      id: 'rifle',
      name: 'Assault Rifle',
      blurb: 'High fire rate, medium damage.',
      icon: 'wpnRifle',
      price: 120,
      ammoType: 'rifle',
      damageMul: 0.8,
      fireRateMul: 0.5,
      speedMul: 1.15,
      pellets: 1,
      spread: 0.035,
      sizeMul: 0.85,
      color: '#c8f06b',
      sound: 'shoot'
    }
  };

  /* Shop order, and the order the number keys select. */
  DH.WEAPON_ORDER = ['blaster', 'pistol', 'shotgun', 'rifle'];

  /* Ammo the shop sells, matching the packs in the design. */
  DH.AMMO_PACKS = [
    { id: 'pistolPack',  type: 'pistol',  amount: 20, price: 15, icon: 'ammoPistol' },
    { id: 'shotgunPack', type: 'shotgun', amount: 10, price: 25, icon: 'ammoShotgun' },
    { id: 'riflePack',   type: 'rifle',   amount: 30, price: 35, icon: 'ammoRifle' }
  ];

  /* Consumables. The medkit spends itself to stop a killing blow, so it is
     worth buying before a boss rather than being a heal you forget to press. */
  DH.SUPPLIES = [
    {
      id: 'medkit',
      name: 'Medkit',
      blurb: 'Survives one killing blow and revives you at half health.',
      icon: 'itemHealth',
      price: 60,
      max: 3
    }
  ];

  DH.weaponDef = function (id) {
    return DH.WEAPONS[id] || DH.WEAPONS.blaster;
  };

  /* Full magazines for a fresh run: the starter pool filled, the rest empty. */
  DH.startingAmmo = function () {
    return { cell: DH.AMMO_TYPES.cell.max, pistol: 0, shotgun: 0, rifle: 0 };
  };
})(window.DH);
