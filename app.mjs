import { GAME_DATA } from "./data/game-data.mjs";
import { driftsmeltSlotCount, driftsmeltSlotUnlockGrades, filterArmor, filterWeapons } from "./catalogue-filters.mjs";
import { DRIFTSMELT_SKILLS, MAX_DRIFTSMELT_SKILLS_PER_ARMOR, normalizeDriftsmeltSkillPool } from "./driftsmelt.mjs";
import { createLoadout, createLoadoutFromBuild, evaluateLoadout, evaluateSavedLoadouts, hydrateLoadout, replaceLoadout, updateLoadoutGearProgress } from "./loadouts.mjs";
import { buildUpgradePlan } from "./upgrade-planner.mjs";
import {
  aggregateSkills,
  calculateFinalLoadoutStats,
  classifyBuildVsMonster,
  createIndexes,
  getGearAtGrade,
  getMonsterMaterialUsage,
  getRequiredParts,
  recommendedGradeForStars,
  recommendBuilds,
} from "./planner.mjs";

const OWNED_STORAGE_KEY = "mhnow-strategy-planner-owned-gear";
const GEAR_PROGRESS_STORAGE_KEY = "mhnow-strategy-planner-gear-progress";
const LEGACY_GEAR_GRADES_STORAGE_KEY = "mhnow-strategy-planner-gear-grades";
const TARGET_STORAGE_KEY = "mhnow-strategy-planner-target-monster";
const TARGET_STARS_STORAGE_KEY = "mhnow-strategy-planner-target-stars";
const LOADOUTS_STORAGE_KEY = "mhnow-strategy-planner-saved-loadouts";
const FAVORITES_STORAGE_KEY = "mhnow-strategy-planner-favorite-gear";
const DRIFTSMELT_STORAGE_KEY = "mhnow-strategy-planner-driftsmelt-skills";
const { materialById, monsterById, gearById } = createIndexes(GAME_DATA);
const page = document.body.dataset.page ?? "home";
const loadoutIdFromRoute = new URLSearchParams(window.location.search).get("id");

const state = {
  ownedGearIds: loadOwnedGearIds(),
  gearProgress: loadGearProgress(),
  targetMonsterId: loadTargetMonsterId(),
  targetStars: loadTargetStars(),
  preferredWeaponType: "all",
  ownedWeaponsOnly: true,
  savedLoadouts: loadSavedLoadouts(),
  activeLoadoutId: null,
  editingLoadoutId: loadoutIdFromRoute,
  activeUpgradeLoadoutId: null,
  plannerSuggestedBuilds: [],
  plannerFeedback: "",
  loadoutStars: loadTargetStars(),
  assumeWeakPoint: false,
  favoriteGearIds: loadFavoriteGearIds(),
  driftsmeltSkillPools: loadDriftsmeltSkillPools(),
  loadoutDriftsmeltSelections: {},
  openDriftsmeltPoolIds: new Set(),
  searches: { weapons: "", armor: "", monsters: "", materials: "" },
  catalogueFilters: {
    weapons: { type: "all", element: "all", monster: "all", favoritesOnly: false, forgedOnly: false },
    armor: { skill: "all", monster: "all", driftsmeltSlots: "all", favoritesOnly: false, forgedOnly: false },
  },
};

const elements = {
  collectionStatus: document.querySelector("#collection-status"),
  homeStats: document.querySelector("#home-stats"),
  featuredTarget: document.querySelector("#featured-target"),
  homeOutlook: document.querySelector("#home-outlook"),
  plannerBrief: document.querySelector("#planner-brief"),
  targetMonster: document.querySelector("#target-monster"),
  targetStars: document.querySelector("#target-stars"),
  weaponTypeFilter: document.querySelector("#weapon-type-filter"),
  ownedOnly: document.querySelector("#owned-only"),
  plannerWeakPoint: document.querySelector("#planner-weak-point"),
  recommendations: document.querySelector("#recommendations"),
  plannerFeedback: document.querySelector("#planner-feedback"),
  plannerSavedLoadouts: document.querySelector("#planner-saved-loadouts"),
  upgradeLoadout: document.querySelector("#upgrade-loadout"),
  upgradeTarget: document.querySelector("#upgrade-target"),
  upgradeStars: document.querySelector("#upgrade-stars"),
  upgradeSummary: document.querySelector("#upgrade-summary"),
  upgradePriorities: document.querySelector("#upgrade-priorities"),
  upgradeMonsterFocus: document.querySelector("#upgrade-monster-focus"),
  weaponsGrid: document.querySelector("#weapons-grid"),
  armorGrid: document.querySelector("#armor-grid"),
  monstersGrid: document.querySelector("#monsters-grid"),
  materialsGrid: document.querySelector("#materials-grid"),
  weaponSearch: document.querySelector("#weapon-search"),
  armorSearch: document.querySelector("#armor-search"),
  monsterSearch: document.querySelector("#monster-search"),
  materialSearch: document.querySelector("#material-search"),
  weaponTypeCatalogueFilter: document.querySelector("#catalogue-weapon-type"),
  weaponElementCatalogueFilter: document.querySelector("#catalogue-weapon-element"),
  weaponMonsterCatalogueFilter: document.querySelector("#catalogue-weapon-monster"),
  weaponFavoritesCatalogueFilter: document.querySelector("#catalogue-weapon-favorites"),
  armorSkillCatalogueFilter: document.querySelector("#catalogue-armor-skill"),
  armorMonsterCatalogueFilter: document.querySelector("#catalogue-armor-monster"),
  armorDriftsmeltCatalogueFilter: document.querySelector("#catalogue-armor-driftsmelt"),
  armorFavoritesCatalogueFilter: document.querySelector("#catalogue-armor-favorites"),
  loadoutName: document.querySelector("#loadout-name"),
  loadoutWeapon: document.querySelector("#loadout-weapon"),
  loadoutStars: document.querySelector("#loadout-stars"),
  loadoutWeakPoint: document.querySelector("#loadout-weak-point"),
  loadoutSelect: document.querySelector("#loadout-select"),
  saveLoadout: document.querySelector("#save-loadout"),
  loadoutFeedback: document.querySelector("#loadout-feedback"),
  savedLoadouts: document.querySelector("#saved-loadouts"),
  loadoutEditorTitle: document.querySelector("#loadout-editor-title"),
  loadoutEditorCopy: document.querySelector("#loadout-editor-copy"),
  loadoutReviewTitle: document.querySelector("#loadout-review-title"),
  loadoutReviewEdit: document.querySelector("#loadout-review-edit"),
  loadoutSummary: document.querySelector("#loadout-summary"),
  loadoutOutlook: document.querySelector("#loadout-outlook"),
  loadoutParts: Object.fromEntries(getRequiredParts(GAME_DATA).map((part) => [part, document.querySelector(`#loadout-${part.toLowerCase()}`)])),
};

init();

function init() {
  renderCollectionStatus();
  populatePlannerControls();
  populateCatalogueFilters();
  wireEvents();

  if (page === "home") {
    renderHome();
  } else if (page === "planner") {
    renderPlanner();
  } else if (page === "weapons") {
    renderWeapons();
  } else if (page === "armor") {
    renderArmor();
  } else if (page === "monsters") {
    renderMonsters();
  } else if (page === "materials") {
    renderMaterials();
  } else if (page === "loadouts") {
    renderLoadoutLibrary();
  } else if (page === "loadout-editor") {
    renderLoadoutEditor();
  } else if (page === "loadout-review") {
    renderLoadoutReview();
  } else if (page === "upgrades") {
    renderUpgradePlan();
  }
}

function populatePlannerControls() {
  if (!elements.targetMonster) {
    return;
  }

  elements.targetMonster.innerHTML = GAME_DATA.monsters
    .map((monster) => `<option value="${monster.id}">${monster.name}</option>`)
    .join("");
  elements.targetMonster.value = state.targetMonsterId;
  elements.targetStars.innerHTML = Array.from({ length: 10 }, (_, index) => {
    const stars = index + 1;
    return `<option value="${stars}">${stars}-star</option>`;
  }).join("");
  elements.targetStars.value = String(state.targetStars);

  const weaponTypes = [...new Set(GAME_DATA.weapons.map((weapon) => weapon.type))].sort();
  elements.weaponTypeFilter.insertAdjacentHTML(
    "beforeend",
    weaponTypes.map((type) => `<option value="${type}">${type}</option>`).join(""),
  );
  if (elements.plannerWeakPoint) {
    elements.plannerWeakPoint.checked = state.assumeWeakPoint;
  }
}

