import { GAME_DATA } from "./data/game-data.mjs?v=2026-08-06-4be9116";

const SKILL_NAME_ALIASES = {
  Powerhouse: "Attack Efficacy",
};

const SKILL_DESCRIPTIONS = {
  "Attack Boost": [
    "Lv.1: Increases attack power by 50.",
    "Lv.2: Increases attack power by 100.",
    "Lv.3: Increases attack power by 150.",
    "Lv.4: Increases attack power by 200.",
    "Lv.5: Increases attack power by 300.",
  ],
  "Attack Efficacy": [
    "Lv.1: Attack power increases by 10%.",
    "Lv.2: Attack power increases by 15%.",
    "Lv.3: Attack power increases by 25%.",
  ],
  "Critical Eye": [
    "Lv.1: Increases affinity by 10%.",
    "Lv.2: Increases affinity by 15%.",
    "Lv.3: Increases affinity by 20%.",
    "Lv.4: Increases affinity by 30%.",
    "Lv.5: Increases affinity by 40%.",
  ],
  "Weakness Exploit": [
    "Lv.1: Increases affinity by 20% when attacking a monster's weak point.",
    "Lv.2: Increases affinity by 25% when attacking a monster's weak point.",
    "Lv.3: Increases affinity by 30% when attacking a monster's weak point.",
    "Lv.4: Increases affinity by 40% when attacking a monster's weak point.",
    "Lv.5: Increases affinity by 50% when attacking a monster's weak point.",
  ],
  "Critical Boost": [
    "Lv.1: Increases the damage multiplier of critical hits to 130%.",
    "Lv.2: Increases the damage multiplier of critical hits to 135%.",
    "Lv.3: Increases the damage multiplier of critical hits to 140%.",
    "Lv.4: Increases the damage multiplier of critical hits to 145%.",
    "Lv.5: Increases the damage multiplier of critical hits to 150%.",
  ],
  Burst: [
    "Lv.1: Landing consecutive hits in a short span of time increases attack power by 5% for 4 seconds.",
    "Lv.2: Landing consecutive hits in a short span of time increases attack power by 10% for 4 seconds.",
    "Lv.3: Landing consecutive hits in a short span of time increases attack power by 15% for 4 seconds.",
    "Lv.4: Landing consecutive hits in a short span of time increases attack power by 20% for 4 seconds.",
    "Lv.5: Landing consecutive hits in a short span of time increases attack power by 30% for 4 seconds.",
  ],
  "Fire Attack": [
    "Lv.1: Increases your weapon's fire element value by 50.",
    "Lv.2: Increases your weapon's fire element value by 100.",
    "Lv.3: Increases your weapon's fire element value by 200.",
    "Lv.4: Increases your weapon's fire element value by 350.",
    "Lv.5: Increases your weapon's fire element value by 500.",
  ],
  "Water Attack": [
    "Lv.1: Increases your weapon's water element value by 50.",
    "Lv.2: Increases your weapon's water element value by 100.",
    "Lv.3: Increases your weapon's water element value by 200.",
    "Lv.4: Increases your weapon's water element value by 350.",
    "Lv.5: Increases your weapon's water element value by 500.",
  ],
  "Thunder Attack": [
    "Lv.1: Increases your weapon's thunder element value by 50.",
    "Lv.2: Increases your weapon's thunder element value by 100.",
    "Lv.3: Increases your weapon's thunder element value by 200.",
    "Lv.4: Increases your weapon's thunder element value by 350.",
    "Lv.5: Increases your weapon's thunder element value by 500.",
  ],
  "Ice Attack": [
    "Lv.1: Increases your weapon's ice element value by 50.",
    "Lv.2: Increases your weapon's ice element value by 100.",
    "Lv.3: Increases your weapon's ice element value by 200.",
    "Lv.4: Increases your weapon's ice element value by 350.",
    "Lv.5: Increases your weapon's ice element value by 500.",
  ],
  "Dragon Attack": [
    "Lv.1: Increases your weapon's dragon element value by 50.",
    "Lv.2: Increases your weapon's dragon element value by 100.",
    "Lv.3: Increases your weapon's dragon element value by 200.",
    "Lv.4: Increases your weapon's dragon element value by 350.",
    "Lv.5: Increases your weapon's dragon element value by 500.",
  ],
};

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
