import test from "node:test";
import assert from "node:assert/strict";

import { GAME_DATA } from "../data/game-data.mjs";
import { MAX_DRIFTSMELT_SKILLS_PER_ARMOR, normalizeActiveDriftsmeltSkills, normalizeDriftsmeltSkillPool } from "../driftsmelt.mjs";
import { createProfileExport, parseProfileExport } from "../profile-transfer.mjs";
import { driftsmeltSlotCount, driftsmeltSlotUnlockGrades, filterArmor, filterWeapons } from "../catalogue-filters.mjs";
import { createLoadout, createLoadoutFromBuild, evaluateLoadout, evaluateSavedLoadouts, hydrateLoadout, replaceLoadout, updateLoadoutGearProgress } from "../loadouts.mjs";
import { buildUpgradePlan, getNextGearUpgrade } from "../upgrade-planner.mjs";
import { isRiftborneMaterial, monsterHasRiftborne, normalizeWeaponStyleProfile, weaponSupportsStyle } from "../weapon-style.mjs";
import { canonicalSkillName, skillDescription } from "../skill-utils.mjs";
import {
  aggregateSkills,
  applySuggestedDriftsmeltSkills,
  classifyBuildVsMonster,
  calculateFinalLoadoutStats,
  getGearAtGrade,
  getMaterialUsage,
  getMonsterMaterialUsage,
  getRequiredParts,
  recommendedGradeForStars,
  recommendBuilds,
  recommendLoadoutFocusBuilds,
} from "../planner.mjs";

