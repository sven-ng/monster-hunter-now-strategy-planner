# Project Brief

## Project

- Name: Monster Hunter Now Strategy Planner + Guide Wiki
- One-sentence goal: Build a lightweight browser app for tracking gear progress, browsing monster and equipment data, and planning efficient weapon and armor sets.
- Primary user: A solo Monster Hunter Now player planning upgrades and farming routes.

## Problem

The player needs one place to answer four planning questions:

- what each tracked weapon and armor piece does;
- what materials are needed and where they come from;
- which gear is already forged or in progress;
- which monsters are the best next targets for the current build.

## First Release

- A local wiki view for a refreshable official-guide snapshot of monsters, weapons, armor, and materials.
- Separate home, planner, loadout, equipment, monster, and material pages with persistent navigation and visual entries.
- Ownership tracking for weapons and armor persisted in the browser.
- Persistent favorites plus focused filters for weapon and armor browsing.
- Build recommendations based on target monster weakness, owned gear, and armor skill synergy.
- Per-piece owned Grade and Level selection plus target-star selection so a Grade 5 weapon is not treated as a Grade 10 build or an assumed Level 5.
- Named loadouts that preserve the selected weapon, five armor pieces, and forged Grade and Level of every piece.
- A per-loadout hunt outlook that ranks monsters for the selected star level by elemental matchup and grade readiness.
- A saved-loadout upgrade roadmap that ranks immediate Grade/Level gains and identifies linked monster-series farming priorities without claiming unpublished material quantities.
- Elemental matchup guidance for the current or recommended build.
- Monster drop listings and monster-series gear links. Exact forge-quantity dependency is unavailable until an authoritative source publishes it.

## Out of Scope

- Full live synchronization with the game.
- A damage simulator or a claim that elemental advantage guarantees an easy hunt.
- Multiplayer planning, account sync, or cloud storage.

## Acceptance Criteria

- The app opens locally in a browser without a build step.
- A user can mark gear as owned and see that state persist after refresh.
- A user can select a target monster and receive ranked build recommendations.
- A user can save a named loadout and see which monsters it is most effective against at a selected star level.
- A user can inspect a monster and see its drops plus official gear in that monster's series.
- A user can inspect a material and see its source monster. Forge quantities are explicitly unavailable rather than guessed.

## Constraints

- Platform: Desktop or mobile browser.
- Preferred technologies: Static HTML, CSS, and JavaScript modules.
- Data or integrations: Generated local snapshot from official Monster Hunter Now guide pages.
- Privacy or security requirements: Keep all user data in localStorage only.
- Deadline or budget: Small side-project MVP.

## Verification

Open the app locally, exercise the planner flows, and run `node --test tests/planner.test.js`.