function populateCatalogueFilters() {
  populateCatalogueSelect(elements.weaponTypeCatalogueFilter, uniqueValues(GAME_DATA.weapons.map((weapon) => weapon.type)), "All weapon types");
  populateCatalogueSelect(elements.weaponElementCatalogueFilter, uniqueValues(GAME_DATA.weapons.map((weapon) => weapon.element?.type ?? "None")), "All elements");
  populateCatalogueSelect(elements.weaponMonsterCatalogueFilter, sourceMonsterOptions(GAME_DATA.weapons), "All source monsters");
  populateCatalogueSelect(elements.armorSkillCatalogueFilter, uniqueValues(GAME_DATA.armor.flatMap((piece) => piece.skills.map((skill) => skill.name))), "All skills");
  populateCatalogueSelect(elements.armorMonsterCatalogueFilter, sourceMonsterOptions(GAME_DATA.armor), "All source monsters");
  populateCatalogueSelect(
    elements.armorDriftsmeltCatalogueFilter,
    uniqueValues(GAME_DATA.armor.map((piece) => String(driftsmeltSlotCount(piece)))).map((value) => ({ value, label: `${value} Driftsmelt slot${value === "1" ? "" : "s"}` })),
    "Any Driftsmelt slots",
  );
}

function populateCatalogueSelect(select, values, placeholder) {
  if (!select) return;
  const options = values.map((value) => typeof value === "string"
    ? `<option value="${value}">${value}</option>`
    : `<option value="${value.value}">${value.label}</option>`);
  select.innerHTML = `<option value="all">${placeholder}</option>${options.join("")}`;
}

function uniqueValues(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sourceMonsterOptions(items) {
  return uniqueValues(items.map((item) => item.sourceMonsterId).filter(Boolean))
    .map((monsterId) => ({ value: monsterId, label: monsterById[monsterId]?.name ?? monsterId }));
}

function wireEvents() {
  elements.targetMonster?.addEventListener("change", (event) => {
    state.targetMonsterId = event.target.value;
    persistTargetMonsterId();
    renderPlanner();
  });

  elements.targetStars?.addEventListener("change", (event) => {
    state.targetStars = Number(event.target.value);
    persistTargetStars();
    renderPlanner();
  });

  elements.weaponTypeFilter?.addEventListener("change", (event) => {
    state.preferredWeaponType = event.target.value;
    renderPlanner();
  });

  elements.ownedOnly?.addEventListener("change", (event) => {
    state.ownedWeaponsOnly = event.target.checked;
    renderPlanner();
  });

  elements.plannerWeakPoint?.addEventListener("change", (event) => {
    state.assumeWeakPoint = event.target.checked;
    renderPlanner();
  });

  elements.upgradeLoadout?.addEventListener("change", (event) => {
    state.activeUpgradeLoadoutId = event.target.value;
    renderUpgradePlan();
  });

  elements.upgradeTarget?.addEventListener("change", (event) => {
    state.targetMonsterId = event.target.value;
    persistTargetMonsterId();
    renderUpgradePlan();
  });

  elements.upgradeStars?.addEventListener("change", (event) => {
    state.targetStars = Number(event.target.value);
    persistTargetStars();
    renderUpgradePlan();
  });

  elements.loadoutStars?.addEventListener("change", (event) => {
    state.loadoutStars = Number(event.target.value);
    renderLoadoutReview();
  });

  elements.loadoutWeakPoint?.addEventListener("change", (event) => {
    state.assumeWeakPoint = event.target.checked;
    renderLoadoutReview();
  });

  elements.loadoutSelect?.addEventListener("change", (event) => {
    state.activeLoadoutId = event.target.value;
    renderLoadoutReview();
  });

  elements.saveLoadout?.addEventListener("click", saveCurrentLoadout);

  wireSearch(elements.weaponSearch, "weapons", renderWeapons);
  wireSearch(elements.armorSearch, "armor", renderArmor);
  wireSearch(elements.monsterSearch, "monsters", renderMonsters);
  wireSearch(elements.materialSearch, "materials", renderMaterials);

  document.body.addEventListener("change", (event) => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement) || !control.dataset.catalogueFilter) {
      return;
    }
    const [catalogue, filter] = control.dataset.catalogueFilter.split(":");
    state.catalogueFilters[catalogue][filter] = control instanceof HTMLInputElement ? control.checked : control.value;
    renderCurrentPage();
  });

  document.body.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    if (select.dataset.loadoutArmorPart) {
      renderLoadoutDriftsmeltSelectors();
      return;
    }
    if (!select.dataset.loadoutDriftsmeltGear) return;
    const gearId = select.dataset.loadoutDriftsmeltGear;
    state.loadoutDriftsmeltSelections[gearId] = [...document.querySelectorAll(`[data-loadout-driftsmelt-gear="${gearId}"]`)]
      .map((control) => control.value)
      .map((value) => value || null);
  });

  document.body.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.gearToggle !== "true") {
      return;
    }
    if (input.checked) {
      state.ownedGearIds.add(input.value);
      const gear = [...GAME_DATA.weapons, ...GAME_DATA.armor].find((item) => item.id === input.value);
      state.gearProgress[input.value] ??= defaultProgressFor(gear);
    } else {
      state.ownedGearIds.delete(input.value);
      delete state.gearProgress[input.value];
      delete state.driftsmeltSkillPools[input.value];
    }
    persistOwnedGearIds();
    persistGearProgress();
    renderCollectionStatus();
    renderCurrentPage();
  });

  document.body.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.dataset.gearGrade) {
      return;
    }
    const gear = gearById[select.dataset.gearGrade];
    state.gearProgress[gear.id] = {
      grade: Number(select.value),
      level: maxLevelFor(gear, Number(select.value)),
    };
    persistGearProgress();
    syncManualLoadoutsWithGear(gear.id);
    renderCurrentPage();
  });

  document.body.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.dataset.gearLevel) {
      return;
    }
    const gear = gearById[select.dataset.gearLevel];
    state.gearProgress[gear.id] = { ...selectedProgressFor(gear), level: Number(select.value) };
    persistGearProgress();
    syncManualLoadoutsWithGear(gear.id);
    renderCurrentPage();
  });

  document.body.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest("[data-plan-monster], [data-loadout-action], [data-favorite-toggle], [data-save-suggestion], [data-driftsmelt-pool-add], [data-driftsmelt-pool-remove], [data-driftsmelt-suggestion]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    if (button.dataset.favoriteToggle) {
      const gearId = button.dataset.favoriteToggle;
      if (state.favoriteGearIds.has(gearId)) {
        state.favoriteGearIds.delete(gearId);
      } else {
        state.favoriteGearIds.add(gearId);
      }
      persistFavoriteGearIds();
      renderCurrentPage();
      return;
    }
    if (button.dataset.driftsmeltPoolAdd) {
      const gearId = button.dataset.driftsmeltPoolAdd;
      const select = document.querySelector(`[data-driftsmelt-pool-input="${gearId}"]`);
      const skill = select?.value;
      const pool = state.driftsmeltSkillPools[gearId] ?? [];
      if (skill && pool.length < MAX_DRIFTSMELT_SKILLS_PER_ARMOR) {
        state.driftsmeltSkillPools[gearId] = [...pool, skill];
        state.openDriftsmeltPoolIds.add(gearId);
        persistDriftsmeltSkillPools();
        renderCurrentPage();
      }
      return;
    }
    if (button.dataset.driftsmeltSuggestion) {
      const gearId = button.dataset.driftsmeltSuggestionGear;
      const input = document.querySelector(`[data-driftsmelt-pool-input="${gearId}"]`);
      if (input instanceof HTMLInputElement) {
        input.value = decodeURIComponent(button.dataset.driftsmeltSuggestion);
        renderDriftsmeltSuggestions(input);
        input.focus();
      }
      return;
    }
    if (button.dataset.driftsmeltPoolRemove) {
      const gearId = button.dataset.driftsmeltPoolRemove;
      const index = Number(button.dataset.driftsmeltPoolIndex);
      const pool = [...(state.driftsmeltSkillPools[gearId] ?? [])];
      if (Number.isInteger(index) && index >= 0 && index < pool.length) {
        pool.splice(index, 1);
        state.driftsmeltSkillPools[gearId] = pool;
        state.openDriftsmeltPoolIds.add(gearId);
        persistDriftsmeltSkillPools();
        renderCurrentPage();
      }
      return;
    }
    if (button.dataset.saveSuggestion !== undefined) {
      saveSuggestedBuild(Number(button.dataset.saveSuggestion));
      return;
    }
    if (button.dataset.loadoutAction === "delete") {
      state.savedLoadouts = state.savedLoadouts.filter((loadout) => loadout.id !== button.dataset.loadoutId);
      state.activeLoadoutId = state.savedLoadouts[0]?.id ?? null;
      persistSavedLoadouts();
      renderLoadoutLibrary();
      return;
    }
    state.targetMonsterId = button.dataset.planMonster;
    persistTargetMonsterId();
    window.location.href = "planner.html";
  });

  document.body.addEventListener("input", (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.driftsmeltPoolInput) {
      renderDriftsmeltSuggestions(input);
    }
  });

  document.body.addEventListener("toggle", (event) => {
    const panel = event.target;
    if (!(panel instanceof HTMLDetailsElement) || !panel.dataset.driftsmeltPool) return;
    if (panel.open) {
      state.openDriftsmeltPoolIds.add(panel.dataset.driftsmeltPool);
    } else {
      state.openDriftsmeltPoolIds.delete(panel.dataset.driftsmeltPool);
    }
  }, true);
}

