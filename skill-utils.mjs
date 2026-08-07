import { GAME_DATA } from "./data/game-data.mjs?v=2026-08-07-skill-rename-refresh";

const SKILL_NAME_ALIASES = {
  Powerhouse: "Attack Efficacy",
  "Attack Boost Secret": "Advanced Attack Boost",
  "Water Attack Boost Secret": "Advanced Water Attack",
  "Thunder Attack Boost Secret": "Advanced Thunder Attack",
  "Ice Attack Boost Secret": "Advanced Ice Attack",
  "Dragon Attack Boost Secret": "Advanced Dragon Attack",
  "Velkhana Armor": "Velkhana Aegis",
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
  "Advanced Attack Boost": [
    "Lv.1: Increases attack power by 150 when Attack Boost Lv5+ is active.",
    "Lv.2: Increases attack power by 350 when Attack Boost Lv5+ is active.",
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
  "Advanced Water Attack": [
    "Lv.1: Increases weapon's water element value by 200 when Water Attack Lv5+ is active.",
    "Lv.2: Increases weapon's water element value by 400 when Water Attack Lv5+ is active.",
  ],
  "Thunder Attack": [
    "Lv.1: Increases your weapon's thunder element value by 50.",
    "Lv.2: Increases your weapon's thunder element value by 100.",
    "Lv.3: Increases your weapon's thunder element value by 200.",
    "Lv.4: Increases your weapon's thunder element value by 350.",
    "Lv.5: Increases your weapon's thunder element value by 500.",
  ],
  "Advanced Thunder Attack": [
    "Lv.1: Increases weapon's thunder element value by 200 when Thunder Attack Lv5+ is active.",
    "Lv.2: Increases weapon's thunder element value by 400 when Thunder Attack Lv5+ is active.",
  ],
  "Ice Attack": [
    "Lv.1: Increases your weapon's ice element value by 50.",
    "Lv.2: Increases your weapon's ice element value by 100.",
    "Lv.3: Increases your weapon's ice element value by 200.",
    "Lv.4: Increases your weapon's ice element value by 350.",
    "Lv.5: Increases your weapon's ice element value by 500.",
  ],
  "Advanced Ice Attack": [
    "Lv.1: Increases weapon's ice element value by 200 when Ice Attack Lv5+ is active.",
    "Lv.2: Increases weapon's ice element value by 400 when Ice Attack Lv5+ is active.",
  ],
  "Dragon Attack": [
    "Lv.1: Increases your weapon's dragon element value by 50.",
    "Lv.2: Increases your weapon's dragon element value by 100.",
    "Lv.3: Increases your weapon's dragon element value by 200.",
    "Lv.4: Increases your weapon's dragon element value by 350.",
    "Lv.5: Increases your weapon's dragon element value by 500.",
  ],
  "Advanced Dragon Attack": [
    "Lv.1: Increases weapon's dragon element value by 200 when Dragon Attack Lv5+ is active.",
    "Lv.2: Increases weapon's dragon element value by 400 when Dragon Attack Lv5+ is active.",
  ],
  "Velkhana Aegis": [
    "Lv.1: Increases ice element attack power by 10%, and grants extra health equal to 20% of maximum health when using a Special Skill.",
    "Lv.2: Increases ice element attack power by 15%, and grants extra health equal to 40% of maximum health when using a Special Skill.",
    "Lv.3: Increases ice element attack power by 20%, and grants extra health equal to 60% of maximum health when using a Special Skill.",
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
