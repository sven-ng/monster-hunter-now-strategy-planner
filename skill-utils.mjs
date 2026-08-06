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
  "Fire Attack": ["Increases your weapon's fire element value."],
  "Water Attack": ["Increases your weapon's water element value."],
  "Thunder Attack": ["Increases your weapon's thunder element value."],
  "Ice Attack": ["Increases your weapon's ice element value."],
  "Dragon Attack": ["Increases your weapon's dragon element value."],
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
