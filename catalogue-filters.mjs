import { canonicalSkillName } from "./skill-utils.mjs?v=2026-08-09-skill-bulk-sync";
import { isRiftborneMaterial, monsterHasRiftborne, weaponSupportsStyle } from "./weapon-style.mjs?v=2026-08-07-loadout-preview";

export function filterWeapons(items, filters, favorites = new Set(), forgedGear = new Set(), context = {}) {
  return items.filter((weapon) => {
    const query = filters.query?.toLowerCase() ?? "";
    const searchText = `${weapon.name} ${weapon.type} ${weapon.element?.type ?? "None"} ${weapon.sourceMonsterId ?? ""}`.toLowerCase();
    return (!query || searchText.includes(query))
      && (filters.type === "all" || weapon.type === filters.type)
      && (filters.element === "all" || (weapon.element?.type ?? "None") === filters.element)
      && (filters.monster === "all" || weapon.sourceMonsterId === filters.monster)
      && (!filters.styleOnly || weaponSupportsStyle(weapon, context.monsterById, context.materialById))
      && (!filters.favoritesOnly || favorites.has(weapon.id))
      && (!filters.forgedOnly || forgedGear.has(weapon.id));
  });
}

export function filterArmor(items, filters, favorites = new Set(), forgedGear = new Set()) {
  return items.filter((piece) => {
    const query = filters.query?.toLowerCase() ?? "";
    const searchText = `${piece.name} ${piece.part} ${piece.skills.map((skill) => canonicalSkillName(skill.name)).join(" ")} ${piece.sourceMonsterId ?? ""}`.toLowerCase();
    return (!query || searchText.includes(query))
      && (filters.skill === "all" || piece.skills.some((skill) => canonicalSkillName(skill.name) === filters.skill))
      && (filters.monster === "all" || piece.sourceMonsterId === filters.monster)
      && (filters.driftsmeltSlots === "all" || driftsmeltSlotCount(piece) === Number(filters.driftsmeltSlots))
      && (!filters.favoritesOnly || favorites.has(piece.id))
      && (!filters.forgedOnly || forgedGear.has(piece.id));
  });
}

export function driftsmeltSlotCount(piece) {
  if (Number.isInteger(piece.driftsmeltSlots)) {
    return piece.driftsmeltSlots;
  }

  const grade = Number(piece.grade);
  const gradeOption = piece.gradeOptions?.find((option) => option.grade === grade)
    ?? piece.gradeOptions?.filter((option) => option.grade <= grade).at(-1)
    ?? piece.gradeOptions?.[0];
  return gradeOption?.driftsmeltSlots ?? 0;
}

export function driftsmeltSlotUnlockGrades(piece) {
  let previousCount = 0;
  return (piece.gradeOptions ?? []).flatMap((option) => {
    const slotCount = option.driftsmeltSlots ?? 0;
    const newlyUnlocked = Math.max(0, slotCount - previousCount);
    previousCount = slotCount;
    return Array.from({ length: newlyUnlocked }, () => option.grade);
  });
}

export function filterMonsters(items, { query = "", riftborneOnly = false } = {}, context = {}) {
  const lowered = query.toLowerCase();
  return items.filter((monster) => {
    const searchText = `${monster.name} ${monster.species} ${monster.weakness.join(" ")} ${monster.habitats.join(" ")}`.toLowerCase();
    return (!lowered || searchText.includes(lowered))
      && (!riftborneOnly || monsterHasRiftborne(monster, context.materialById));
  });
}

export function filterMaterials(items, { query = "", riftborneOnly = false } = {}) {
  const lowered = query.toLowerCase();
  return items.filter((material) => {
    const searchText = `${material.name} ${material.sourceMonsterIds.join(" ")}`.toLowerCase();
    return (!lowered || searchText.includes(lowered))
      && (!riftborneOnly || isRiftborneMaterial(material));
  });
}