test("official snapshot includes the current full catalogue shape", () => {
  assert.ok(GAME_DATA.monsters.length >= 67);
  assert.ok(GAME_DATA.weapons.length >= 695);
  assert.ok(GAME_DATA.armor.length >= 345);
  assert.deepEqual(getRequiredParts(GAME_DATA), ["Head", "Chest", "Arms", "Waist", "Legs"]);
  assert.equal(new Set(GAME_DATA.weapons.map((item) => item.type)).size, 14);
  assert.match(GAME_DATA.monsters[0].imageUrl, /^https:\/\//);
  assert.match(GAME_DATA.weapons[0].imageUrl, /^https:\/\//);
  assert.match(GAME_DATA.armor[0].imageUrl, /^https:\/\//);
  assert.match(GAME_DATA.materials[0].imageUrl, /^https:\/\//);
  assert.ok(GAME_DATA.armor.every((piece) => piece.gradeOptions.every((option) => Number.isInteger(option.driftsmeltSlots))));
});

test("profile exports preserve a portable planner profile and reject unrelated files", () => {
  const profile = { ownedGearIds: ["greatjagras_gunlance"], targetStars: 8, savedLoadouts: [] };
  const exported = createProfileExport(profile, "2026-08-06T00:00:00.000Z");

  assert.deepEqual(parseProfileExport(JSON.stringify(exported)), profile);
  assert.throws(() => parseProfileExport('{"version": 999, "profile": {}}'), /compatible Field Kit/);
  assert.throws(() => parseProfileExport('not-json'), /valid JSON/);
});

test("every published monster drop resolves to a material entry", () => {
  const materialIds = new Set(GAME_DATA.materials.map((material) => material.id));
  for (const monster of GAME_DATA.monsters) {
    for (const dropId of monster.drops) {
      assert.ok(materialIds.has(dropId), `${monster.name} has an unresolved drop: ${dropId}`);
    }
  }
});

test("water-focused recommendations rise to the top against Anjanath", () => {
  const builds = recommendBuilds({ targetMonsterId: "anjanath", data: GAME_DATA });

  assert.equal(builds.length, 6);
  assert.equal(builds[0].weapon.element?.type, "Water");
  assert.equal(builds[0].armor.length, 5);
});

test("saved loadout focus suggestions stay within owned same-type gear and rank raw focus", () => {
  const baselineWeapon = GAME_DATA.weapons.find((item) => item.id === "lagombi_greatsword");
  const alternativeWeapon = GAME_DATA.weapons
    .filter((item) => item.type === baselineWeapon.type && item.id !== baselineWeapon.id)
    .sort((left, right) => right.attack - left.attack)[0];
  const ownedGearIds = new Set([baselineWeapon.id, alternativeWeapon.id]);
  const baselineArmor = [];

  for (const part of getRequiredParts(GAME_DATA)) {
    const piece = GAME_DATA.armor.find((item) => item.part === part);
    ownedGearIds.add(piece.id);
    baselineArmor.push(piece);
  }

  const builds = recommendLoadoutFocusBuilds({
    baselineBuild: { weapon: baselineWeapon, armor: baselineArmor },
    focus: "raw",
    ownedGearIds,
    data: GAME_DATA,
  });

  assert.ok(builds.length > 0);
  assert.equal(builds[0].weapon.type, baselineWeapon.type);
  assert.ok(ownedGearIds.has(builds[0].weapon.id));
  assert.ok(builds.every((build) => build.armor.length === 5));
  assert.ok(builds[0].focusScore >= builds.at(-1).focusScore);
});

test("element focus suggestions preserve an elemental direction when baseline has one", () => {
  const baselineWeapon = GAME_DATA.weapons.find((item) => item.element?.type === "Ice" && item.type === "Great Sword");
  const differentElementWeapon = GAME_DATA.weapons.find((item) =>
    item.type === baselineWeapon.type && item.element?.type === "Fire");
  const ownedGearIds = new Set([baselineWeapon.id, differentElementWeapon.id]);
  const baselineArmor = [];

  for (const part of getRequiredParts(GAME_DATA)) {
    const matchingSkillPiece = GAME_DATA.armor.find((item) =>
      item.part === part && item.skills.some((skill) => skill.name.includes("Ice Attack")));
    const fallbackPiece = GAME_DATA.armor.find((item) => item.part === part);
    const piece = matchingSkillPiece ?? fallbackPiece;
    ownedGearIds.add(piece.id);
    baselineArmor.push(piece);
  }

  const builds = recommendLoadoutFocusBuilds({
    baselineBuild: { weapon: baselineWeapon, armor: baselineArmor },
    focus: "element",
    ownedGearIds,
    data: GAME_DATA,
  });

  assert.ok(builds.length > 0);
  assert.equal(builds[0].focus, "element");
  assert.equal(builds[0].weapon.type, baselineWeapon.type);
  assert.equal(builds[0].weapon.element?.type, "Ice");
  assert.ok(builds.every((build) => build.weapon.element?.type === "Ice"));
  assert.ok(builds[0].damage.potentialElement >= 0);
});

test("monster series links resolve to its official gear", () => {
  const usage = getMonsterMaterialUsage("greatjagras", GAME_DATA);
  assert.ok(usage.length > 0);
  assert.ok(usage.every((gear) => gear.sourceMonsterId === "greatjagras"));
});

test("unpublished forge quantities are not presented as material usage", () => {
  const material = GAME_DATA.materials.find((item) => item.id === "greatjagras_scale_1");
  assert.ok(material);
  assert.deepEqual(getMaterialUsage(material.id, GAME_DATA), []);
});

test("matchup labels describe elemental advantage, not a damage simulation", () => {
  const build = recommendBuilds({ targetMonsterId: "anjanath", data: GAME_DATA })[0];
  const result = classifyBuildVsMonster(build, GAME_DATA.monsters.find((monster) => monster.id === "anjanath"));

  assert.equal(result.tier, "easy");
  assert.equal(result.label, "Elemental edge");
});

test("a Grade 5 weapon is underpowered for an 8-star hunt despite an elemental match", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const gradeFiveWeapon = getGearAtGrade(weapon, 5, 1);
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const anjanath = GAME_DATA.monsters.find((monster) => monster.id === "anjanath");

  const result = classifyBuildVsMonster({ weapon: gradeFiveWeapon, armor, targetStars: 8 }, anjanath);

  assert.equal(gradeFiveWeapon.grade, 5);
  assert.equal(gradeFiveWeapon.level, 1);
  assert.equal(recommendedGradeForStars(8), 7);
  assert.equal(result.tier, "hard");
  assert.equal(result.label, "Underpowered for 8-star");
});

test("saved loadouts preserve selected grades and levels and evaluate monsters from that snapshot", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const loadout = createLoadout({
    id: "water-grade-five",
    name: "Water Grade Five",
    weaponId: weapon.id,
    armorIds: Object.fromEntries(armor.map((piece) => [piece.part, piece.id])),
    gearProgress: Object.fromEntries([
      [weapon.id, { grade: 5, level: 1 }],
      ...armor.map((piece) => [piece.id, { grade: piece.grade, level: piece.level }]),
    ]),
    data: GAME_DATA,
  });

  const hydrated = hydrateLoadout(loadout, GAME_DATA);
  const anjanathResult = evaluateLoadout(loadout, { data: GAME_DATA, targetStars: 8 })
    .find((item) => item.monster.id === "anjanath");

  assert.equal(hydrated.weapon.grade, 5);
  assert.equal(hydrated.weapon.level, 1);
  assert.equal(hydrated.weapon.attack, 391);
  assert.equal(hydrated.armor.length, 5);
  assert.equal(anjanathResult.result.label, "Underpowered for 8-star");
});

test("manual loadouts can synchronize one equipped armor's upgraded Grade and Level", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const chest = GAME_DATA.armor.find((item) => item.id === "aknosom_chest");
  const armorIds = Object.fromEntries(armor.map((piece) => [piece.part, piece.id]));
  armorIds.Chest = chest.id;
  const loadout = createLoadout({
    id: "sync-upgrade",
    name: "Sync upgrade",
    weaponId: weapon.id,
    armorIds,
    gearProgress: Object.fromEntries([
      [weapon.id, { grade: 5, level: 1 }],
      ...armor.map((piece) => [piece.id, { grade: piece.grade, level: piece.level }]),
      [chest.id, { grade: 5, level: 1 }],
    ]),
    data: GAME_DATA,
  });
  const nextProgress = { grade: 5, level: 2 };
  const updated = updateLoadoutGearProgress(loadout, chest.id, nextProgress);

  assert.deepEqual(updated.gearProgress[chest.id], nextProgress);
  assert.deepEqual(loadout.gearProgress[weapon.id], updated.gearProgress[weapon.id]);
});

test("editing a loadout replaces its existing record instead of creating a duplicate", () => {
  const original = { id: "loadout-1", name: "Original", gearProgress: {} };
  const other = { id: "loadout-2", name: "Other", gearProgress: {} };
  const updated = { ...original, name: "Updated" };
  const saved = replaceLoadout([original, other], updated);

  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map((loadout) => loadout.name), ["Updated", "Other"]);
});

