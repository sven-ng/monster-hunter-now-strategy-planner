import { GAME_DATA } from "./data/game-data.mjs?v=2026-08-08-loadout-element-lock";
import { applyDriftsmeltSkills } from "./driftsmelt.mjs?v=2026-08-08-loadout-element-lock";
import { canonicalSkillName } from "./skill-utils.mjs?v=2026-08-09-skill-bulk-sync";
import { applyWeaponStyleProfile, normalizeWeaponStyleProfile } from "./weapon-style.mjs?v=2026-08-08-loadout-element-lock";

const ELEMENT_SKILL_NAMES = new Set([
  "Fire Attack",
  "Water Attack",
  "Thunder Attack",
  "Ice Attack",
  "Dragon Attack",
  "Poison Attack",
  "Paralysis Attack",
]);

const ATTACK_SKILL_SCORES = {
  Burst: 28,
  "Weakness Exploit": 34,
  "Critical Eye": 22,
  "Special Boost": 16,
  "Artful Dodger": 8,
  "Reload Speed": 8,
  "Health Boost": 12,
  "Defense Boost": 10,
  "Firm Foothold": 4,
  "Poison Resistance": 6,
  "Paralysis Resistance": 6,
};

const ELEMENT_DAMAGE_TYPES = new Set(["Fire", "Water", "Thunder", "Ice", "Dragon"]);
const ELEMENT_ATTACK_BONUSES = [0, 50, 100, 200, 350, 500];
const ATTACK_BOOST_BONUSES = [0, 50, 100, 150, 200, 300];
const ADVANCED_ATTACK_BOOST_BONUSES = [0, 150, 350];
const ADVANCED_ELEMENT_ATTACK_BONUSES = [0, 200, 400];
const ATTACK_EFFICACY_MULTIPLIERS = [0, 0.1, 0.15, 0.25];
const CRITICAL_EYE_BONUSES = [0, 10, 15, 20, 30, 40];
const WEAKNESS_EXPLOIT_BONUSES = [0, 20, 25, 30, 40, 50];
const CRITICAL_MULTIPLIERS = [1.25, 1.3, 1.35, 1.4, 1.45, 1.5];
const ELEMENT_PERCENT_SKILL_RULES = {
  "Kushala Frostwind": { elementType: "Ice", multipliers: [0, 0.1, 0.15, 0.25] },
  "Kirin Flashstorm": { elementType: "Thunder", multipliers: [0, 0.1, 0.15, 0.25] },
  "Namielle Electrowave": { elementType: "Water", multipliers: [0, 0.1, 0.15, 0.25] },
  "Malzeno Crimsonblood": { elementType: "Dragon", multipliers: [0, 0.1, 0.15, 0.25] },
  "Velkhana Aegis": { elementType: "Ice", multipliers: [0, 0.1, 0.15, 0.2] },
};

export function createIndexes(data = GAME_DATA) {
  const materialById = Object.fromEntries(data.materials.map((item) => [item.id, item]));
  const monsterById = Object.fromEntries(data.monsters.map((item) => [item.id, item]));
  const gear = [...data.weapons, ...data.armor];
  const gearById = Object.fromEntries(gear.map((item) => [item.id, item]));

  return { materialById, monsterById, gearById };
}

export function getRequiredParts(data = GAME_DATA) {
  const preferredOrder = ["Head", "Chest", "Arms", "Waist", "Legs"];
  const availableParts = new Set(data.armor.map((piece) => piece.part));
  return preferredOrder.filter((part) => availableParts.has(part));
}

export function groupArmorByPart(data = GAME_DATA) {
  return data.armor.reduce((acc, armor) => {
    if (!acc[armor.part]) {
      acc[armor.part] = [];
    }
    acc[armor.part].push(armor);
    return acc;
  }, {});
}

export function countOwnedGear(ownedIds, gearList) {
  return gearList.reduce((count, item) => count + (ownedIds.has(item.id) ? 1 : 0), 0);
}

export function recommendedGradeForStars(stars) {
  const normalizedStars = Math.max(1, Math.min(10, Number(stars) || 1));
  return Math.max(1, normalizedStars - 1);
}