function wireSearch(input, key, renderer) {
  input?.addEventListener("input", (event) => {
    state.searches[key] = event.target.value.trim().toLowerCase();
    renderer();
  });
}

function renderCurrentPage() {
  if (page === "home") renderHome();
  if (page === "planner") renderPlanner();
  if (page === "weapons") renderWeapons();
  if (page === "armor") renderArmor();
  if (page === "monsters") renderMonsters();
  if (page === "materials") renderMaterials();
  if (page === "loadouts") renderLoadoutLibrary();
  if (page === "loadout-editor") renderLoadoutEditor();
  if (page === "loadout-review") renderLoadoutReview();
  if (page === "upgrades") renderUpgradePlan();
}

function renderCollectionStatus() {
  if (!elements.collectionStatus) return;
  const owned = GAME_DATA.weapons.filter((item) => state.ownedGearIds.has(item.id)).length
    + GAME_DATA.armor.filter((item) => state.ownedGearIds.has(item.id)).length;
  elements.collectionStatus.textContent = `${owned} forged pieces`;
}

function renderHome() {
  const target = monsterById[state.targetMonsterId];
  const bestBuild = getRecommendedBuilds()[0];
  const ownedWeapons = GAME_DATA.weapons.filter((item) => state.ownedGearIds.has(item.id)).length;
  const ownedArmor = GAME_DATA.armor.filter((item) => state.ownedGearIds.has(item.id)).length;
  const elementalEdges = bestBuild
    ? GAME_DATA.monsters.filter((monster) => classifyBuildVsMonster(bestBuild, monster, state.targetStars).tier === "easy").length
    : 0;

  elements.homeStats.innerHTML = [
    statCard("Forged weapons", ownedWeapons),
    statCard("Forged armor", ownedArmor),
    statCard("Elemental edges", elementalEdges),
    statCard("Official monsters", GAME_DATA.monsters.length),
  ].join("");
  elements.featuredTarget.innerHTML = monsterFeature(target, bestBuild);
  elements.homeOutlook.innerHTML = (bestBuild ? GAME_DATA.monsters
    .filter((monster) => classifyBuildVsMonster(bestBuild, monster, state.targetStars).tier === "easy")
    .slice(0, 6)
    .map((monster) => compactMonsterCard(monster))
    .join("") : "") || '<p class="empty-state">Mark your forged weapon and armor grades to see your real hunt outlook.</p>';
}

function renderPlanner() {
  const target = monsterById[state.targetMonsterId];
  const builds = getRecommendedBuilds();
  state.plannerSuggestedBuilds = builds;
  const savedBuilds = evaluateSavedLoadouts(state.savedLoadouts, {
    data: GAME_DATA,
    targetMonsterId: state.targetMonsterId,
    targetStars: state.targetStars,
    assumeWeakPoint: state.assumeWeakPoint,
  });
  const topBuild = builds[0];
  elements.plannerBrief.innerHTML = monsterFeature(target, topBuild);
  elements.plannerSavedLoadouts.innerHTML = savedBuilds.length
    ? savedBuilds.map((build, index) => buildCard(build, index, { saved: true })).join("")
    : '<p class="empty-state">No saved loadouts yet. <a href="loadouts.html">Save your current build</a> to compare it against this hunt before following a suggested set.</p>';
  elements.recommendations.innerHTML = builds.length
    ? builds.map((build, index) => buildCard(build, index)).join("")
    : '<p class="empty-state">Your forged set is incomplete for this filter. Mark one weapon and one piece in every armor slot, or turn off “use only my forged gear” to plan a future build.</p>';
  elements.plannerFeedback.textContent = state.plannerFeedback;
}

function renderWeapons() {
  const items = filterWeapons(GAME_DATA.weapons, {
    ...state.catalogueFilters.weapons,
    query: state.searches.weapons,
  }, state.favoriteGearIds, state.ownedGearIds);
  elements.weaponsGrid.innerHTML = catalogueGrid(items, 60, weaponCard, "weapons");
}

function renderArmor() {
  const items = filterArmor(GAME_DATA.armor.map(displayGear), {
    ...state.catalogueFilters.armor,
    query: state.searches.armor,
  }, state.favoriteGearIds, state.ownedGearIds);
  elements.armorGrid.innerHTML = catalogueGrid(items, 60, armorCard, "armor pieces");
}

function renderMonsters() {
  const items = filterBySearch(GAME_DATA.monsters, state.searches.monsters, (monster) =>
    `${monster.name} ${monster.species} ${monster.weakness.join(" ")} ${monster.habitats.join(" ")}`,
  );
  elements.monstersGrid.innerHTML = catalogueGrid(items, items.length, monsterCard, "monsters");
}

function renderMaterials() {
  const items = filterBySearch(GAME_DATA.materials, state.searches.materials, (material) =>
    `${material.name} ${material.sourceMonsterIds.map((id) => monsterById[id]?.name ?? id).join(" ")}`,
  );
  elements.materialsGrid.innerHTML = catalogueGrid(items, 72, materialCard, "materials");
}

function renderLoadoutLibrary() {
  if (!elements.savedLoadouts) return;
  elements.savedLoadouts.innerHTML = state.savedLoadouts.length
    ? state.savedLoadouts.map(loadoutLibraryCard).join("")
    : '<p class="empty-state">No saved loadouts yet. Create a build from your forged gear, then review it against every monster.</p>';
}

function renderLoadoutEditor() {
  const editingLoadout = getEditingLoadout();
  if (state.editingLoadoutId && !editingLoadout) {
    window.location.replace("loadouts.html");
    return;
  }
  populateLoadoutControls(editingLoadout);
  if (elements.loadoutEditorTitle) {
    elements.loadoutEditorTitle.textContent = editingLoadout ? `Edit ${editingLoadout.name}` : "Create a loadout";
  }
  if (elements.loadoutEditorCopy) {
    elements.loadoutEditorCopy.textContent = editingLoadout
      ? "Change the gear or active Driftsmelt skills, then save updates to this same loadout."
      : "Choose your forged gear and select the Driftsmelt skills active in this specific build.";
  }
}