test("catalogue filters combine item attributes with persistent favorites", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const armor = GAME_DATA.armor.find((item) => item.id === "aknosom_arms");
  const favorites = new Set([weapon.id, armor.id]);
  const forged = new Set([weapon.id, armor.id]);

  const weapons = filterWeapons(GAME_DATA.weapons, {
    query: "",
    type: weapon.type,
    element: weapon.element.type,
    monster: weapon.sourceMonsterId,
    favoritesOnly: true,
  }, favorites, forged);
  const armorPieces = filterArmor(GAME_DATA.armor, {
    query: "",
    skill: armor.skills[0].name,
    monster: armor.sourceMonsterId,
    driftsmeltSlots: "1",
    favoritesOnly: true,
  }, favorites, forged);

  assert.deepEqual(weapons.map((item) => item.id), [weapon.id]);
  assert.deepEqual(armorPieces.map((item) => item.id), [armor.id]);
  assert.equal(driftsmeltSlotCount(armor), 1);
  assert.deepEqual(filterWeapons(GAME_DATA.weapons, {
    query: "",
    type: "all",
    element: "all",
    monster: "all",
    favoritesOnly: false,
    forgedOnly: true,
  }, new Set(), forged).map((item) => item.id), [weapon.id]);
  assert.deepEqual(filterArmor(GAME_DATA.armor, {
    query: "",
    skill: "all",
    monster: "all",
    driftsmeltSlots: "all",
    favoritesOnly: false,
    forgedOnly: true,
  }, new Set(), forged).map((item) => item.id), [armor.id]);
});

