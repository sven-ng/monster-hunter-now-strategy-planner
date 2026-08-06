# Monster Hunter Now Strategy Planner + Guide Wiki

A small offline-first planning app for building Monster Hunter Now weapon and armor sets, tracking what you already own, and deciding which monsters to farm next.

## Scope

This release ships with an offline snapshot of the official Monster Hunter Now guide: 67 monsters, 695 weapon trees, 345 armor pieces, and their listed maximum stats, skills, elemental weaknesses, habitats, and drops.

## Run

Open `index.html` directly in a browser.

No install step or server is required.

## Host Online

GitHub Pages deploys this static site from the repository's `main` branch whenever it is pushed.

1. Push `main` to GitHub.
2. In the repository's **Settings > Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`.
3. Wait for the Pages build to finish, then open the published URL.

The site needs no server or database. Ownership, Driftsmelt pools, and saved loadouts are stored in each browser's `localStorage`, so your existing local-file data will not automatically appear on the online URL.

### Move Your Profile Online

1. Open the local Field Kit and select **Export my profile** on the home page.
2. Open the hosted Field Kit in the browser where you want to use it.
3. Select **Import profile** and choose the downloaded `mhn-field-kit-profile.json` file.

The export contains forged gear, Grade and Level, favorites, Driftsmelt pools, hunt target, and saved loadouts. Importing replaces the current Field Kit profile in that browser.

## Pages

- `index.html`: Home dashboard and clear next actions
- `planner.html`: Target-based build recommendations
- `loadouts.html`: Saved build library with complete gear visibility
- `loadout-editor.html`: Create or update one loadout and its active Driftsmelt
- `loadout-review.html`: Final stats and all-monster effectiveness for one loadout
- `upgrades.html`: Next-upgrade roadmap and monster-series farming focus
- `weapons.html`: Visual weapon catalogue and forge tracking
- `armor.html`: Visual five-slot armor catalogue and forge tracking
- `monsters.html`: Monster guide, weaknesses, and drop previews
- `materials.html`: Visual material index and source monsters

## Features

- Task-first navigation rather than a single long page
- Official guide imagery for monsters, equipment, and material drops
- Local ownership tracking for forged gear
- Persistent favorites for weapons and armor
- Weapon filters for type, element, source monster, and favorites
- Armor filters for skill, source monster, Driftsmelt eligibility, and favorites
- Ranked build recommendations against a target monster
- Hunt Planner cards ranked by their displayed reference-damage estimate, with the included and unmodeled skills shown per build
- Hunt Planner evaluates every saved loadout before showing generated upgrade suggestions
- Suggested Hunt Planner builds can be saved as labeled upgrade targets without marking their gear as forged
- Upgrade Plan ranks the next Grade/Level step for every saved piece and groups them by the linked monster series
- Elemental matchup guidance for the selected build
- Monster drop index and gear-series links
- Per-piece forged Grade and Level selection using official grade-level stats
- Target star selection with a conservative Grade 7 baseline for 8-star hunts
- Saved loadouts preserve the weapon, five armor pieces, and each forged Grade and Level
- Existing manual loadouts are edited in place rather than duplicated; their library cards show every equipped piece, Grade, Level, and active Driftsmelt
- Record up to 20 Driftsmelt skills for each forged armor, then choose only the skills active in that loadout's unlocked slots; saved loadouts preserve those active choices and include supported effects in final-stat and hunt calculations
- Per-loadout monster outlook ranked from most to least effective for a chosen star level
- Final loadout stats and per-monster reference-damage estimates using raw attack, matching element, affinity, and supported skill bonuses

## Data notes

- `data/game-data.mjs` is generated from the official Monster Hunter Now monster, weapon, and armor guide pages on August 4, 2026.
- The stats shown are the highest published grade and level for every gear tree in that snapshot.
- When you mark gear forged, choose its current Grade and Level. The planner uses that exact official stat block, not the catalogue's Grade 10 preview or an assumed Level 5.
- Target-star guidance uses a transparent planning baseline of `star - 1` weapon grade, capped at Grade 9 for 10-star. It is a conservative heuristic, not a damage simulator.
- Damage estimates are reference-hit values: they include Attack Boost, matching elemental Attack, Critical Eye, Weakness Exploit when selected, and Critical Boost. They exclude monster hit zones, weapon motion values, status-proc timing, special moves, and conditional skills.
- The public official guide does not publish per-gear forge material quantities. The app deliberately marks those requirements as unavailable rather than inventing values.
- Because forge quantities are unavailable, the Upgrade Plan can prioritize a monster series but cannot yet consume or validate a material inventory.
- Run `node scripts/sync-official-snapshot.mjs` to refresh from the official guide pages. The script rewrites the generated data file.
- Ownership data is stored only in browser `localStorage`.
- Saved loadouts are also stored only in browser `localStorage`; they do not sync to a game account or cloud service.
- Driftsmelt pools are a local record of the skills you rolled. The picker suggests documented Driftsmelt and official snapshot skills, and also accepts a validated custom skill name; conditional and weapon-specific skills remain visible but are not converted into reference damage.
- Armor Driftsmelt filters and cards use the official slot count at every published Grade. Forged pieces reflect their selected Grade; unowned pieces show their highest published Grade.

## Verify

```sh
node --test tests/planner.test.js
```