function renderLoadoutReview() {
  const activeLoadout = state.savedLoadouts.find((loadout) => loadout.id === loadoutIdFromRoute)
    ?? state.savedLoadouts.find((loadout) => loadout.id === state.activeLoadoutId)
    ?? state.savedLoadouts[0];
  if (!activeLoadout) {
    if (elements.loadoutSummary) elements.loadoutSummary.innerHTML = '<p class="empty-state">No saved loadout to review. Create one in the build editor first.</p>';
    if (elements.loadoutOutlook) elements.loadoutOutlook.innerHTML = "";
    return;
  }
  state.activeLoadoutId = activeLoadout.id;
  if (elements.loadoutReviewTitle) elements.loadoutReviewTitle.textContent = activeLoadout.name;
  if (elements.loadoutReviewEdit) elements.loadoutReviewEdit.href = `loadout-editor.html?id=${encodeURIComponent(activeLoadout.id)}`;
  elements.loadoutStars.value = String(state.loadoutStars);
  elements.loadoutWeakPoint.checked = state.assumeWeakPoint;

  const build = hydrateLoadout(activeLoadout, GAME_DATA);
  const finalStats = calculateFinalLoadoutStats(build, { assumeWeakPoint: state.assumeWeakPoint });
  const evaluations = evaluateLoadout(activeLoadout, {
    data: GAME_DATA,
    targetStars: state.loadoutStars,
    assumeWeakPoint: state.assumeWeakPoint,
  });
  const counts = evaluations.reduce((totals, item) => ({ ...totals, [item.result.tier]: totals[item.result.tier] + 1 }), { easy: 0, fair: 0, hard: 0 });
  elements.loadoutSummary.innerHTML = savedLoadoutSummary(activeLoadout, build, counts, finalStats);
  elements.loadoutOutlook.innerHTML = loadoutOutlookMarkup(evaluations);
}

function renderUpgradePlan() {
  const activeLoadout = state.savedLoadouts.find((loadout) => loadout.id === state.activeUpgradeLoadoutId) ?? state.savedLoadouts[0];
  state.activeUpgradeLoadoutId = activeLoadout?.id ?? null;
  elements.upgradeLoadout.innerHTML = state.savedLoadouts.length
    ? state.savedLoadouts.map((loadout) => `<option value="${loadout.id}" ${loadout.id === state.activeUpgradeLoadoutId ? "selected" : ""}>${loadout.name}</option>`).join("")
    : '<option value="">No saved loadouts</option>';
  elements.upgradeLoadout.disabled = !activeLoadout;
  elements.upgradeTarget.innerHTML = GAME_DATA.monsters.map((monster) => `<option value="${monster.id}">${monster.name}</option>`).join("");
  elements.upgradeTarget.value = state.targetMonsterId;
  elements.upgradeStars.innerHTML = Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}">${index + 1}-star</option>`).join("");
  elements.upgradeStars.value = String(state.targetStars);

  if (!activeLoadout) {
    const empty = '<p class="empty-state">Save a loadout first. The Upgrade Plan uses its exact Grade and Level values to identify your next best upgrades.</p>';
    elements.upgradeSummary.innerHTML = empty;
    elements.upgradePriorities.innerHTML = "";
    elements.upgradeMonsterFocus.innerHTML = "";
    return;
  }

  const plan = buildUpgradePlan({
    loadout: activeLoadout,
    data: GAME_DATA,
    targetMonsterId: state.targetMonsterId,
    targetStars: state.targetStars,
    assumeWeakPoint: state.assumeWeakPoint,
  });
  elements.upgradeSummary.innerHTML = upgradeSummaryMarkup(plan);
  elements.upgradePriorities.innerHTML = plan.upgrades.length
    ? plan.upgrades.map(upgradePriorityCard).join("")
    : '<p class="empty-state">Every piece in this saved loadout is at its published maximum Grade and Level.</p>';
  elements.upgradeMonsterFocus.innerHTML = plan.monsterFocus.map(upgradeMonsterFocusCard).join("");
}

function upgradeSummaryMarkup(plan) {
  return `<div class="upgrade-summary-copy"><p class="eyebrow">${plan.loadoutName}</p><h2>${plan.targetMonster.name} at ${plan.targetStars}-star</h2><p>Current reference damage: <b>${plan.currentStats.referenceDamage}</b> · Final raw: <b>${plan.currentStats.rawAttack}</b> · Defense: <b>${plan.currentStats.defense}</b></p></div><p class="upgrade-disclaimer">Ranked by the next exact upgrade's projected gain. Monster-series sources guide farming focus; forge recipes and required quantities are not published in the official guide.</p>`;
}

function upgradePriorityCard(entry, index) {
  const gain = entry.damageGain ? `+${entry.damageGain} reference damage` : `+${entry.defenseGain} defense`;
  const source = entry.sourceMonsterId ? sourceMonsterLabel(entry.sourceMonsterId) : "Gatherable materials";
  return `<article class="upgrade-card ${index === 0 ? "top-upgrade" : ""}">${imageMarkup(entry.gear, "upgrade-gear-image")}<div><span class="type-label">${index === 0 ? "Next priority" : entry.kind}</span><h3>${entry.gear.name}</h3><p>G${entry.gear.grade} L${entry.gear.level} -> G${entry.nextGear.grade} L${entry.nextGear.level}</p><strong>${gain}</strong>${entry.newSkills.length ? `<small>Unlocks: ${entry.newSkills.map((skill) => `${skill.name} Lv.${skill.level}`).join(" · ")}</small>` : ""}</div><div class="upgrade-source"><span>Focus hunt</span><b>${source}</b></div></article>`;
}

function upgradeMonsterFocusCard(group, index) {
  const source = group.monster?.name ?? "Gatherable materials";
  const itemNames = group.upgrades.map((entry) => entry.gear.name).join(" · ");
  const content = `${group.monster ? imageMarkup(group.monster, "focus-monster-image") : '<div class="focus-monster-image image-fallback">MAT</div>'}<div><span class="type-label">Focus ${index + 1}</span><h3>${source}</h3><p>Supports ${group.upgrades.length} next upgrade${group.upgrades.length === 1 ? "" : "s"}</p><small>${itemNames}</small></div>`;
  return group.monster
    ? `<button class="monster-focus-card" type="button" data-plan-monster="${group.monster.id}" aria-label="Plan a hunt for ${group.monster.name}">${content}</button>`
    : `<article class="monster-focus-card">${content}</article>`;
}

function populateLoadoutControls(editingLoadout = null) {
  if (!elements.loadoutWeapon) {
    return;
  }
  const ownedWeapons = GAME_DATA.weapons.filter((item) => state.ownedGearIds.has(item.id) || item.id === editingLoadout?.weaponId);
  elements.loadoutWeapon.innerHTML = buildLoadoutOptions(ownedWeapons, "Choose a forged weapon");
  elements.loadoutWeapon.value = editingLoadout?.weaponId ?? "";
  for (const part of getRequiredParts(GAME_DATA)) {
    const selectedArmorId = editingLoadout?.armorIds?.[part];
    const ownedPieces = GAME_DATA.armor.filter((item) => item.part === part && (state.ownedGearIds.has(item.id) || item.id === selectedArmorId));
    elements.loadoutParts[part].innerHTML = buildLoadoutOptions(ownedPieces, `Choose forged ${part.toLowerCase()} armor`);
    elements.loadoutParts[part].value = selectedArmorId ?? "";
    elements.loadoutParts[part].dataset.loadoutArmorPart = part;
  }
  elements.loadoutName.value = editingLoadout?.name ?? "";
  state.loadoutDriftsmeltSelections = editingLoadout ? driftsmeltSelectionsForLoadout(editingLoadout) : {};
  renderLoadoutDriftsmeltSelectors();
}

