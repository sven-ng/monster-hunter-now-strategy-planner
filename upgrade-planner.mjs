import { calculateFinalLoadoutStats, getGearAtGrade, recommendedGradeForStars } from "./planner.mjs?v=2026-08-06-4be9116";
import { hydrateLoadout } from "./loadouts.mjs?v=2026-08-06-4be9116";

export function getNextGearUpgrade(gear) {
  const gradeIndex = gear.gradeOptions.findIndex((option) => option.grade === gear.grade);
  const gradeOption = gear.gradeOptions[gradeIndex];
  if (!gradeOption) return null;

  const levelIndex = gradeOption.levels.findIndex((option) => option.level === gear.level);
  if (levelIndex >= 0 && levelIndex < gradeOption.levels.length - 1) {
    return { grade: gear.grade, level: gradeOption.levels[levelIndex + 1].level };
  }

  const nextGrade = gear.gradeOptions[gradeIndex + 1];
  return nextGrade ? { grade: nextGrade.grade, level: nextGrade.levels[0].level } : null;
}

export function buildUpgradePlan({ loadout, data, targetMonsterId, targetStars, assumeWeakPoint = false }) {
  const build = hydrateLoadout(loadout, data);
  const targetMonster = data.monsters.find((monster) => monster.id === targetMonsterId) ?? data.monsters[0];
  if (!build) return null;

  const currentStats = calculateFinalLoadoutStats(build, { monster: targetMonster, assumeWeakPoint });
  const entries = [
    createUpgradeEntry({ kind: "weapon", gear: build.weapon, build, data, targetMonster, targetStars, assumeWeakPoint, currentStats }),
    ...build.armor.map((gear) => createUpgradeEntry({ kind: "armor", gear, build, data, targetMonster, targetStars, assumeWeakPoint, currentStats })),
  ].filter(Boolean).sort((left, right) => right.priority - left.priority || right.damageGain - left.damageGain || right.defenseGain - left.defenseGain);

  return {
    loadoutName: loadout.name,
    build,
    targetMonster,
    targetStars,
    currentStats,
    upgrades: entries,
    monsterFocus: groupMonsterFocus(entries, data),
  };
}

function createUpgradeEntry({ kind, gear, build, data, targetMonster, targetStars, assumeWeakPoint, currentStats }) {
  const nextProgress = getNextGearUpgrade(gear);
  if (!nextProgress) return null;

  const nextGear = getGearAtGrade(gear, nextProgress.grade, nextProgress.level);
  const nextBuild = kind === "weapon"
    ? { weapon: nextGear, armor: build.armor }
    : { weapon: build.weapon, armor: build.armor.map((piece) => piece.id === gear.id ? nextGear : piece) };
  const nextStats = calculateFinalLoadoutStats(nextBuild, { monster: targetMonster, assumeWeakPoint });
  const damageGain = nextStats.referenceDamage - currentStats.referenceDamage;
  const defenseGain = nextStats.defense - currentStats.defense;
  const newSkills = nextGear.skills.filter((skill) => (gear.skills.find((current) => current.name === skill.name)?.level ?? 0) < skill.level);
  const requiredGrade = recommendedGradeForStars(targetStars);
  const weaponReadinessGap = kind === "weapon" ? Math.max(0, requiredGrade - gear.grade) : 0;

  return {
    kind,
    gear,
    nextGear,
    sourceMonsterId: gear.sourceMonsterId,
    damageGain,
    defenseGain,
    newSkills,
    priority: damageGain * 100 + defenseGain + weaponReadinessGap * 1000 + (kind === "weapon" ? 400 : 0),
  };
}

function groupMonsterFocus(entries, data) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.sourceMonsterId ?? "gatherable";
    const current = groups.get(key) ?? { sourceMonsterId: entry.sourceMonsterId, upgrades: [], priority: 0 };
    current.upgrades.push(entry);
    current.priority += Math.max(entry.priority, 0);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      monster: group.sourceMonsterId ? data.monsters.find((monster) => monster.id === group.sourceMonsterId) : null,
    }))
    .sort((left, right) => right.priority - left.priority);
}
