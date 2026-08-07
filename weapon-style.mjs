const STYLE_LEVEL_MIN = 0;
const STYLE_LEVEL_MAX = 5;

export function isRiftborneMaterial(material) {
  return Boolean(material?.id?.includes("_riftborne_material"));
}

export function monsterHasRiftborne(monster, materialById = {}) {
  return Boolean(monster?.drops?.some((dropId) => isRiftborneMaterial(materialById[dropId] ?? { id: dropId })));
}

export function weaponSupportsStyle(weapon, monsterById = {}, materialById = {}) {
  if (!weapon?.sourceMonsterId) {
    return false;
  }
  return monsterHasRiftborne(monsterById[weapon.sourceMonsterId], materialById);
}

export function normalizeWeaponStyleProfile(profile = {}) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return defaultWeaponStyleProfile();
  }

  return {
    styleName: typeof profile.styleName === "string" ? profile.styleName.trim().slice(0, 80) : "",
    styleLevel: clampInteger(profile.styleLevel, STYLE_LEVEL_MIN, STYLE_LEVEL_MAX, 0),
    rawBonus: clampInteger(profile.rawBonus, -9999, 9999, 0),
    affinityBonus: clampInteger(profile.affinityBonus, -100, 100, 0),
    elementBonus: clampInteger(profile.elementBonus, -9999, 9999, 0),
    notes: typeof profile.notes === "string" ? profile.notes.trim().slice(0, 280) : "",
  };
}

export function defaultWeaponStyleProfile() {
  return {
    styleName: "",
    styleLevel: 0,
    rawBonus: 0,
    affinityBonus: 0,
    elementBonus: 0,
    notes: "",
  };
}

export function hasWeaponStyleBonus(profile) {
  const normalized = normalizeWeaponStyleProfile(profile);
  return Boolean(
    normalized.styleName
    || normalized.styleLevel
    || normalized.rawBonus
    || normalized.affinityBonus
    || normalized.elementBonus
    || normalized.notes,
  );
}

export function applyWeaponStyleProfile(weapon, profile) {
  const normalized = normalizeWeaponStyleProfile(profile);
  if (!weapon) {
    return weapon;
  }

  return {
    ...weapon,
    attack: (weapon.attack ?? 0) + normalized.rawBonus,
    affinity: (weapon.affinity ?? 0) + normalized.affinityBonus,
    element: weapon.element
      ? { ...weapon.element, value: Math.max(0, (weapon.element.value ?? 0) + normalized.elementBonus) }
      : weapon.element,
    styleProfile: normalized,
  };
}

export function riftborneBadgeLabel(weapon, monsterById = {}, materialById = {}) {
  return weaponSupportsStyle(weapon, monsterById, materialById) ? "Style customizable" : "";
}

function clampInteger(value, minimum, maximum, fallback) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(normalized)));
}