function renderLoadoutDriftsmeltSelectors() {
  const container = document.querySelector("#loadout-driftsmelt");
  if (!container || !elements.loadoutWeapon) return;
  const selectedArmor = getRequiredParts(GAME_DATA)
    .map((part) => gearById[elements.loadoutParts[part]?.value])
    .filter(Boolean)
    .map(displayGear);
  const activeArmorIds = new Set(selectedArmor.map((piece) => piece.id));
  state.loadoutDriftsmeltSelections = Object.fromEntries(
    Object.entries(state.loadoutDriftsmeltSelections).filter(([gearId]) => activeArmorIds.has(gearId)),
  );

  if (!selectedArmor.length) {
    container.innerHTML = '<p class="driftsmelt-loadout-note">Choose forged armor to select which recorded Driftsmelt skills are active in this loadout.</p>';
    return;
  }

  const editors = selectedArmor.map((piece) => {
    const slotCount = driftsmeltSlotCount(piece);
    const pool = state.driftsmeltSkillPools[piece.id] ?? [];
    if (!slotCount) {
      return `<article class="loadout-driftsmelt-piece"><b>${piece.part}: ${piece.name}</b><span>No active Driftsmelt slots at G${piece.grade}</span></article>`;
    }
    const selections = state.loadoutDriftsmeltSelections[piece.id] ?? [];
    const options = pool.map((skill, index) => `<option value="${index}">${skill} Lv.1</option>`).join("");
    const slots = Array.from({ length: slotCount }, (_, index) => {
      const selectedIndex = selections[index] ?? "";
      return `<label>Slot ${index + 1}<select data-loadout-driftsmelt-gear="${piece.id}"><option value="">No active skill</option>${options.replace(`value="${selectedIndex}"`, `value="${selectedIndex}" selected`)}</select></label>`;
    }).join("");
    return `<article class="loadout-driftsmelt-piece"><b>${piece.part}: ${piece.name}</b><span>${pool.length}/${MAX_DRIFTSMELT_SKILLS_PER_ARMOR} recorded skills · ${slotCount} active slot${slotCount === 1 ? "" : "s"}</span><div>${pool.length ? slots : '<small>Record skills for this armor on the Armor page first.</small>'}</div></article>`;
  }).join("");
  container.innerHTML = `<div class="loadout-driftsmelt-heading"><p class="eyebrow">Active Driftsmelt</p><h3>Choose the skills active in this loadout</h3><p>Only selected slots are saved and applied to the build.</p></div><div class="loadout-driftsmelt-grid">${editors}</div>`;
}

function saveCurrentLoadout() {
  const existingLoadout = getEditingLoadout();
  const weaponId = elements.loadoutWeapon.value;
  const armorIds = Object.fromEntries(getRequiredParts(GAME_DATA).map((part) => [part, elements.loadoutParts[part].value]));
  const selectedIds = [weaponId, ...Object.values(armorIds)];
  const gearProgress = Object.fromEntries(selectedIds.map((gearId) => {
    const gear = gearById[gearId];
    return [gearId, gear ? selectedProgressFor(gear) : undefined];
  }));
  const loadout = createLoadout({
    id: existingLoadout?.id ?? `loadout-${Date.now()}`,
    name: elements.loadoutName.value,
    weaponId,
    armorIds,
    gearProgress,
    activeDriftsmeltSkills: activeLoadoutDriftsmeltSkills(),
    driftsmeltSkillPools: state.driftsmeltSkillPools,
    origin: existingLoadout?.origin === "suggested" ? "manual" : existingLoadout?.origin ?? "manual",
    data: GAME_DATA,
  });

  if (!loadout) {
    elements.loadoutFeedback.textContent = "Enter a name and choose one forged weapon plus all five armor slots.";
    return;
  }

  const savedLoadout = existingLoadout
    ? { ...loadout, createdAt: existingLoadout.createdAt }
    : loadout;
  state.savedLoadouts = existingLoadout
    ? replaceLoadout(state.savedLoadouts, savedLoadout)
    : [...state.savedLoadouts, savedLoadout];
  state.activeLoadoutId = savedLoadout.id;
  elements.loadoutFeedback.textContent = existingLoadout ? `Updated ${savedLoadout.name}.` : `Saved ${savedLoadout.name}.`;
  persistSavedLoadouts();
  window.location.href = `loadout-review.html?id=${encodeURIComponent(savedLoadout.id)}`;
}

function saveSuggestedBuild(index) {
  const build = state.plannerSuggestedBuilds[index];
  if (!build) return;
  const name = `${build.targetMonster.name} plan - ${build.weapon.name}`;
  const loadout = createLoadoutFromBuild({
    id: `suggested-${Date.now()}`,
    name,
    build,
    data: GAME_DATA,
  });
  if (!loadout) return;

  state.savedLoadouts.push(loadout);
  state.activeLoadoutId = loadout.id;
  state.activeUpgradeLoadoutId = loadout.id;
  state.plannerFeedback = `Saved “${loadout.name}” to Loadouts as an upgrade target.`;
  persistSavedLoadouts();
  renderPlanner();
}

function catalogueGrid(items, limit, renderer, label) {
  if (!items.length) {
    return '<p class="empty-state">No matches. Try another monster, element, weapon type, or material name.</p>';
  }
  const note = items.length > limit
    ? `<p class="catalogue-count">Showing ${limit} of ${items.length} ${label}. Search to narrow the list.</p>`
    : "";
  return `${note}<div class="catalogue-grid">${items.slice(0, limit).map(renderer).join("")}</div>`;
}

function buildLoadoutOptions(items, placeholder) {
  const options = items
    .map((item) => {
      const current = displayGear(item);
      return `<option value="${item.id}">${current.name} · G${current.grade} L${current.level}</option>`;
    })
    .join("");
  return `<option value="">${placeholder}</option>${options}`;
}

function getEditingLoadout() {
  return state.savedLoadouts.find((loadout) => loadout.id === state.editingLoadoutId) ?? null;
}

function driftsmeltSelectionsForLoadout(loadout) {
  return Object.fromEntries(Object.entries(loadout.driftsmeltSkills ?? {}).map(([gearId, selectedSkills]) => {
    const pool = state.driftsmeltSkillPools[gearId] ?? [];
    const usedIndexes = new Set();
    return [gearId, selectedSkills.map((skill) => {
      const index = pool.findIndex((candidate, candidateIndex) => candidate === skill && !usedIndexes.has(candidateIndex));
      if (index >= 0) usedIndexes.add(index);
      return index >= 0 ? String(index) : null;
    })];
  }));
}

function loadoutLibraryCard(loadout) {
  const build = hydrateLoadout(loadout, GAME_DATA);
  if (!build) {
    return "";
  }
  const activeDriftsmelt = build.armor.flatMap((piece) => piece.driftsmeltSkills ?? []);
  const gearRows = [build.weapon, ...build.armor].map((gear) => `
    <li>${imageMarkup(gear, "library-gear-image")}<span><b>${gear.part ?? gear.type}</b>${gear.name}</span><em>G${gear.grade} L${gear.level}</em></li>
  `).join("");
  return `
    <article class="loadout-library-card">
      <div class="library-card-hero">${imageMarkup(build.weapon, "library-weapon-image")}<div><span class="type-label">${loadout.origin === "suggested" ? "Saved upgrade target" : "Saved loadout"}</span><h2>${loadout.name}</h2><p>${build.weapon.name} · ${build.weapon.type}</p></div></div>
      <ul class="library-gear-list">${gearRows}</ul>
      <p class="library-driftsmelt">${activeDriftsmelt.length ? `Active Driftsmelt: ${activeDriftsmelt.map((skill) => `${skill} Lv.1`).join(" · ")}` : "No active Driftsmelt skills"}</p>
      <div class="loadout-card-actions"><a class="secondary-action" href="loadout-editor.html?id=${encodeURIComponent(loadout.id)}">Edit</a><a class="card-action" href="loadout-review.html?id=${encodeURIComponent(loadout.id)}">Review</a><button type="button" data-loadout-action="delete" data-loadout-id="${loadout.id}">Delete</button></div>
    </article>
  `;
}