export function getGearAtGrade(gear, requestedGrade = gear.grade, requestedLevel) {
  const availableGrades = gear.gradeOptions ?? [];
  const gradeOption = availableGrades.find((option) => option.grade === Number(requestedGrade))
    ?? availableGrades.filter((option) => option.grade <= Number(requestedGrade)).at(-1)
    ?? availableGrades[0];

  if (!gradeOption) {
    return gear;
  }

  const level = gradeOption.levels.find((option) => option.level === Number(requestedLevel))
    ?? gradeOption.levels.filter((option) => option.level <= Number(requestedLevel)).at(-1)
    ?? gradeOption.levels.at(-1);
  if ("attack" in level) {
    return {
      ...gear,
      grade: gradeOption.grade,
      level: level.level,
      attack: level.attack,
      affinity: level.affinity,
      element: level.elementAttack > 0 ? { type: gear.element?.type ?? "None", value: level.elementAttack } : null,
      skills: gradeOption.skills,
    };
  }

  return {
    ...gear,
    grade: gradeOption.grade,
    level: level.level,
    defense: level.defense,
    skills: gradeOption.skills,
    driftsmeltSlots: gradeOption.driftsmeltSlots ?? 0,
  };
}

export function aggregateSkills(gearItems) {
  const totals = new Map();

  for (const item of gearItems) {
    for (const skill of item.skills ?? []) {
      const normalizedName = canonicalSkillName(skill.name);
      const existing = totals.get(normalizedName) ?? {
        name: normalizedName,
        level: 0,
        effects: [],
      };

      existing.level += skill.level;
      if (skill.effect) {
        existing.effects.push(skill.effect);
      }
      totals.set(normalizedName, existing);
    }
  }

  return [...totals.values()].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

export function calculateWeaponPower(weapon, aggregatedSkills, targetMonster) {
  const baseAttack = weapon.attack;
  const targetWeakness = targetMonster?.weakness ?? [];
  const skillMap = new Map(aggregatedSkills.map((skill) => [skill.name, skill.level]));
  const attackBoostLevel = skillMap.get("Attack Boost") ?? 0;
  const advancedAttackBoostLevel = attackBoostLevel >= 5 ? skillMap.get("Advanced Attack Boost") ?? 0 : 0;
  const attackEfficacyLevel = skillMap.get("Attack Efficacy") ?? 0;
  const rawAttack = Math.round((baseAttack
      + bonusAt(ATTACK_BOOST_BONUSES, attackBoostLevel)
      + bonusAt(ADVANCED_ATTACK_BOOST_BONUSES, advancedAttackBoostLevel))
    * (1 + bonusAt(ATTACK_EFFICACY_MULTIPLIERS, attackEfficacyLevel)));
  const affinityAttack = Math.round(rawAttack * (weapon.affinity / 100) * 0.25);

  let elementValue = weapon.element?.value ?? 0;
  let weaknessBonus = 0;
  if (weapon.element && targetWeakness.includes(weapon.element.type)) {
    weaknessBonus += 120;
    const matchingSkillName = `${weapon.element.type} Attack`;
    const advancedSkillName = `Advanced ${weapon.element.type} Attack`;
    if (skillMap.has(matchingSkillName)) {
      elementValue += ELEMENT_ATTACK_BONUSES[Math.min(skillMap.get(matchingSkillName), 5)];
      if ((skillMap.get(matchingSkillName) ?? 0) >= 5) {
        elementValue += bonusAt(ADVANCED_ELEMENT_ATTACK_BONUSES, skillMap.get(advancedSkillName) ?? 0);
      }
    }
    const percentElementBonus = activeElementPercentBonuses(skillMap, weapon.element.type);
    elementValue = Math.round(elementValue * (1 + percentElementBonus.totalMultiplier));
  } else if (weapon.element && (weapon.element.type === "Poison" || weapon.element.type === "Paralysis")) {
    weaknessBonus += targetWeakness.includes(weapon.element.type) ? 70 : 20;
  }

  let skillScore = 0;
  for (const skill of aggregatedSkills) {
    if (ELEMENT_SKILL_NAMES.has(skill.name) && weapon.element?.type && !skill.name.startsWith(weapon.element.type)) {
      continue;
    }
    skillScore += ATTACK_SKILL_SCORES[skill.name] ?? skill.level * 5;
  }

  return {
    attackScore: rawAttack + affinityAttack,
    elementScore: elementValue,
    weaknessBonus,
    skillScore,
    total: rawAttack + affinityAttack + elementValue + weaknessBonus + skillScore,
  };
}

export function calculateFinalLoadoutStats(build, { monster = null, assumeWeakPoint = false } = {}) {
  const aggregatedSkills = aggregateSkills([build.weapon, ...build.armor]);
  const skillMap = new Map(aggregatedSkills.map((skill) => [skill.name, skill.level]));
  const attackBoostLevel = skillMap.get("Attack Boost") ?? 0;
  const advancedAttackBoostLevel = attackBoostLevel >= 5 ? skillMap.get("Advanced Attack Boost") ?? 0 : 0;
  const attackEfficacyLevel = skillMap.get("Attack Efficacy") ?? 0;
  const criticalEyeLevel = skillMap.get("Critical Eye") ?? 0;
  const weaknessExploitLevel = skillMap.get("Weakness Exploit") ?? 0;
  const criticalBoostLevel = skillMap.get("Critical Boost") ?? 0;
  const rawSkillBonus = bonusAt(ATTACK_BOOST_BONUSES, attackBoostLevel);
  const advancedRawSkillBonus = bonusAt(ADVANCED_ATTACK_BOOST_BONUSES, advancedAttackBoostLevel);
  const attackEfficacyMultiplier = bonusAt(ATTACK_EFFICACY_MULTIPLIERS, attackEfficacyLevel);
  const criticalEyeBonus = bonusAt(CRITICAL_EYE_BONUSES, criticalEyeLevel);
  const weaknessExploitBonus = assumeWeakPoint ? bonusAt(WEAKNESS_EXPLOIT_BONUSES, weaknessExploitLevel) : 0;
  const affinity = clamp(build.weapon.affinity + criticalEyeBonus + weaknessExploitBonus, -100, 100);
  const criticalMultiplier = bonusAt(CRITICAL_MULTIPLIERS, criticalBoostLevel);
  const rawAttack = Math.round((build.weapon.attack + rawSkillBonus + advancedRawSkillBonus) * (1 + attackEfficacyMultiplier));
  const expectedRaw = rawAttack * expectedAffinityMultiplier(affinity, criticalMultiplier);
  const weaponElement = build.weapon.element;
  const matchingElement = Boolean(monster && weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type)
    && monster.weakness.includes(weaponElement.type));
  const elementalSkillLevel = weaponElement ? skillMap.get(`${weaponElement.type} Attack`) ?? 0 : 0;
  const advancedElementalSkillLevel = weaponElement && elementalSkillLevel >= 5
    ? skillMap.get(`Advanced ${weaponElement.type} Attack`) ?? 0
    : 0;
  const elementalSkillBonus = weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type)
    ? bonusAt(ELEMENT_ATTACK_BONUSES, elementalSkillLevel)
    : 0;
  const advancedElementalSkillBonus = weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type) && elementalSkillLevel >= 5
    ? bonusAt(ADVANCED_ELEMENT_ATTACK_BONUSES, advancedElementalSkillLevel)
    : 0;
  const elementPercentBonus = weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type)
    ? activeElementPercentBonuses(skillMap, weaponElement.type)
    : { totalMultiplier: 0, bonuses: [] };
  const potentialElement = weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type)
    ? Math.round((weaponElement.value + elementalSkillBonus + advancedElementalSkillBonus)
      * (1 + elementPercentBonus.totalMultiplier))
    : 0;
  const effectiveElement = matchingElement ? potentialElement : 0;
  const defense = build.armor.reduce((total, piece) => total + piece.defense, 0);
  const modeledSkillNames = new Set([
    "Attack Boost",
    "Advanced Attack Boost",
    "Attack Efficacy",
    "Critical Eye",
    "Weakness Exploit",
    "Critical Boost",
    ...(weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type) ? [`${weaponElement.type} Attack`] : []),
    ...(weaponElement && ELEMENT_DAMAGE_TYPES.has(weaponElement.type) ? [`Advanced ${weaponElement.type} Attack`] : []),
    ...elementPercentBonus.bonuses.map((bonus) => bonus.name),
  ]);
  const styleProfile = normalizeWeaponStyleProfile(build.weapon.styleProfile);

  return {
    aggregatedSkills,
    rawAttack,
    rawSkillBonus,
    advancedAttackBoostLevel,
    advancedRawSkillBonus,
    attackEfficacyLevel,
    attackEfficacyMultiplier,
    baseAffinity: build.weapon.affinity,
    affinity,
    criticalEyeBonus,
    weaknessExploitBonus,
    criticalMultiplier,
    expectedRaw: Math.round(expectedRaw),
    weaponElement,
    elementalSkillBonus,
    advancedElementalSkillLevel,
    advancedElementalSkillBonus,
    elementPercentSkillBonuses: elementPercentBonus.bonuses,
    elementPercentMultiplierTotal: elementPercentBonus.totalMultiplier,
    potentialElement,
    effectiveElement,
    matchingElement,
    defense,
    referenceDamage: Math.round(expectedRaw + effectiveElement),
    statusBuildup: weaponElement && !ELEMENT_DAMAGE_TYPES.has(weaponElement.type) ? weaponElement : null,
    unmodeledSkills: aggregatedSkills.filter((skill) => !modeledSkillNames.has(skill.name)),
    styleProfile,
  };
}