test("Driftsmelt slots use their official unlock grade, including second slots", () => {
  const almudronVambraces = GAME_DATA.armor.find((item) => item.id === "almudron_arms");
  const gradeFour = getGearAtGrade(almudronVambraces, 4, 5);
  const gradeFive = getGearAtGrade(almudronVambraces, 5, 5);
  const gradeEight = getGearAtGrade(almudronVambraces, 8, 5);

  assert.equal(driftsmeltSlotCount(gradeFour), 0);
  assert.equal(driftsmeltSlotCount(gradeFive), 1);
  assert.equal(driftsmeltSlotCount(gradeEight), 2);
  assert.deepEqual(driftsmeltSlotUnlockGrades(almudronVambraces), [5, 8]);
});

test("Driftsmelt pools store 20 skills while active slots use only selected recorded skills", () => {
  const pool = Array.from({ length: 22 }, (_, index) => index % 2 ? "Critical Eye" : "Attack Boost");
  const normalizedPool = normalizeDriftsmeltSkillPool(pool);

  assert.equal(normalizedPool.length, MAX_DRIFTSMELT_SKILLS_PER_ARMOR);
  assert.deepEqual(normalizeActiveDriftsmeltSkills(["Critical Eye", "Attack Boost"], 1, normalizedPool), ["Critical Eye"]);
  assert.deepEqual(normalizeActiveDriftsmeltSkills(["Not A Skill"], 2, normalizedPool), []);
  assert.deepEqual(normalizeDriftsmeltSkillPool(["Quick Work", "<invalid>"]), ["Quick Work"]);
});

test("Hunt Planner chooses target-relevant recorded Driftsmelt skills for suggested builds", () => {
  const weapon = getGearAtGrade(GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance"), 5, 1);
  const arms = getGearAtGrade(GAME_DATA.armor.find((item) => item.id === "almudron_arms"), 8, 5);
  const anjanath = GAME_DATA.monsters.find((monster) => monster.id === "anjanath");
  const [suggestedArms] = applySuggestedDriftsmeltSkills({
    weapon,
    armor: [arms],
    targetMonster: anjanath,
    driftsmeltSkillPools: { [arms.id]: ["Critical Eye", "Water Attack", "Attack Boost"] },
  });

  assert.deepEqual(suggestedArms.driftsmeltSkills, ["Water Attack", "Attack Boost"]);
});

test("saved loadouts preserve selected active Driftsmelt skills and apply their modeled bonuses", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const driftArmor = GAME_DATA.armor.find((item) => item.id === "almudron_arms");
  const armorIds = Object.fromEntries(armor.map((piece) => [piece.part, piece.id]));
  armorIds.Arms = driftArmor.id;
  const loadout = createLoadout({
    id: "driftsmelt-water",
    name: "Driftsmelt Water",
    weaponId: weapon.id,
    armorIds,
    gearProgress: Object.fromEntries([
      [weapon.id, { grade: 5, level: 1 }],
      ...armor.map((piece) => [piece.id, { grade: piece.grade, level: piece.level }]),
      [driftArmor.id, { grade: 8, level: 5 }],
    ]),
    activeDriftsmeltSkills: { [driftArmor.id]: ["Attack Boost", "Critical Eye", "Not A Skill"] },
    driftsmeltSkillPools: { [driftArmor.id]: ["Attack Boost", "Critical Eye", "Not A Skill"] },
    data: GAME_DATA,
  });
  const build = hydrateLoadout(loadout, GAME_DATA);
  const baseBuild = hydrateLoadout({
    ...loadout,
    driftsmeltSkills: { ...loadout.driftsmeltSkills, [driftArmor.id]: [] },
  }, GAME_DATA);
  const stats = calculateFinalLoadoutStats(build);
  const baseStats = calculateFinalLoadoutStats(baseBuild);
  const hydratedArms = build.armor.find((piece) => piece.id === driftArmor.id);

  assert.deepEqual(loadout.driftsmeltSkills[driftArmor.id], ["Attack Boost", "Critical Eye"]);
  assert.deepEqual(hydratedArms.driftsmeltSkills, ["Attack Boost", "Critical Eye"]);
  assert.equal(stats.rawSkillBonus, baseStats.rawSkillBonus + 50);
  assert.equal(
    stats.aggregatedSkills.find((skill) => skill.name === "Critical Eye").level,
    baseStats.aggregatedSkills.find((skill) => skill.name === "Critical Eye").level + 1,
  );
  assert.ok(stats.criticalEyeBonus > baseStats.criticalEyeBonus);
});

