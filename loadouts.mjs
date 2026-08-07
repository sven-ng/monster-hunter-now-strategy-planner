import { calculateFinalLoadoutStats, classifyBuildVsMonster, getGearAtGrade, getRequiredParts } from "./planner.mjs?v=2026-08-07-skill-rename-refresh";
import { applyDriftsmeltSkills, normalizeActiveDriftsmeltSkills } from "./driftsmelt.mjs?v=2026-08-07-skill-rename-refresh";
import { applyWeaponStyleProfile } from "./weapon-style.mjs?v=2026-08-07-skill-rename-refresh";

export function createLoadout({
  id,
  name,
  weaponId,
  armorIds,
  gearProgress = {},
  gearGrades = {},
  driftsmeltSkills = {},
  activeDriftsmeltSkills = driftsmeltSkills,
  driftsmeltSkillPools = {},
  weaponStyleProfiles = {},
  origin = "manual",
  data,
}) {
  const weapon = data.weapons.find((item) => item.id === weaponId);
  const parts = getRequiredParts(data);
  const armor = parts.map((part) => data.armor.find((item) => item.id === armorIds[part]));

  if (!name?.trim() || !weapon || armor.some((piece) => !piece)) {
    return null;
  }

  const selectedIds = [weapon.id, ...armor.map((piece) => piece.id)];
  return {
    id,
    name: name.trim(),
    weaponId: weapon.id,
    armorIds: Object.fromEntries(armor.map((piece) => [piece.part, piece.id])),
    gearProgress: Object.fromEntries(selectedIds.map((gearId) => [
      gearId,
      normalizeProgress(gearProgress[gearId], gearGrades[gearId]),
    ])),
    driftsmeltSkills: Object.fromEntries(armor.map((piece) => {
      const progress = normalizeProgress(gearProgress[piece.id], gearGrades[piece.id]);
      const atGrade = getGearAtGrade(piece, progress.grade, progress.level);
      const selectedSkills = activeDriftsmeltSkills[piece.id] ?? driftsmeltSkills[piece.id];
      const skillPool = driftsmeltSkillPools[piece.id] ?? selectedSkills;
      return [piece.id, normalizeActiveDriftsmeltSkills(selectedSkills, atGrade.driftsmeltSlots, skillPool)];
    })),
    weaponStyleProfile: weaponStyleProfiles[weapon.id] ?? null,
    origin,
    createdAt: new Date().toISOString(),
  };
}

export function createLoadoutFromBuild({ id, name, build, data, origin = "suggested" }) {
  return createLoadout({
    id,
    name,
    weaponId: build.weapon.id,
    armorIds: Object.fromEntries(build.armor.map((piece) => [piece.part, piece.id])),
    gearProgress: Object.fromEntries([build.weapon, ...build.armor].map((gear) => [
      gear.id,
      { grade: gear.grade, level: gear.level },
    ])),
    activeDriftsmeltSkills: Object.fromEntries(build.armor.map((piece) => [piece.id, piece.driftsmeltSkills ?? []])),
    weaponStyleProfiles: build.weapon?.styleProfile ? { [build.weapon.id]: build.weapon.styleProfile } : {},
    origin,
    data,
  });
}

export function updateLoadoutGearProgress(loadout, gearId, progress) {
  if (!loadout.gearProgress?.[gearId] || !Number.isInteger(progress?.grade) || !Number.isInteger(progress?.level)) {
    return loadout;
  }
  return {
    ...loadout,
    gearProgress: {
      ...loadout.gearProgress,
      [gearId]: { grade: progress.grade, level: progress.level },
    },
  };
}

export function replaceLoadout(loadouts, updatedLoadout) {
  return loadouts.map((loadout) => loadout.id === updatedLoadout.id ? updatedLoadout : loadout);
}

export function hydrateLoadout(loadout, data, { weaponStyleProfiles = {} } = {}) {
  const weapon = data.weapons.find((item) => item.id === loadout.weaponId);
  const armor = getRequiredParts(data).map((part) => data.armor.find((item) => item.id === loadout.armorIds[part]));
  if (!weapon || armor.some((piece) => !piece)) {
    return null;
  }

  const styleProfile = weaponStyleProfiles[weapon.id] ?? loadout.weaponStyleProfile;

  return {
    weapon: applyWeaponStyleProfile(
      getGearAtGrade(weapon, progressFor(loadout, weapon.id).grade, progressFor(loadout, weapon.id).level),
      styleProfile,
    ),
    armor: armor.map((piece) => applyDriftsmeltSkills(
      getGearAtGrade(piece, progressFor(loadout, piece.id).grade, progressFor(loadout, piece.id).level),
      loadout.driftsmeltSkills?.[piece.id],
    )),
  };
}

export function evaluateLoadout(loadout, { data, targetStars, assumeWeakPoint = false, weaponStyleProfiles = {} }) {
  const build = hydrateLoadout(loadout, data, { weaponStyleProfiles });
  if (!build) {
    return [];
  }

  return data.monsters
    .map((monster) => ({
      monster,
      result: classifyBuildVsMonster(build, monster, targetStars),
      damage: calculateFinalLoadoutStats(build, { monster, assumeWeakPoint }),
    }))
    .sort((left, right) => effectivenessRank(left.result) - effectivenessRank(right.result) || left.monster.name.localeCompare(right.monster.name));
}

export function evaluateSavedLoadouts(loadouts, {
  data,
  targetMonsterId,
  targetStars,
  assumeWeakPoint = false,
  weaponStyleProfiles = {},
}) {
  const targetMonster = data.monsters.find((monster) => monster.id === targetMonsterId) ?? data.monsters[0];
  return loadouts
    .map((loadout) => {
      const build = hydrateLoadout(loadout, data, { weaponStyleProfiles });
      if (!build) return null;
      const damage = calculateFinalLoadoutStats(build, { monster: targetMonster, assumeWeakPoint });
      return {
        ...build,
        damage,
        targetMonster,
        targetStars,
        savedLoadoutId: loadout.id,
        savedLoadoutName: loadout.name,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.damage.referenceDamage - left.damage.referenceDamage || right.damage.defense - left.damage.defense);
}

function effectivenessRank(result) {
  return { easy: 0, fair: 1, hard: 2 }[result.tier] ?? 3;
}

function progressFor(loadout, gearId) {
  return normalizeProgress(loadout.gearProgress?.[gearId], loadout.gearGrades?.[gearId]);
}

function normalizeProgress(progress, legacyGrade) {
  if (typeof progress === "object" && progress && Number.isInteger(progress.grade)) {
    return { grade: progress.grade, level: Number.isInteger(progress.level) ? progress.level : undefined };
  }
  return { grade: Number.isInteger(legacyGrade) ? legacyGrade : undefined, level: undefined };
}