function savedLoadoutSummary(loadout, build, counts, finalStats) {
  const affinityLabel = `${finalStats.baseAffinity >= 0 ? "+" : ""}${finalStats.baseAffinity}% base${finalStats.affinity !== finalStats.baseAffinity ? ` -> ${finalStats.affinity >= 0 ? "+" : ""}${finalStats.affinity}%` : ""}`;
  const elementLabel = finalStats.weaponElement
    ? `${finalStats.weaponElement.type} ${finalStats.weaponElement.value}${finalStats.elementalSkillBonus ? ` + ${finalStats.elementalSkillBonus}` : ""}`
    : "No elemental stat";
  const assumptions = [
    finalStats.rawSkillBonus ? `Attack Boost +${finalStats.rawSkillBonus}` : null,
    finalStats.criticalEyeBonus ? `Critical Eye +${finalStats.criticalEyeBonus}%` : null,
    finalStats.weaknessExploitBonus ? `Weakness Exploit +${finalStats.weaknessExploitBonus}%` : null,
  ].filter(Boolean);
  const driftsmeltSkills = build.armor.flatMap((piece) => piece.driftsmeltSkills ?? []);
  const driftsmeltLabel = driftsmeltSkills.length
    ? `Recorded Driftsmelt: ${driftsmeltSkills.map((skill) => `${skill} Lv.1`).join(" · ")}.`
    : "No Driftsmelt skills recorded for this saved loadout.";
  return `
    <div class="loadout-summary-gear">${imageMarkup(build.weapon, "summary-weapon-image")}<div><span class="type-label">Reviewing ${loadout.name}</span><h2>${build.weapon.name}</h2><p>G${build.weapon.grade} L${build.weapon.level} · exact saved gear stats</p></div></div>
    <div class="final-stat-grid"><span><small>Final raw</small><b>${finalStats.rawAttack}</b><em>${finalStats.rawSkillBonus ? `base ${build.weapon.attack} + ${finalStats.rawSkillBonus}` : "no raw bonus"}</em></span><span><small>Affinity</small><b>${finalStats.affinity >= 0 ? "+" : ""}${finalStats.affinity}%</b><em>${affinityLabel}</em></span><span><small>Element</small><b>${elementLabel}</b><em>applies only to matching weakness</em></span><span><small>Defense</small><b>${finalStats.defense}</b><em>five armor pieces</em></span></div>
    <p class="damage-assumptions">${assumptions.length ? `Applied: ${assumptions.join(" · ")}. ` : "No always-on offensive skill bonus found. "}Conditional, weapon-specific, status, and timing skills remain listed but are not converted into damage.</p>
    <p class="damage-assumptions">${driftsmeltLabel}</p>
    <p class="damage-assumptions">${loadout.origin === "suggested" ? "Suggested upgrade targets keep their saved Grade and Level." : "Manual loadouts automatically use your latest forged Grade and Level."}</p>
    <div class="loadout-summary-stats"><span><b>${counts.easy}</b> elemental edges</span><span><b>${counts.fair}</b> on-grade or status hunts</span><span><b>${counts.hard}</b> underpowered hunts</span></div>
  `;
}

function loadoutOutlookMarkup(evaluations) {
  const items = evaluations;
  const viable = evaluations.filter((item) => item.result.tier !== "hard");
  const heading = viable.length ? "All monster matchups" : "All monster matchups: below grade baseline";
  return `
    <div class="section-heading compact-heading"><div><p class="eyebrow">Monster effectiveness</p><h2>${heading}</h2></div><span class="data-note">Showing all ${items.length} monsters · Element first, then grade baseline</span></div>
    <p class="damage-method">Reference hit = expected raw after affinity + element only when the monster is weak to it. It excludes hit-zone, move, special, status-proc, and conditional-skill multipliers.</p>
    <div class="outlook-grid loadout-outlook-grid">${items.map(({ monster, result, damage }) => `
      <button class="outlook-card" type="button" data-plan-monster="${monster.id}">
        ${imageMarkup(monster, "outlook-image")}<span><b>${monster.name}</b><small>${damage.referenceDamage} reference damage${damage.matchingElement ? ` · ${damage.weaponElement.type} active` : " · no matching element"}</small></span><em class="status-pill ${result.tier}">${result.label}</em>
      </button>
    `).join("")}</div>
  `;
}

function weaponCard(weapon) {
  const currentWeapon = displayGear(weapon);
  return `
    <article class="catalogue-card gear-card">
      ${imageMarkup(currentWeapon, "gear-image")}
      <div class="card-body">
        <div class="card-topline"><span class="type-label">${currentWeapon.type}</span><div class="gear-card-actions">${favoriteToggle(weapon)}${ownedToggle(weapon)}</div></div>
        <h2>${currentWeapon.name}</h2>
        <p class="source-line">${sourceMonsterLabel(currentWeapon.sourceMonsterId)} series · Grade ${currentWeapon.grade} / L${currentWeapon.level}</p>
        <div class="stat-strip"><span>Attack <b>${currentWeapon.attack}</b></span><span>${currentWeapon.element ? `${currentWeapon.element.type} <b>${currentWeapon.element.value}</b>` : "No element"}</span></div>
        ${skillChips(currentWeapon.skills)}
        <p class="availability-note">Forge quantities are not published in the official guide.</p>
      </div>
    </article>
  `;
}

function armorCard(piece) {
  const currentPiece = displayGear(piece);
  const slotCount = driftsmeltSlotCount(currentPiece);
  const unlockGrades = driftsmeltSlotUnlockGrades(currentPiece).filter((grade) => grade <= currentPiece.grade);
  const slotLabel = slotCount
    ? `${slotCount} Driftsmelt slot${slotCount === 1 ? "" : "s"}${unlockGrades.length ? ` (G${unlockGrades.join(", G")})` : ""}`
    : "No Driftsmelt slot";
  return `
    <article class="catalogue-card gear-card">
      ${imageMarkup(currentPiece, "gear-image")}
      <div class="card-body">
        <div class="card-topline"><span class="type-label">${currentPiece.part}</span><div class="gear-card-actions">${favoriteToggle(piece)}${ownedToggle(piece)}</div></div>
        <h2>${currentPiece.name}</h2>
        <p class="source-line">${sourceMonsterLabel(currentPiece.sourceMonsterId)} series · Grade ${currentPiece.grade} / L${currentPiece.level}</p>
        <div class="stat-strip"><span>Defense <b>${currentPiece.defense}</b></span><span>${currentPiece.skills.length} skills</span><span>${slotLabel}</span></div>
        ${skillChips(currentPiece.skills)}
        ${driftsmeltEditor(piece, currentPiece)}
        <p class="availability-note">Forge quantities are not published in the official guide.</p>
      </div>
    </article>
  `;
}

function driftsmeltEditor(piece, currentPiece) {
  if (!state.ownedGearIds.has(piece.id)) {
    return '<p class="driftsmelt-note">Forge this armor to record up to 20 Driftsmelt skills for future loadouts.</p>';
  }
  const pool = state.driftsmeltSkillPools[piece.id] ?? [];
  const slotCount = driftsmeltSlotCount(currentPiece);
  const entries = pool.length
    ? `<div class="driftsmelt-pool-list">${pool.map((skill, index) => `<span>${skill} Lv.1 <button type="button" data-driftsmelt-pool-remove="${piece.id}" data-driftsmelt-pool-index="${index}" aria-label="Remove ${skill}">Remove</button></span>`).join("")}</div>`
    : '<p class="driftsmelt-note">No Driftsmelt skills recorded yet.</p>';
  return `<details class="driftsmelt-editor" data-driftsmelt-pool="${piece.id}" ${state.openDriftsmeltPoolIds.has(piece.id) ? "open" : ""}><summary><b>Driftsmelt skill pool</b><small>${pool.length}/${MAX_DRIFTSMELT_SKILLS_PER_ARMOR} recorded · ${slotCount} active slot${slotCount === 1 ? "" : "s"}</small></summary><div class="driftsmelt-editor-content"><p>Record up to 20 rolled skills. Choose the active ones while saving a loadout.</p>${entries}<div class="driftsmelt-pool-add"><input data-driftsmelt-pool-input="${piece.id}" placeholder="Type a skill name" autocomplete="off" ${pool.length >= MAX_DRIFTSMELT_SKILLS_PER_ARMOR ? "disabled" : ""} /><button type="button" data-driftsmelt-pool-add="${piece.id}" ${pool.length >= MAX_DRIFTSMELT_SKILLS_PER_ARMOR ? "disabled" : ""}>Add</button><div class="driftsmelt-suggestions" data-driftsmelt-suggestions="${piece.id}"></div></div></div></details>`;
}