test("Attack Efficacy Driftsmelt is accepted and increases final raw", () => {
  const weapon = getGearAtGrade(GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance"), 5, 1);
  const anjanath = GAME_DATA.monsters.find((monster) => monster.id === "anjanath");
  const driftArmor = getGearAtGrade(GAME_DATA.armor.find((item) => item.id === "almudron_arms"), 8, 5);
  const [armsWithDriftsmelt] = applySuggestedDriftsmeltSkills({
    weapon,
    armor: [driftArmor],
    targetMonster: anjanath,
    driftsmeltSkillPools: { [driftArmor.id]: ["Attack Efficacy"] },
  });
  const stats = calculateFinalLoadoutStats({ weapon, armor: [armsWithDriftsmelt] });

  assert.deepEqual(normalizeDriftsmeltSkillPool(["Attack Efficacy"]), ["Attack Efficacy"]);
  assert.deepEqual(armsWithDriftsmelt.driftsmeltSkills, ["Attack Efficacy"]);
  assert.equal(stats.attackEfficacyLevel, 1);
  assert.equal(stats.rawAttack, 430);
});

test("Regios Vambraces normalize Powerhouse to Attack Efficacy and keep Attack Boost by grade", () => {
  const weapon = getGearAtGrade(GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance"), 5, 1);
  const regiosArms = getGearAtGrade(GAME_DATA.armor.find((item) => item.id === "seregios_arms"), 6, 1);
  const stats = calculateFinalLoadoutStats({ weapon, armor: [regiosArms] });

  assert.equal(stats.attackEfficacyLevel, 1);
  assert.equal(stats.rawSkillBonus, 50);
  assert.equal(stats.rawAttack, 485);
  assert.deepEqual(aggregateSkills([regiosArms]).map((skill) => skill.name), ["Attack Boost", "Attack Efficacy"]);
});

test("final loadout stats apply raw, affinity, critical, and matching-element skills", () => {
  const weapon = getGearAtGrade(GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance"), 5, 1);
  const anjanath = GAME_DATA.monsters.find((monster) => monster.id === "anjanath");
  const build = {
    weapon,
    armor: [{
      defense: 100,
      skills: [
        { name: "Attack Boost", level: 2 },
        { name: "Water Attack", level: 1 },
        { name: "Critical Eye", level: 1 },
        { name: "Weakness Exploit", level: 1 },
        { name: "Critical Boost", level: 1 },
      ],
    }],
  };

  const stats = calculateFinalLoadoutStats(build, { monster: anjanath, assumeWeakPoint: true });

  assert.equal(stats.rawAttack, 491);
  assert.equal(stats.affinity, 30);
  assert.equal(stats.criticalMultiplier, 1.3);
  assert.equal(stats.effectiveElement, 186);
  assert.equal(stats.referenceDamage, 721);
  assert.equal(stats.defense, 100);
});

test("planner ranks recommendation cards by displayed reference damage", () => {
  const builds = recommendBuilds({
    targetMonsterId: "legiana",
    assumeWeakPoint: true,
    data: GAME_DATA,
  });

  assert.ok(builds.every((build) => Number.isInteger(build.damage.referenceDamage)));
  assert.ok(builds.every((build, index) => index === 0 || builds[index - 1].damage.referenceDamage >= build.damage.referenceDamage));
  assert.ok(builds[0].damage.referenceDamage >= builds.at(-1).damage.referenceDamage);
});

test("saved loadouts are evaluated by Hunt Planner using their saved Grade and Level", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const loadout = createLoadout({
    id: "planner-saved-water",
    name: "Saved Water Set",
    weaponId: weapon.id,
    armorIds: Object.fromEntries(armor.map((piece) => [piece.part, piece.id])),
    gearProgress: Object.fromEntries([
      [weapon.id, { grade: 5, level: 1 }],
      ...armor.map((piece) => [piece.id, { grade: piece.grade, level: piece.level }]),
    ]),
    data: GAME_DATA,
  });

  const planned = evaluateSavedLoadouts([loadout], {
    data: GAME_DATA,
    targetMonsterId: "anjanath",
    targetStars: 8,
  });

  assert.equal(planned[0].savedLoadoutName, "Saved Water Set");
  assert.equal(planned[0].weapon.grade, 5);
  assert.equal(planned[0].weapon.level, 1);
  assert.equal(planned[0].damage.effectiveElement, 136);
});

test("upgrade plan identifies the next saved weapon level and its monster-series focus", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "greatjagras_gunlance");
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const loadout = createLoadout({
    id: "upgrade-water",
    name: "Upgrade Water Set",
    weaponId: weapon.id,
    armorIds: Object.fromEntries(armor.map((piece) => [piece.part, piece.id])),
    gearProgress: Object.fromEntries([
      [weapon.id, { grade: 5, level: 1 }],
      ...armor.map((piece) => [piece.id, { grade: piece.grade, level: piece.level }]),
    ]),
    data: GAME_DATA,
  });
  const currentWeapon = getGearAtGrade(weapon, 5, 1);
  const plan = buildUpgradePlan({
    loadout,
    data: GAME_DATA,
    targetMonsterId: "anjanath",
    targetStars: 8,
  });
  const weaponUpgrade = plan.upgrades.find((entry) => entry.kind === "weapon");

  assert.deepEqual(getNextGearUpgrade(currentWeapon), { grade: 5, level: 2 });
  assert.equal(weaponUpgrade.nextGear.level, 2);
  assert.ok(weaponUpgrade.damageGain > 0);
  assert.ok(plan.monsterFocus.some((group) => group.sourceMonsterId === "greatjagras"));
});

