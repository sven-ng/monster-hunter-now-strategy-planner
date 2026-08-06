import { readFileSync, writeFileSync } from "node:fs";

const SOURCE_URLS = {
  monsters: "https://monsterhunternow.com/en/monsters",
  weapons: "https://monsterhunternow.com/en/weapons",
  armor: "https://monsterhunternow.com/en/armor",
};

const inputFiles = new Map(
  process.argv.slice(2).flatMap((argument) => {
    const [kind, path] = argument.split("=");
    return kind && path ? [[kind.replace(/^--/, ""), path]] : [];
  }),
);

async function sourceHtml(kind) {
  const inputFile = inputFiles.get(kind);
  if (inputFile) {
    return readFileSync(inputFile, "utf8");
  }

  const response = await fetch(SOURCE_URLS[kind]);
  if (!response.ok) {
    throw new Error(`Could not fetch ${SOURCE_URLS[kind]}: ${response.status}`);
  }
  return response.text();
}

function componentProps(html, component) {
  const raw = html.match(new RegExp(`component="${component}" props="([\\s\\S]*?)" class=`))?.[1];
  if (!raw) {
    throw new Error(`Could not find ${component} data in official guide HTML.`);
  }
  return JSON.parse(raw.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
}

function titleCase(value) {
  return value
    .replace(/^SERIES_/, "")
    .replace(/_(\d+)$/, " $1")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function displayName(translation, fallback) {
  return (translation ?? titleCase(fallback)).replace(/\s+\d+$/, "");
}

function weaponType(category) {
  return {
    SWORD_SHIELD: "Sword & Shield",
    DUAL_BLADES: "Dual Blades",
    GREAT_SWORD: "Great Sword",
    LONG_SWORD: "Long Sword",
    HUNTING_HORN: "Hunting Horn",
    LIGHT_BOWGUN: "Light Bowgun",
    HEAVY_BOWGUN: "Heavy Bowgun",
  }[category] ?? titleCase(category);
}

function armorPart(category) {
  return { HEAD: "Head", CHEST: "Chest", ARMS: "Arms", TORSO: "Waist", LEGS: "Legs" }[category] ?? titleCase(category);
}

function normalize(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sourceMonsterId(series, monsterIds) {
  const normalizedSeries = normalize(series);
  return [...monsterIds]
    .sort((left, right) => right.length - left.length)
    .find((id) => normalizedSeries.includes(normalize(id))) ?? null;
}

function formatSkill(skill) {
  return {
    name: titleCase(skill.kind),
    level: skill.level,
    effect: "Official guide skill",
  };
}

function snapshotWeapon(weapon, translations, monsterIds) {
  const topGrade = weapon.grades.at(-1);
  const topLevel = topGrade.levels.at(-1);
  const translatedName = weapon.grades
    .slice()
    .reverse()
    .map((grade) => translations[grade.name])
    .find(Boolean);

  return {
    id: weapon.id.toLowerCase(),
    name: displayName(translatedName, `${weapon.series}_${weapon.category}`),
    type: weaponType(weapon.category),
    grade: topGrade.grade,
    level: topLevel.level,
    attack: topLevel.attack,
    affinity: topLevel.critical,
    element: topLevel.elementAttack > 0 ? { type: titleCase(weapon.element), value: topLevel.elementAttack } : null,
    sourceMonsterId: sourceMonsterId(weapon.series, monsterIds),
    skills: topGrade.skills.map(formatSkill),
    materials: [],
    requirementsStatus: "not-published",
    officialNameKey: topGrade.name,
    imageUrl: topGrade.imageUrl,
    gradeOptions: weapon.grades.map((grade) => ({
      grade: grade.grade,
      levels: grade.levels.map((level) => ({
        level: level.level,
        attack: level.attack,
        elementAttack: level.elementAttack,
        affinity: level.critical,
      })),
      skills: grade.skills.map(formatSkill),
    })),
  };
}

function snapshotArmor(piece, translations, monsterIds) {
  const topGrade = piece.grades.at(-1);
  const translatedName = piece.grades
    .slice()
    .reverse()
    .map((grade) => translations[grade.name])
    .find(Boolean);

  return {
    id: piece.id.toLowerCase(),
    name: displayName(translatedName, `${piece.series}_${piece.category}`),
    part: armorPart(piece.category),
    grade: topGrade.grade,
    level: topGrade.defense.length,
    defense: topGrade.defense.at(-1),
    sourceMonsterId: sourceMonsterId(piece.series, monsterIds),
    skills: topGrade.skills.map(formatSkill),
    materials: [],
    requirementsStatus: "not-published",
    officialNameKey: topGrade.name,
    imageUrl: piece.mImageUrl,
    driftsmeltSlots: topGrade.driftsmeltSlots,
    gradeOptions: piece.grades.map((grade) => ({
      grade: grade.grade,
      levels: grade.defense.map((defense, index) => ({ level: index + 1, defense })),
      skills: grade.skills.map(formatSkill),
      driftsmeltSlots: grade.driftsmeltSlots,
    })),
  };
}

function snapshotMaterial(item, monster) {
  return {
    id: item.name.toLowerCase(),
    name: titleCase(item.name),
    rarity: item.itemRarity,
    minGrade: item.minGrade,
    sourceMonsterIds: [monster.id],
    driftMaterial: item.driftMaterial,
    officialNameKey: item.name,
    imageUrl: item.imageUrl,
  };
}

const [monsterHtml, weaponHtml, armorHtml] = await Promise.all([
  sourceHtml("monsters"),
  sourceHtml("weapons"),
  sourceHtml("armor"),
]);
const officialMonsters = componentProps(monsterHtml, "SortableMonsterList");
const officialWeapons = componentProps(weaponHtml, "SortableWeaponList");
const officialArmor = componentProps(armorHtml, "SortableArmorList");

const monsters = officialMonsters.monsters.map((monster) => ({
  id: monster.id,
  name: monster.name,
  species: titleCase(monster.species),
  element: monster.element.map(titleCase),
  weakness: monster.weakness.map(titleCase),
  habitats: monster.habitat.map((habitat) => titleCase(habitat.replace(/^AREA_TYPE_/, ""))),
  recommendedGrade: monster.minGrade,
  drops: monster.itemData.map((item) => item.name.toLowerCase()),
  notes: "Official guide snapshot. Hunt fit is based on elemental matchup, not a damage simulation.",
  releaseDate: monster.releaseDate,
  imageUrl: monster.icon?.src ?? monster.fieldIconUrl,
}));
const monsterIds = new Set(monsters.map((monster) => monster.id));

const materialMap = new Map();
for (const officialMonster of officialMonsters.monsters) {
  for (const item of officialMonster.itemData) {
    const material = snapshotMaterial(item, officialMonster);
    const existing = materialMap.get(material.id);
    if (existing) {
      existing.sourceMonsterIds.push(officialMonster.id);
    } else {
      materialMap.set(material.id, material);
    }
  }
}

const data = {
  meta: {
    title: "Monster Hunter Now Strategy Planner",
    lastUpdated: new Date().toISOString().slice(0, 10),
    source: "Official Monster Hunter Now guide snapshot",
    sourceUrls: SOURCE_URLS,
    limitations: [
      "Stats are the highest published grade and level for each official gear tree.",
      "The official public guide snapshot does not publish per-gear forge material quantities, so this app does not fabricate them.",
      "Hunt fit is an elemental-match recommendation, not a live in-game damage calculation.",
    ],
  },
  materials: [...materialMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
  monsters,
  weapons: Object.values(officialWeapons.weapons)
    .map((weapon) => snapshotWeapon(weapon, officialWeapons.guideTranslations, monsterIds))
    .sort((left, right) => left.name.localeCompare(right.name)),
  armor: Object.values(officialArmor.armor)
    .map((piece) => snapshotArmor(piece, officialArmor.guideTranslations, monsterIds))
    .sort((left, right) => left.name.localeCompare(right.name)),
};

const output = `// Generated by scripts/sync-official-snapshot.mjs. Do not hand-edit.\nexport const GAME_DATA = ${JSON.stringify(data, null, 2)};\n`;
writeFileSync(new URL("../data/game-data.mjs", import.meta.url), output);
console.log(`Wrote ${data.monsters.length} monsters, ${data.weapons.length} weapons, ${data.armor.length} armor pieces, and ${data.materials.length} materials.`);