function driftsmeltSkillOptions() {
  return uniqueValues([
    ...DRIFTSMELT_SKILLS,
    ...GAME_DATA.armor.flatMap((piece) => piece.skills.map((skill) => skill.name)),
    ...GAME_DATA.weapons.flatMap((weapon) => weapon.skills.map((skill) => skill.name)),
  ]);
}

function renderDriftsmeltSuggestions(input) {
  const gearId = input.dataset.driftsmeltPoolInput;
  const container = document.querySelector(`[data-driftsmelt-suggestions="${gearId}"]`);
  if (!container) return;
  const query = input.value.trim().toLowerCase();
  if (query.length < 2) {
    container.innerHTML = "";
    return;
  }
  const matches = driftsmeltSkillOptions()
    .filter((skill) => skill.toLowerCase().includes(query))
    .slice(0, 8);
  container.innerHTML = matches.map((skill) => `<button type="button" data-driftsmelt-suggestion="${encodeURIComponent(skill)}" data-driftsmelt-suggestion-gear="${gearId}">${skill}</button>`).join("");
}

function activeLoadoutDriftsmeltSkills() {
  return Object.fromEntries(Object.entries(state.loadoutDriftsmeltSelections).map(([gearId, selectedIndexes]) => {
    const pool = state.driftsmeltSkillPools[gearId] ?? [];
    return [gearId, selectedIndexes.map((index) => pool[Number(index)]).filter(Boolean)];
  }));
}

function syncManualLoadoutsWithGear(gearId) {
  const progress = state.gearProgress[gearId];
  let changed = false;
  state.savedLoadouts = state.savedLoadouts.map((loadout) => {
    if (loadout.origin === "suggested" || !loadout.gearProgress?.[gearId]) return loadout;
    const updated = updateLoadoutGearProgress(loadout, gearId, progress);
    changed ||= updated !== loadout;
    return updated;
  });
  if (changed) persistSavedLoadouts();
}

function monsterCard(monster) {
  const gearCount = getMonsterMaterialUsage(monster.id, GAME_DATA).length;
  return `
    <article class="catalogue-card monster-card">
      ${imageMarkup(monster, "monster-image")}
      <div class="card-body">
        <div class="card-topline"><span class="type-label">${monster.species}</span><span class="grade-label">From grade ${monster.recommendedGrade}</span></div>
        <h2>${monster.name}</h2>
        <p class="source-line">Weak to ${monster.weakness.join(" / ")}</p>
        <div class="drop-preview">${monster.drops.slice(0, 4).map(dropToken).join("")}</div>
        <p class="availability-note">${monster.drops.length} drop materials · ${gearCount} linked gear entries</p>
        <button class="card-action" type="button" data-plan-monster="${monster.id}">Plan this hunt</button>
      </div>
    </article>
  `;
}

function materialCard(material) {
  const sources = material.sourceMonsterIds.map((id) => monsterById[id]?.name ?? id).join(", ");
  return `
    <article class="catalogue-card material-card">
      ${imageMarkup(material, "material-image")}
      <div class="card-body">
        <div class="card-topline"><span class="type-label">Rarity ${material.rarity}</span><span class="grade-label">From grade ${material.minGrade}</span></div>
        <h2>${material.name}</h2>
        <p class="source-line">Dropped by ${sources}</p>
        <p class="availability-note">Official drop listing. Per-gear forge quantities are not publicly listed.</p>
      </div>
    </article>
  `;
}

function buildCard(build, index, { saved = false } = {}) {
  const effectiveness = classifyBuildVsMonster(build, build.targetMonster, build.targetStars);
  const damage = build.damage ?? calculateFinalLoadoutStats(build, { monster: build.targetMonster, assumeWeakPoint: state.assumeWeakPoint });
  const appliedSkills = [
    damage.rawSkillBonus ? `Attack Boost +${damage.rawSkillBonus}` : null,
    damage.elementalSkillBonus && damage.matchingElement ? `${damage.weaponElement.type} Attack +${damage.elementalSkillBonus}` : null,
    damage.criticalEyeBonus ? `Critical Eye +${damage.criticalEyeBonus}%` : null,
    damage.weaknessExploitBonus ? `Weakness Exploit +${damage.weaknessExploitBonus}%` : null,
    damage.criticalMultiplier > 1.25 ? `Critical Boost ${Math.round(damage.criticalMultiplier * 100)}%` : null,
  ].filter(Boolean);
  const omittedSkills = damage.unmodeledSkills.slice(0, 3).map((skill) => `${skill.name} Lv.${skill.level}`).join(" · ");
  const activeDriftsmelt = build.armor.flatMap((piece) => piece.driftsmeltSkills ?? []);
  return `
    <article class="build-card ${index === 0 ? "best-build" : ""}">
      <div class="build-hero">${imageMarkup(build.weapon, "build-weapon-image")}
        <div><span class="type-label">${saved ? (index === 0 ? "Best saved loadout" : `Saved loadout ${index + 1}`) : (index === 0 ? "Top suggested build" : `Suggested build ${index + 1}`)}</span><h2>${saved ? build.savedLoadoutName : build.weapon.name}</h2><p>${saved ? `${build.weapon.name} · ` : ""}${build.weapon.type} · Grade ${build.weapon.grade} / L${build.weapon.level}</p></div>
      </div>
      <div class="build-score"><span class="status-pill ${effectiveness.tier}">${effectiveness.label}</span><div class="damage-total"><small>Estimated damage</small><strong>${damage.referenceDamage}</strong><em>per reference hit</em></div><div class="damage-breakdown"><span>${damage.rawAttack} raw${damage.rawSkillBonus ? ` (+${damage.rawSkillBonus})` : ""}</span><span>${damage.matchingElement ? `+ ${damage.effectiveElement} ${damage.weaponElement.type}` : "No active element"}</span><span>${damage.affinity >= 0 ? "+" : ""}${damage.affinity}% affinity</span></div></div>
      <p class="build-calculation">${appliedSkills.length ? `Included: ${appliedSkills.join(" · ")}.` : "Included: weapon raw, affinity, and matching element."}${omittedSkills ? ` Not converted: ${omittedSkills}.` : ""}</p>
      ${activeDriftsmelt.length ? `<p class="build-calculation">Active Driftsmelt: ${activeDriftsmelt.map((skill) => `${skill} Lv.1`).join(" · ")}.</p>` : ""}
      ${saved ? "" : `<button class="save-suggestion" type="button" data-save-suggestion="${index}">Save as my upgrade target</button>`}
      <div class="loadout-list"><p>Five-piece armor</p><ul>${build.armor.map((piece) => `<li>${imageMarkup(piece, "loadout-icon")}<span>${piece.part}</span>${piece.name}</li>`).join("")}</ul></div>
      <div class="skill-chips">${aggregateSkills([build.weapon, ...build.armor]).slice(0, 5).map((skill) => `<span>${skill.name} Lv.${skill.level}</span>`).join("")}</div>
    </article>
  `;
}

function monsterFeature(monster, build) {
  const fit = build ? classifyBuildVsMonster(build, monster, state.targetStars) : null;
  const requiredGrade = recommendedGradeForStars(state.targetStars);
  return `
    <div class="feature-visual">${imageMarkup(monster, "feature-monster-image")}</div>
    <div class="feature-copy"><span class="type-label">Current target</span><h1>${monster.name}</h1><p>${monster.species} · appears from grade ${monster.recommendedGrade}</p>
      <div class="feature-tags"><span>${state.targetStars}-star target · baseline Grade ${requiredGrade}</span><span>Weak to ${monster.weakness.join(" / ")}</span>${fit ? `<span class="status-pill ${fit.tier}">${fit.label}</span>` : ""}</div>
      <button class="primary-action" type="button" data-plan-monster="${monster.id}">Open hunt planner</button>
    </div>
  `;
}

function compactMonsterCard(monster) {
  return `
    <button class="outlook-card" type="button" data-plan-monster="${monster.id}">
      ${imageMarkup(monster, "outlook-image")}<span><b>${monster.name}</b><small>Weak to ${monster.weakness.join(" / ")}</small></span>
    </button>
  `;
}

