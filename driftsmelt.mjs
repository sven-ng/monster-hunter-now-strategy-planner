export const DRIFTSMELT_SKILLS = [
  "Attack Boost",
  "Critical Eye",
  "Weakness Exploit",
  "Critical Boost",
  "Fire Attack",
  "Water Attack",
  "Thunder Attack",
  "Ice Attack",
  "Dragon Attack",
  "Burst",
  "Focus",
  "Offensive Dodger",
  "Charge Master",
  "Fighting Spirit",
  "Headstrong",
  "Morph Boost",
  "Partbreaker",
  "Special Boost",
  "Earplugs",
  "Dauntless",
  "Reflection",
];

export const MAX_DRIFTSMELT_SKILLS_PER_ARMOR = 20;

export function normalizeDriftsmeltSkillPool(skills) {
  if (!Array.isArray(skills)) return [];
  return skills
    .map(normalizeSkillName)
    .filter(Boolean)
    .slice(0, MAX_DRIFTSMELT_SKILLS_PER_ARMOR);
}

export function normalizeActiveDriftsmeltSkills(skills, slotCount, skillPool = skills) {
  const available = new Map();
  for (const skill of normalizeDriftsmeltSkillPool(skillPool)) {
    available.set(skill, (available.get(skill) ?? 0) + 1);
  }

  return normalizeDriftsmeltSkillPool(skills)
    .filter((skill) => {
      const count = available.get(skill) ?? 0;
      if (!count) return false;
      available.set(skill, count - 1);
      return true;
    })
    .slice(0, Math.max(0, Number(slotCount) || 0));
}

export function applyDriftsmeltSkills(armor, selectedSkills) {
  const driftsmeltSkills = normalizeActiveDriftsmeltSkills(selectedSkills, armor.driftsmeltSlots);
  return {
    ...armor,
    driftsmeltSkills,
    skills: [
      ...armor.skills,
      ...driftsmeltSkills.map((name) => ({ name, level: 1, effect: "Selected Driftsmelt skill" })),
    ],
  };
}

function normalizeSkillName(skill) {
  if (typeof skill !== "string") return null;
  const value = skill.trim().replace(/\s+/g, " ");
  return /^[A-Za-z0-9][A-Za-z0-9 '&+./-]{0,59}$/.test(value) ? value : null;
}