function bonusAt(values, level) {
  return values[Math.max(0, Math.min(values.length - 1, Number(level) || 0))] ?? 0;
}

function activeElementPercentBonuses(skillMap, weaponElementType) {
  if (!weaponElementType) {
    return { totalMultiplier: 0, bonuses: [] };
  }

  const bonuses = Object.entries(ELEMENT_PERCENT_SKILL_RULES).flatMap(([name, rule]) => {
    if (rule.elementType !== weaponElementType) {
      return [];
    }
    const level = skillMap.get(name) ?? 0;
    if (level <= 0) {
      return [];
    }
    const multiplier = bonusAt(rule.multipliers, level);
    return multiplier > 0 ? [{ name, level, multiplier }] : [];
  });

  return {
    bonuses,
    totalMultiplier: bonuses.reduce((total, bonus) => total + bonus.multiplier, 0),
  };
}

function expectedAffinityMultiplier(affinity, criticalMultiplier) {
  if (affinity >= 0) {
    return 1 + (affinity / 100) * (criticalMultiplier - 1);
  }
  return 1 + (affinity / 100) * 0.25;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function buildSummary(build, targetMonster) {
  const aggregatedSkills = aggregateSkills([build.weapon, ...build.armor]);
  const weaponPower = calculateWeaponPower(build.weapon, aggregatedSkills, targetMonster);
  const defense = build.armor.reduce((sum, piece) => sum + piece.defense, 0);
  const ownedCount = build.ownedCount ?? 0;
  const score = weaponPower.total + Math.round(defense * 0.45) + ownedCount * 18;

  return {
    aggregatedSkills,
    defense,
    weaponPower,
    score,
  };
}

export function recommendBuilds({
  targetMonsterId,
  targetStars = 8,
  preferredWeaponType = "all",
  ownedGearIds = new Set(),
  gearGrades = {},
  gearProgress = {},
  driftsmeltSkillPools = {},
  weaponStyleProfiles = {},
  assumeWeakPoint = false,
  ownedWeaponsOnly = false,
  data = GAME_DATA,
} = {}) {
  const targetMonster = data.monsters.find((monster) => monster.id === targetMonsterId) ?? data.monsters[0];
  const armorByPart = groupArmorByPart(data);
  const ownsGear = (gear) => ownedGearIds.has(gear.id);
  const selectedGear = (gear) => {
    const progress = gearProgress[gear.id];
    const selected = getGearAtGrade(gear, progress?.grade ?? gearGrades[gear.id] ?? gear.grade, progress?.level);
    return "attack" in selected ? applyWeaponStyleProfile(selected, weaponStyleProfiles[gear.id]) : selected;
  };
  const weaponPool = data.weapons.filter((weapon) => {
    if (preferredWeaponType !== "all" && weapon.type !== preferredWeaponType) {
      return false;
    }
    if (ownedWeaponsOnly && !ownsGear(weapon)) {
      return false;
    }
    return true;
  });

  const weaponCandidates = rankWeapons(weaponPool.map(selectedGear), targetMonster, ownedGearIds).slice(0, 90);
  const armorCandidates = getRequiredParts(data).map((part) =>
    rankArmor(
      (ownedWeaponsOnly ? (armorByPart[part] ?? []).filter(ownsGear) : armorByPart[part] ?? []).map(selectedGear),
      ownedGearIds,
    ).slice(0, 8),
  );
  const armorSets = cartesianProduct(armorCandidates)
    .map((armor) => ({
      armor,
      score: armor.reduce(
        (total, piece) => total + armorOffensePotential(piece) + (ownedGearIds.has(piece.id) ? 18 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 180);

  const builds = [];
  for (const weapon of weaponCandidates) {
    for (const { armor } of armorSets) {
      const armorWithDriftsmelt = applySuggestedDriftsmeltSkills({
        weapon,
        armor,
        targetMonster,
        driftsmeltSkillPools,
        assumeWeakPoint,
      });
      const ownedCount = countOwnedGear(ownedGearIds, [weapon, ...armorWithDriftsmelt]);
      const summary = buildSummary({ weapon, armor: armorWithDriftsmelt, ownedCount }, targetMonster);
      const damage = calculateFinalLoadoutStats({ weapon, armor: armorWithDriftsmelt }, { monster: targetMonster, assumeWeakPoint });
      builds.push({
        weapon,
        armor: armorWithDriftsmelt,
        targetMonster,
        targetStars,
        ownedCount,
        damage,
        ...summary,
      });
    }
  }

  return builds.sort((left, right) =>
    right.damage.referenceDamage - left.damage.referenceDamage
    || right.damage.rawAttack - left.damage.rawAttack
    || right.damage.defense - left.damage.defense
    || right.ownedCount - left.ownedCount,
  ).slice(0, 6);
}

export function recommendLoadoutFocusBuilds({
  baselineBuild,
  focus = "raw",
  ownedGearIds = new Set(),
  gearGrades = {},
  gearProgress = {},
  driftsmeltSkillPools = {},
  weaponStyleProfiles = {},
  assumeWeakPoint = false,
  data = GAME_DATA,
} = {}) {
  if (!baselineBuild?.weapon) {
    return [];
  }

  const armorByPart = groupArmorByPart(data);
  const normalizedFocus = ["raw", "element", "skills"].includes(focus) ? focus : "raw";
  const baselineElementType = baselineBuild.weapon.element?.type;
  const sameTypeOwnedWeapons = data.weapons.filter((weapon) =>
    weapon.type === baselineBuild.weapon.type && ownedGearIds.has(weapon.id),
  );
  const selectedGear = (gear) => {
    const progress = gearProgress[gear.id];
    const selected = getGearAtGrade(gear, progress?.grade ?? gearGrades[gear.id] ?? gear.grade, progress?.level);
    return "attack" in selected ? applyWeaponStyleProfile(selected, weaponStyleProfiles[gear.id]) : selected;
  };

  const focusLockedWeaponPool = normalizedFocus === "element" && baselineElementType
    ? sameTypeOwnedWeapons.filter((weapon) => weapon.element?.type === baselineElementType)
    : sameTypeOwnedWeapons;
  const weaponPool = focusLockedWeaponPool.length
    ? focusLockedWeaponPool
    : sameTypeOwnedWeapons.length
      ? sameTypeOwnedWeapons
      : data.weapons.filter((weapon) => weapon.type === baselineBuild.weapon.type && weapon.id === baselineBuild.weapon.id);
  const weaponCandidates = rankLoadoutWeapons(
    weaponPool.map(selectedGear),
    baselineBuild,
    normalizedFocus,
    ownedGearIds,
  ).slice(0, 48);
  const armorCandidates = getRequiredParts(data).map((part) => {
    const ownedPieces = (armorByPart[part] ?? []).filter((piece) =>
      ownedGearIds.has(piece.id) || piece.id === baselineBuild.armor.find((item) => item.part === part)?.id,
    );
    return rankLoadoutArmor(
      ownedPieces.map(selectedGear),
      baselineBuild,
      normalizedFocus,
      ownedGearIds,
    ).slice(0, 7);
  });
  const armorSets = cartesianProduct(armorCandidates)
    .map((armor) => ({
      armor,
      score: armor.reduce((total, piece) =>
        total + armorFocusPotential(piece, baselineBuild, normalizedFocus) + (ownedGearIds.has(piece.id) ? 14 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 160);

  const seenSignatures = new Set();
  const builds = [];
  for (const weapon of weaponCandidates) {
    for (const { armor } of armorSets) {
      const armorWithDriftsmelt = applySuggestedDriftsmeltSkills({
        weapon,
        armor,
        driftsmeltSkillPools,
        assumeWeakPoint,
        focus: normalizedFocus,
        preferredElement: preferredLoadoutElement(baselineBuild, weapon, normalizedFocus),
      });
      const signature = [weapon.id, ...armorWithDriftsmelt.map((piece) => piece.id)].join("|");
      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);

      const damage = calculateFinalLoadoutStats({ weapon, armor: armorWithDriftsmelt }, { assumeWeakPoint });
      const summary = buildSummary({ weapon, armor: armorWithDriftsmelt, ownedCount: countOwnedGear(ownedGearIds, [weapon, ...armorWithDriftsmelt]) });
      const focusScore = scoreLoadoutFocusBuild({
        weapon,
        armor: armorWithDriftsmelt,
        damage,
        summary,
        focus: normalizedFocus,
        baselineBuild,
        assumeWeakPoint,
      });
      builds.push({
        weapon,
        armor: armorWithDriftsmelt,
        damage,
        focus: normalizedFocus,
        focusScore,
        focusLabel: loadoutFocusLabel(normalizedFocus),
        ownedCount: countOwnedGear(ownedGearIds, [weapon, ...armorWithDriftsmelt]),
        baselineComparison: compareBuildAgainstBaseline(damage, baselineBuild, assumeWeakPoint),
        ...summary,
      });
    }
  }

  return builds.sort((left, right) =>
    right.focusScore - left.focusScore
    || right.damage.referenceDamage - left.damage.referenceDamage
    || right.damage.potentialElement - left.damage.potentialElement
    || right.damage.rawAttack - left.damage.rawAttack
    || right.damage.defense - left.damage.defense
    || right.ownedCount - left.ownedCount,
  ).slice(0, 4);
}

export function applySuggestedDriftsmeltSkills({
  weapon,
  armor,
  targetMonster,
  driftsmeltSkillPools = {},
  assumeWeakPoint = false,
  focus = "matchup",
  preferredElement = null,
}) {
  const matchingElement = preferredElement ?? (weapon.element && targetMonster?.weakness?.includes(weapon.element.type)
    ? `${weapon.element.type} Attack`
    : null);

  return armor.map((piece) => {
    const slotCount = piece.driftsmeltSlots ?? 0;
    const skillPool = driftsmeltSkillPools[piece.id] ?? [];
    if (!slotCount || !skillPool.length) return piece;
    const selectedSkills = skillPool
      .map((skill, index) => ({
        skill,
        index,
        score: suggestedDriftsmeltScore(skill, {
          focus,
          matchingElement,
          assumeWeakPoint,
        }),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, slotCount)
      .map(({ skill }) => skill);
    return applyDriftsmeltSkills(piece, selectedSkills);
  });
}

export function classifyBuildVsMonster(build, monster, targetStars = build.targetStars ?? 8) {
  const summary = buildSummary(build, monster);
  const weaponElement = build.weapon.element?.type;
  const elementalMatch = weaponElement && monster.weakness.includes(weaponElement);
  const statusMatch = weaponElement && ["Poison", "Paralysis", "Sleep", "Blast"].includes(weaponElement);
  const requiredGrade = recommendedGradeForStars(targetStars);
  const gradeGap = build.weapon.grade - requiredGrade;

  if (gradeGap <= -2) {
    return { label: `Underpowered for ${targetStars}-star`, tier: "hard", power: summary.weaponPower.total, requiredGrade };
  }
  if (gradeGap === -1) {
    return { label: `Below ${targetStars}-star baseline`, tier: "fair", power: summary.weaponPower.total, requiredGrade };
  }

  if (elementalMatch) {
    return { label: "Elemental edge", tier: "easy", power: summary.weaponPower.total, requiredGrade };
  }
  if (statusMatch) {
    return { label: "Status option", tier: "fair", power: summary.weaponPower.total, requiredGrade };
  }
  return { label: "On-grade matchup", tier: "fair", power: summary.weaponPower.total, requiredGrade };
}

export function getMonsterMaterialUsage(monsterId, data = GAME_DATA) {
  return [...data.weapons, ...data.armor].filter((gear) => gear.sourceMonsterId === monsterId);
}

export function getMaterialUsage(materialId, data = GAME_DATA) {
  return [...data.weapons, ...data.armor].filter((gear) =>
    gear.materials.some((requirement) => requirement.materialId === materialId),
  );
}

function skillScore(skills) {
  return (skills ?? []).reduce((total, skill) => total + (ATTACK_SKILL_SCORES[skill.name] ?? skill.level * 5), 0);
}

function loadoutFocusLabel(focus) {
  if (focus === "element") return "Element focus";
  if (focus === "skills") return "Skill focus";
  return "Raw focus";
}

function rankWeapons(weapons, targetMonster, ownedGearIds) {
  return weapons
    .map((weapon) => {
      const elementMatch = weapon.element && targetMonster.weakness.includes(weapon.element.type) ? weapon.element.value * 1.5 : 0;
      return { weapon, score: weapon.attack + elementMatch + (ownedGearIds.has(weapon.id) ? 18 : 0) };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ weapon }) => weapon);
}

function rankLoadoutWeapons(weapons, baselineBuild, focus, ownedGearIds) {
  return weapons
    .map((weapon) => {
      const damage = calculateFinalLoadoutStats({ weapon, armor: baselineBuild.armor });
      return {
        weapon,
        score: weaponFocusPotential(weapon, damage, baselineBuild, focus) + (ownedGearIds.has(weapon.id) ? 18 : 0),
      };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ weapon }) => weapon);
}

function rankArmor(armor, ownedGearIds) {
  return armor
    .map((piece) => ({
      piece,
      score: armorOffensePotential(piece) + (ownedGearIds.has(piece.id) ? 18 : 0),
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ piece }) => piece);
}

function rankLoadoutArmor(armor, baselineBuild, focus, ownedGearIds) {
  return armor
    .map((piece) => ({
      piece,
      score: armorFocusPotential(piece, baselineBuild, focus) + (ownedGearIds.has(piece.id) ? 18 : 0),
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ piece }) => piece);
}

function armorOffensePotential(piece) {
  return piece.defense * 0.25 + (piece.skills ?? []).reduce((total, skill) => {
    if (skill.name === "Attack Boost") return total + bonusAt(ATTACK_BOOST_BONUSES, skill.level);
    if (skill.name === "Attack Efficacy") return total + bonusAt(ATTACK_EFFICACY_MULTIPLIERS, skill.level) * 900;
    if (ELEMENT_SKILL_NAMES.has(skill.name)) return total + bonusAt(ELEMENT_ATTACK_BONUSES, skill.level) * 0.5;
    if (skill.name === "Critical Eye") return total + bonusAt(CRITICAL_EYE_BONUSES, skill.level) * 4;
    if (skill.name === "Weakness Exploit") return total + bonusAt(WEAKNESS_EXPLOIT_BONUSES, skill.level) * 4;
    if (skill.name === "Critical Boost") return total + skill.level * 55;
    return total + skillScore([skill]);
  }, 0);
}

function weaponFocusPotential(weapon, damage, baselineBuild, focus) {
  if (focus === "element") {
    const preferredElement = preferredLoadoutElement(baselineBuild, weapon, focus);
    const sameElementBonus = preferredElement && weapon.element?.type === preferredElement.replace(" Attack", "") ? 420 : 0;
    return damage.potentialElement * 3 + damage.rawAttack * 0.45 + sameElementBonus;
  }
  if (focus === "skills") {
    return damage.rawAttack * 0.7 + damage.potentialElement * 0.55 + (weapon.affinity ?? 0) * 8 + skillScore(weapon.skills);
  }
  return damage.rawAttack * 2.3 + damage.potentialElement * 0.35 + (weapon.affinity ?? 0) * 7;
}

function armorFocusPotential(piece, baselineBuild, focus) {
  const preferredElement = preferredLoadoutElement(baselineBuild, null, focus);
  return piece.defense * 0.22 + (piece.skills ?? []).reduce((total, skill) => {
    if (skill.name === "Attack Boost") return total + (focus === "raw" ? 120 : 90) * skill.level;
    if (skill.name === "Advanced Attack Boost") return total + (focus === "raw" ? 150 : 110) * skill.level;
    if (skill.name === "Attack Efficacy") return total + (focus === "raw" ? 180 : 130) * skill.level;
    if (skill.name === "Critical Eye") return total + 78 * skill.level;
    if (skill.name === "Weakness Exploit") return total + 88 * skill.level;
    if (skill.name === "Critical Boost") return total + 82 * skill.level;
    if (preferredElement && skill.name === preferredElement) return total + (focus === "element" ? 170 : 90) * skill.level;
    if (preferredElement && skill.name === `Advanced ${preferredElement.replace(" Attack", "")} Attack`) {
      return total + (focus === "element" ? 210 : 120) * skill.level;
    }
    return total + skillScore([skill]) * (focus === "skills" ? 1.45 : 1);
  }, 0);
}

function preferredLoadoutElement(baselineBuild, weapon, focus) {
  if (focus !== "element") return null;
  const weaponElementType = weapon?.element?.type;
  if (weaponElementType && ELEMENT_DAMAGE_TYPES.has(weaponElementType)) {
    return `${weaponElementType} Attack`;
  }
  const baselineType = baselineBuild.weapon?.element?.type;
  return baselineType && ELEMENT_DAMAGE_TYPES.has(baselineType) ? `${baselineType} Attack` : null;
}

function scoreLoadoutFocusBuild({ weapon, armor, damage, summary, focus, baselineBuild, assumeWeakPoint }) {
  const aggregatedSkills = summary.aggregatedSkills ?? aggregateSkills([weapon, ...armor]);
  const skillTotal = aggregatedSkills.reduce((total, skill) =>
    total + focusedSkillWeight(skill.name, skill.level, focus, preferredLoadoutElement(baselineBuild, weapon, focus), assumeWeakPoint), 0);
  if (focus === "element") {
    const preferredElement = preferredLoadoutElement(baselineBuild, weapon, focus);
    const sameElementBonus = preferredElement && weapon.element?.type === preferredElement.replace(" Attack", "") ? 320 : 0;
    return damage.potentialElement * 3.2 + damage.rawAttack * 0.55 + skillTotal + sameElementBonus + damage.defense * 0.18;
  }
  if (focus === "skills") {
    return skillTotal * 14 + damage.rawAttack * 0.75 + damage.potentialElement * 0.75 + damage.defense * 0.2;
  }
  return damage.rawAttack * 2.6 + damage.expectedRaw * 1.2 + damage.potentialElement * 0.3 + skillTotal * 6 + damage.defense * 0.18;
}

function focusedSkillWeight(name, level, focus, preferredElement, assumeWeakPoint) {
  if (name === "Attack Boost") return level * (focus === "raw" ? 28 : 18);
  if (name === "Advanced Attack Boost") return level * (focus === "raw" ? 38 : 24);
  if (name === "Attack Efficacy") return level * (focus === "raw" ? 44 : 30);
  if (name === "Critical Eye") return level * 18;
  if (name === "Weakness Exploit") return level * (assumeWeakPoint ? 22 : 12);
  if (name === "Critical Boost") return level * 21;
  if (name === preferredElement) return level * (focus === "element" ? 36 : 16);
  if (preferredElement && name === `Advanced ${preferredElement.replace(" Attack", "")} Attack`) {
    return level * (focus === "element" ? 44 : 20);
  }
  return (ATTACK_SKILL_SCORES[name] ?? 4) * level;
}

function compareBuildAgainstBaseline(damage, baselineBuild, assumeWeakPoint) {
  const baselineDamage = calculateFinalLoadoutStats(baselineBuild, { assumeWeakPoint });
  return {
    rawDelta: damage.rawAttack - baselineDamage.rawAttack,
    elementDelta: damage.potentialElement - baselineDamage.potentialElement,
    defenseDelta: damage.defense - baselineDamage.defense,
    affinityDelta: damage.affinity - baselineDamage.affinity,
  };
}

function suggestedDriftsmeltScore(skill, { focus = "matchup", matchingElement = null, assumeWeakPoint = false } = {}) {
  if (skill === matchingElement) return focus === "element" ? 180 : 140;
  if (matchingElement && skill === `Advanced ${matchingElement.replace(" Attack", "")} Attack`) return focus === "element" ? 170 : 90;
  if (skill === "Attack Boost") return focus === "raw" ? 145 : 120;
  if (skill === "Advanced Attack Boost") return focus === "raw" ? 155 : 125;
  if (skill === "Attack Efficacy") return focus === "raw" ? 150 : 110;
  if (skill === "Critical Eye") return focus === "skills" ? 90 : 70;
  if (skill === "Weakness Exploit") return assumeWeakPoint ? (focus === "skills" ? 88 : 65) : 20;
  if (skill === "Critical Boost") return focus === "skills" ? 82 : 45;
  if (skill === "Burst") return focus === "skills" ? 76 : 24;
  return 0;
}

function cartesianProduct(groups) {
  return groups.reduce((combinations, group) =>
    combinations.flatMap((combination) => group.map((item) => [...combination, item])), [[]]);
}