test("suggested builds can be saved as grade-and-level upgrade targets", () => {
  const suggested = recommendBuilds({ targetMonsterId: "anjanath", data: GAME_DATA })[0];
  const saved = createLoadoutFromBuild({
    id: "suggested-anjanath",
    name: "Anjanath plan",
    build: suggested,
    data: GAME_DATA,
  });
  const hydrated = hydrateLoadout(saved, GAME_DATA);

  assert.equal(saved.origin, "suggested");
  assert.equal(hydrated.weapon.grade, suggested.weapon.grade);
  assert.equal(hydrated.weapon.level, suggested.weapon.level);
  assert.deepEqual(hydrated.armor.map((piece) => piece.id), suggested.armor.map((piece) => piece.id));
});

test("Riftborne helpers identify live monster and weapon style routes from the official snapshot", () => {
  const lagombi = GAME_DATA.monsters.find((monster) => monster.id === "lagombi");
  const lagombiWeapon = GAME_DATA.weapons.find((weapon) => weapon.sourceMonsterId === "lagombi");
  const lagombiRiftborneMaterial = GAME_DATA.materials.find((material) => material.id === "lagombi_riftborne_material");
  const indexes = {
    materialById: Object.fromEntries(GAME_DATA.materials.map((material) => [material.id, material])),
    monsterById: Object.fromEntries(GAME_DATA.monsters.map((monster) => [monster.id, monster])),
  };

  assert.ok(isRiftborneMaterial(lagombiRiftborneMaterial));
  assert.equal(monsterHasRiftborne(lagombi, indexes.materialById), true);
  assert.equal(weaponSupportsStyle(lagombiWeapon, indexes.monsterById, indexes.materialById), true);
});

