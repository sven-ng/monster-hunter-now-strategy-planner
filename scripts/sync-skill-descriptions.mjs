import { writeFileSync } from "node:fs";

import { GAME_DATA } from "../data/game-data.mjs";

const DETAIL_PAGE_URL = "https://monsterhunternow.com/en/skills/offensive_guard";
const OUTPUT_FILE = new URL("../data/official-skill-descriptions.mjs", import.meta.url);

const EXTRA_ALIASES = {
  "Burst Dodger": "Offensive Dodger",
  "Dragon Advanced Attack Boost": "Advanced Dragon Attack",
  "Ice Advanced Attack Boost": "Advanced Ice Attack",
  "Offensive Dodge": "Offensive Dodger",
  "Perfect Evade Sp Charge": "Evasive Concentration",
  "Sp Insurance": "Special Insurance",
  "Sp Overdrive": "Elemental Release",
  "Sp Undercurrent": "Meditation",
  "Thunder Advanced Attack Boost": "Advanced Thunder Attack",
  "Water Advanced Attack Boost": "Advanced Water Attack",
};

async function fetchHtml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function titleCaseSlug(slug) {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function decodeEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?b>/gi, "")
    .replace(/<\/?strong>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function currentSkills() {
  const names = new Set();
  for (const gear of [...GAME_DATA.weapons, ...GAME_DATA.armor]) {
    for (const skill of gear.skills ?? []) names.add(skill.name);
    for (const option of gear.gradeOptions ?? []) {
      for (const skill of option.skills ?? []) names.add(skill.name);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

function parseSkillLinks(html) {
  const matches = [...html.matchAll(/<a href="\/en\/skills\/([^"]+)"[^>]*><mh-sidebar-item[^>]*data-content="([^"]+)"/g)];
  return matches.map(([, slug, name]) => ({ slug, name: decodeEntities(name) }));
}

function parseSkillCategories(html) {
  const categories = {};
  const sections = [...html.matchAll(/<div class="_title_[^"]+">([^<]+)<\/div>[\s\S]*?<div class="_sectionContent_[^"]+">([\s\S]*?)<\/div>/g)];
  for (const [, rawCategory, content] of sections) {
    const category = cleanText(rawCategory);
    for (const match of content.matchAll(/<a href="\/en\/skills\/([^"]+)"[^>]*><mh-sidebar-item[^>]*data-content="([^"]+)"/g)) {
      const [, slug, name] = match;
      categories[decodeEntities(name)] = { slug, category };
    }
  }
  return categories;
}

function parseDescriptions(html) {
  const rows = [...html.matchAll(/<tr>\s*<td[^>]*><b>(\d+)<\/b><\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g)];
  return rows.map(([, level, description]) => `Lv.${level}: ${cleanText(description)}`);
}

function inferBehavior(name, descriptions) {
  const text = `${name} ${descriptions.join(" ")}`.toLowerCase();
  const weaponSpecificPhrases = [
    "ammo",
    "arrows",
    "bowgun",
    "gunlance",
    "charge blade",
    "switch axe",
    "dual blades",
    "long sword",
    "hunting horn",
    "insect glaive",
    "when hunting with a close-range weapon",
    "weapon's affinity",
    "charged attacks",
    "optimal distance",
    "reload",
    "recoil",
    "phial",
    "sheathing",
    "transforming your weapon",
  ];
  if (weaponSpecificPhrases.some((phrase) => text.includes(phrase))) {
    return "weapon-specific";
  }

  const conditionalPhrases = [
    "when ",
    "after ",
    "while ",
    "if ",
    "upon ",
    "during ",
    "at the start of a hunt",
    "up to ",
    "chance of",
    "automatically",
    "group hunt",
    "perfect evade",
    "guarding",
    "special gauge becomes full",
    "monster roars",
    "health drops",
    "recovering from",
  ];
  if (conditionalPhrases.some((phrase) => text.includes(phrase))) {
    return "conditional";
  }

  return "always-on";
}

function toModuleText({ aliases, descriptions, metadata, generatedAt }) {
  return `export const OFFICIAL_SKILL_NAME_ALIASES = ${JSON.stringify(aliases, null, 2)};\n\nexport const OFFICIAL_SKILL_DESCRIPTIONS = ${JSON.stringify(descriptions, null, 2)};\n\nexport const OFFICIAL_SKILL_METADATA = ${JSON.stringify(metadata, null, 2)};\n\nexport const OFFICIAL_SKILL_DESCRIPTIONS_GENERATED_AT = ${JSON.stringify(generatedAt)};\n`;
}

const sidebarHtml = await fetchHtml(DETAIL_PAGE_URL);
const skillLinks = parseSkillLinks(sidebarHtml);
if (!skillLinks.length) {
  throw new Error("Could not extract official skill links from the sidebar.");
}
const sidebarCategories = parseSkillCategories(sidebarHtml);

const descriptions = {};
const metadata = {};
for (const { slug, name } of skillLinks) {
  const html = slug === "offensive_guard"
    ? sidebarHtml
    : await fetchHtml(`https://monsterhunternow.com/en/skills/${slug}`);
  const levels = parseDescriptions(html);
  if (levels.length) {
    descriptions[name] = levels;
    metadata[name] = {
      category: sidebarCategories[name]?.category ?? "Unknown",
      behavior: inferBehavior(name, levels),
    };
  }
}

const aliases = { ...EXTRA_ALIASES };
for (const { slug, name } of skillLinks) {
  const slugName = titleCaseSlug(slug);
  if (slugName !== name) {
    aliases[slugName] = name;
  }
}

const unresolved = currentSkills().filter((name) => !descriptions[name] && !descriptions[aliases[name]]);
if (unresolved.length) {
  console.warn(`Unresolved current skills (${unresolved.length}):`);
  console.warn(unresolved.join("\n"));
}

writeFileSync(OUTPUT_FILE, toModuleText({
  aliases,
  descriptions,
  metadata,
  generatedAt: new Date().toISOString(),
}));

console.log(`Wrote ${Object.keys(descriptions).length} official skill descriptions to ${OUTPUT_FILE.pathname}.`);
console.log(`Generated ${Object.keys(aliases).length} skill aliases.`);
