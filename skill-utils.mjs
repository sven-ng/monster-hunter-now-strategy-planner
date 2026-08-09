import { GAME_DATA } from "./data/game-data.mjs?v=2026-08-09-skill-bulk-sync";
import { OFFICIAL_SKILL_DESCRIPTIONS, OFFICIAL_SKILL_NAME_ALIASES } from "./data/official-skill-descriptions.mjs?v=2026-08-09-skill-bulk-sync";

const SKILL_NAME_ALIASES = OFFICIAL_SKILL_NAME_ALIASES;

const SKILL_DESCRIPTIONS = OFFICIAL_SKILL_DESCRIPTIONS;

export function canonicalSkillName(name) {
  if (typeof name !== "string") return name;
  return SKILL_NAME_ALIASES[name] ?? name;
}

export function normalizeSkill(skill) {
  if (!skill) return skill;
  return { ...skill, name: canonicalSkillName(skill.name) };
}

export function normalizeSkills(skills = []) {
  return skills.map(normalizeSkill);
}

export function skillDescription(name, level, fallbackEffect = "") {
  const canonicalName = canonicalSkillName(name);
  const descriptions = SKILL_DESCRIPTIONS[canonicalName];
  if (descriptions?.length) {
    return descriptions[Math.max(0, Math.min(descriptions.length - 1, (Number(level) || 1) - 1))];
  }
  if (fallbackEffect && fallbackEffect !== "Official guide skill" && fallbackEffect !== "Selected Driftsmelt skill") {
    return fallbackEffect;
  }
  return "Official guide skill. Detailed effect text is not mapped yet in Field Kit.";
}

export function skillDescriptions(name, fallbackEffect = "", currentLevel = 1) {
  const canonicalName = canonicalSkillName(name);
  const descriptions = SKILL_DESCRIPTIONS[canonicalName];
  if (descriptions?.length) {
    if (descriptions.length > 1) {
      return descriptions;
    }
    const rowCount = Math.max(descriptions.length, publishedSkillLevelCount(canonicalName), Number(currentLevel) || 1);
    return Array.from({ length: rowCount }, () => descriptions[0]);
  }
  const generic = skillDescription(canonicalName, 1, fallbackEffect);
  const rowCount = Math.max(publishedSkillLevelCount(canonicalName), Number(currentLevel) || 1);
  if (rowCount > 1) {
    return Array.from({ length: rowCount }, () => generic);
  }
  if (descriptions?.length) {
    return descriptions;
  }
  return [generic];
}

const PUBLISHED_SKILL_LEVELS = buildPublishedSkillLevels();

function buildPublishedSkillLevels() {
  const levels = new Map();
  for (const gear of [...GAME_DATA.weapons, ...GAME_DATA.armor]) {
    collectSkillLevels(gear.skills, levels);
    for (const gradeOption of gear.gradeOptions ?? []) {
      collectSkillLevels(gradeOption.skills, levels);
    }
  }
  return levels;
}

function collectSkillLevels(skills = [], levels) {
  for (const skill of skills) {
    const name = canonicalSkillName(skill.name);
    levels.set(name, Math.max(levels.get(name) ?? 0, Number(skill.level) || 0));
  }
}

function publishedSkillLevelCount(name) {
  return PUBLISHED_SKILL_LEVELS.get(canonicalSkillName(name)) ?? 1;
}