function imageMarkup(item, className) {
  return item.imageUrl ? `<img class="${className}" src="${item.imageUrl}" alt="${item.name}" loading="lazy" />` : `<div class="${className} image-fallback">${item.name.slice(0, 2)}</div>`;
}

function dropToken(dropId) {
  const material = materialById[dropId];
  return material ? `<span title="${material.name}">${imageMarkup(material, "drop-icon")}</span>` : "";
}

function ownedToggle(gear) {
  const checked = state.ownedGearIds.has(gear.id) ? "checked" : "";
  const progress = selectedProgressFor(gear);
  const gradeOptions = gear.gradeOptions
    .map((option) => `<option value="${option.grade}" ${option.grade === progress.grade ? "selected" : ""}>G${option.grade}</option>`)
    .join("");
  const levelOptions = gear.gradeOptions.find((option) => option.grade === progress.grade).levels
    .map((option) => `<option value="${option.level}" ${option.level === progress.level ? "selected" : ""}>L${option.level}</option>`)
    .join("");
  return `<div class="ownership-control"><label class="owned-toggle"><input data-gear-toggle="true" type="checkbox" value="${gear.id}" ${checked} /><span>${checked ? "Forged" : "Mark forged"}</span></label><label class="grade-picker"><span class="sr-only">Grade</span><select data-gear-grade="${gear.id}" ${checked ? "" : "disabled"}>${gradeOptions}</select></label><label class="grade-picker"><span class="sr-only">Level</span><select data-gear-level="${gear.id}" ${checked ? "" : "disabled"}>${levelOptions}</select></label></div>`;
}

function favoriteToggle(gear) {
  const isFavorite = state.favoriteGearIds.has(gear.id);
  const action = isFavorite ? "Remove from favorites" : "Add to favorites";
  return `<button class="favorite-toggle ${isFavorite ? "is-favorite" : ""}" type="button" data-favorite-toggle="${gear.id}" aria-label="${action}" title="${action}" aria-pressed="${isFavorite}">${isFavorite ? "Saved" : "Fav"}</button>`;
}

function skillChips(skills) {
  if (!skills.length) return '<p class="availability-note">No listed equipment skill.</p>';
  return `<div class="skill-chips">${skills.map((skill) => `<span>${skill.name} Lv.${skill.level}</span>`).join("")}</div>`;
}

function filterBySearch(items, search, getText) {
  return search ? items.filter((item) => getText(item).toLowerCase().includes(search)) : items;
}

function getRecommendedBuilds() {
  return recommendBuilds({
    targetMonsterId: state.targetMonsterId,
    targetStars: state.targetStars,
    preferredWeaponType: state.preferredWeaponType,
    ownedGearIds: state.ownedGearIds,
    gearProgress: state.gearProgress,
    driftsmeltSkillPools: state.driftsmeltSkillPools,
    assumeWeakPoint: state.assumeWeakPoint,
    ownedWeaponsOnly: state.ownedWeaponsOnly,
    data: GAME_DATA,
  });
}

function buildFromBestOrOwned(bestBuild) {
  if (bestBuild) return { weapon: bestBuild.weapon, armor: bestBuild.armor };
  const weapon = displayGear(GAME_DATA.weapons.find((item) => state.ownedGearIds.has(item.id)) ?? GAME_DATA.weapons[0]);
  const armor = getRequiredParts(GAME_DATA).map((part) =>
    displayGear(GAME_DATA.armor.find((item) => item.part === part && state.ownedGearIds.has(item.id))
      ?? GAME_DATA.armor.find((item) => item.part === part)),
  );
  return { weapon, armor };
}

function sourceMonsterLabel(sourceMonsterId) {
  return sourceMonsterId ? monsterById[sourceMonsterId]?.name ?? "Monster" : "Generic";
}

function statCard(label, value) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function displayGear(gear) {
  const progress = selectedProgressFor(gear);
  return state.ownedGearIds.has(gear.id) ? getGearAtGrade(gear, progress.grade, progress.level) : gear;
}

function defaultProgressFor(gear) {
  const grade = gear?.gradeOptions?.[0]?.grade ?? gear?.grade ?? 1;
  return { grade, level: maxLevelFor(gear, grade) };
}

function selectedProgressFor(gear) {
  if (!state.ownedGearIds.has(gear.id)) {
    return { grade: gear.grade, level: gear.level };
  }
  const saved = state.gearProgress[gear.id] ?? defaultProgressFor(gear);
  const grade = gear.gradeOptions.some((option) => option.grade === saved.grade) ? saved.grade : defaultProgressFor(gear).grade;
  return { grade, level: maxLevelFor(gear, grade, saved.level) };
}

function maxLevelFor(gear, grade, requestedLevel) {
  const gradeOption = gear?.gradeOptions?.find((option) => option.grade === grade)
    ?? gear?.gradeOptions?.filter((option) => option.grade <= grade).at(-1)
    ?? gear?.gradeOptions?.[0];
  if (!gradeOption) return gear?.level ?? 1;
  return gradeOption.levels.find((option) => option.level === Number(requestedLevel))?.level
    ?? gradeOption.levels.filter((option) => option.level <= Number(requestedLevel)).at(-1)?.level
    ?? gradeOption.levels.at(-1).level;
}

function loadOwnedGearIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(OWNED_STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function loadFavoriteGearIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function loadTargetMonsterId() {
  const saved = localStorage.getItem(TARGET_STORAGE_KEY);
  return monsterById[saved] ? saved : GAME_DATA.monsters[0].id;
}

function loadGearProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(GEAR_PROGRESS_STORAGE_KEY) ?? "{}");
    const progress = Object.fromEntries(Object.entries(saved).flatMap(([gearId, value]) => {
      const gear = gearById[gearId];
      if (!gear || !value || !Number.isInteger(value.grade)) return [];
      return [[gearId, { grade: value.grade, level: maxLevelFor(gear, value.grade, value.level) }]];
    }));
    if (Object.keys(progress).length) return progress;

    const legacy = JSON.parse(localStorage.getItem(LEGACY_GEAR_GRADES_STORAGE_KEY) ?? "{}");
    return Object.fromEntries(Object.entries(legacy).flatMap(([gearId, grade]) => {
      const gear = gearById[gearId];
      return gear && Number.isInteger(grade) ? [[gearId, { grade, level: maxLevelFor(gear, grade) }]] : [];
    }));
  } catch {
    return {};
  }
}

function loadTargetStars() {
  const stars = Number(localStorage.getItem(TARGET_STARS_STORAGE_KEY));
  return Number.isInteger(stars) && stars >= 1 && stars <= 10 ? stars : 8;
}

function loadSavedLoadouts() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOADOUTS_STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((loadout) => loadout?.weaponId && loadout?.armorIds && (loadout?.gearProgress || loadout?.gearGrades)) : [];
  } catch {
    return [];
  }
}

function loadDriftsmeltSkillPools() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRIFTSMELT_STORAGE_KEY) ?? "{}");
    return typeof saved === "object" && saved && !Array.isArray(saved)
      ? Object.fromEntries(Object.entries(saved).map(([gearId, skills]) => [gearId, normalizeDriftsmeltSkillPool(skills)]))
      : {};
  } catch {
    return {};
  }
}

function persistOwnedGearIds() {
  localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...state.ownedGearIds]));
}

function persistFavoriteGearIds() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...state.favoriteGearIds]));
}

function persistGearProgress() {
  localStorage.setItem(GEAR_PROGRESS_STORAGE_KEY, JSON.stringify(state.gearProgress));
}

function persistDriftsmeltSkillPools() {
  localStorage.setItem(DRIFTSMELT_STORAGE_KEY, JSON.stringify(state.driftsmeltSkillPools));
}

function persistTargetMonsterId() {
  localStorage.setItem(TARGET_STORAGE_KEY, state.targetMonsterId);
}

function persistTargetStars() {
  localStorage.setItem(TARGET_STARS_STORAGE_KEY, String(state.targetStars));
}

function persistSavedLoadouts() {
  localStorage.setItem(LOADOUTS_STORAGE_KEY, JSON.stringify(state.savedLoadouts));
}