test("weapon style profiles can be saved on a loadout and increase final stats", () => {
  const weapon = GAME_DATA.weapons.find((item) => item.id === "lagombi_longsword");
  const armor = getRequiredParts(GAME_DATA).map((part) => GAME_DATA.armor.find((item) => item.part === part));
  const styleProfile = normalizeWeaponStyleProfile({
    styleName: "Balanced",
    styleLevel: 2,
    rawBonus: 120,
    affinityBonus: 15,
    elementBonus: 80,
  });
  const loadout = createLoadout({
    id: "styled-lagombi",
    name: "Styled Lagombi",
    weaponId: weapon.id,
    armorIds: Object.fromEntries(armor.map((piece) => [piece.part, piece.id])),
    gearProgress: Object.fromEntries([
      [weapon.id, { grade: 8, level: 1 }],
      ...armor.map((piece) => [piece.id, { grade: piece.grade, level: piece.level }]),
    ]),
    weaponStyleProfiles: { [weapon.id]: styleProfile },
    data: GAME_DATA,
  });
  const styledBuild = hydrateLoadout(loadout, GAME_DATA);
  const baseBuild = hydrateLoadout({ ...loadout, weaponStyleProfile: null }, GAME_DATA);
  const styledStats = calculateFinalLoadoutStats(styledBuild);
  const baseStats = calculateFinalLoadoutStats(baseBuild);

  assert.deepEqual(styledStats.styleProfile, styleProfile);
  assert.equal(styledBuild.weapon.attack, baseBuild.weapon.attack + 120);
  assert.equal(styledBuild.weapon.affinity, baseBuild.weapon.affinity + 15);
  assert.equal(styledBuild.weapon.element.value, baseBuild.weapon.element.value + 80);
  assert.ok(styledStats.referenceDamage > baseStats.referenceDamage);
});

test("Advanced Ice Attack is normalized from the legacy secret name and increases element only at Ice Attack Lv5+", () => {
  const weapon = {
    attack: 1000,
    affinity: 0,
    element: { type: "Ice", value: 700 },
    styleProfile: null,
  };
  const weakMonster = { weakness: ["Ice"] };
  const activeBuild = {
    weapon,
    armor: [{
      defense: 100,
      skills: [
        { name: "Ice Attack", level: 5 },
        { name: "Ice Attack Boost Secret", level: 1 },
      ],
    }],
  };
  const inactiveBuild = {
    weapon,
    armor: [{
      defense: 100,
      skills: [
        { name: "Ice Attack", level: 4 },
        { name: "Ice Attack Boost Secret", level: 1 },
      ],
    }],
  };
  const activeStats = calculateFinalLoadoutStats(activeBuild, { monster: weakMonster });
  const inactiveStats = calculateFinalLoadoutStats(inactiveBuild, { monster: weakMonster });

  assert.equal(canonicalSkillName("Ice Attack Boost Secret"), "Advanced Ice Attack");
  assert.match(skillDescription("Ice Attack Boost Secret", 1), /\+?200|200/);
  assert.equal(activeStats.elementalSkillBonus, 500);
  assert.equal(activeStats.advancedElementalSkillBonus, 200);
  assert.equal(activeStats.potentialElement, 1400);
  assert.equal(inactiveStats.elementalSkillBonus, 350);
  assert.equal(inactiveStats.advancedElementalSkillBonus, 0);
});

test("Velkhana Armor is normalized to Velkhana Aegis with current official detail text", () => {
  assert.equal(canonicalSkillName("Velkhana Armor"), "Velkhana Aegis");
  assert.match(skillDescription("Velkhana Armor", 1), /ice element attack power by 10%/i);
  assert.match(skillDescription("Velkhana Armor", 2), /40% of maximum health/i);
});

test("Offensive Guard and Offensive Dodger show current official skill detail text", () => {
  assert.match(skillDescription("Offensive Guard", 1), /10% for 10 seconds after executing a well-timed guard/i);
  assert.match(skillDescription("Offensive Guard", 5), /40% for 10 seconds after executing a well-timed guard/i);
  assert.equal(canonicalSkillName("Offensive Dodge"), "Offensive Dodger");
  assert.match(skillDescription("Offensive Dodger", 1), /10% for 15 seconds after performing a perfect evade/i);
  assert.match(skillDescription("Offensive Dodge", 5), /35% for 15 seconds after performing a perfect evade/i);
});
