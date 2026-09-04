# Navigation and page ownership cleanup

**Status:** Approved design  
**Date:** September 4, 2026

## Goal

Make every dashboard action lead directly to the page that owns the requested task. Keep the current visual design, data, and useful pages. Remove repeated choices, misleading destinations, and ambiguous labels.

## Page ownership

The primary navigation contains:

- Home
- Schedule
- Teams
- Projections
- Player Compare
- Edge Analytics

`Matchup` remains a complete analysis page but leaves the primary navigation. It is the detail view for a selected game, not a second schedule browser. The command palette may retain a Matchup Center entry for advanced direct access.

`Schedule` owns browsing games across the 18-week season. Selecting a specific game opens Matchup with that game selected.

`Teams` owns live team context: rosters, roster moves, and the existing league power view.

`Projections` owns Mike Clay and model-derived views. Its `Schedule` subtab becomes `Strength of Schedule`, and its `Teams` subtab becomes `Team Projections`. No projection view moves or disappears.

`Player Compare` is the existing player comparison action. The clearer label separates it from the team comparison action inside Teams.

## Game navigation

All specific-game entry points use one shared action that:

1. resolves the selected game from `SCHEDULE_DATA`;
2. updates `MATCHUP_STATE.teamA` and `MATCHUP_STATE.teamB` from that game;
3. opens the Matchup page;
4. renders the selected game without an intermediate confirmation.

This shared action replaces the current repeated summary modal for schedule cards, the full-season schedule grid, home marquee cards, the home scorestrip, and the featured matchup action.

Links that describe a collection, such as `All 16 games` or `Full schedule`, continue to open Schedule. A Week 1 collection link explicitly resets Schedule to Week 1 instead of inheriting a week selected earlier in the session.

## Home actions

- `View matchup` opens the featured game in Matchup.
- The duplicate `Both depth charts` action becomes `Compare rosters` and opens the existing side-by-side team comparison for the featured teams.
- Each scorestrip game opens that game's Matchup page. The `All 16 games` item opens Schedule at Week 1.
- Week 1 marquee game cards open the selected Matchup directly.
- Home power-index rows and `Projected standings` open Projections with `Standings` active, regardless of the user's previously selected projections subtab.
- `How the model is graded` opens the Edge Analytics Model Lab. `Open Edge Analytics` continues to open the Edge home page.
- Teams, player search, moves, the full schedule, and value-read cards keep their present destinations because those destinations already match the card labels.

## State and failure behavior

Internal navigation must set the destination's required state before showing it. A destination must not inherit an unrelated nested tab or schedule week from an earlier visit when the source action names a specific view.

If a requested game cannot be found, the app stays on the current page and logs one clear error. It must not open Matchup with stale teams from the previous selection.

The cleanup does not change schedule, roster, transaction, projection, or props data. It does not add URL routing, browser-history support, new dependencies, or new UI components.

## Verification

Browser checks cover:

- primary navigation labels and active state;
- featured matchup, scorestrip game, marquee game, and Schedule card each reaching the correct Matchup in one click;
- `Compare rosters` opening the correct two teams;
- collection links opening Schedule at the intended week;
- home projection links activating `Standings`;
- renamed projection subtabs retaining their existing content;
- command-palette destinations matching the new names;
- no console errors or warnings during these flows.

The existing dashboard smoke test remains the minimum automated check. Add one focused navigation regression check for the shared game-opening action and the deterministic nested-tab helpers.

## Acceptance criteria

- Matchup is absent from the primary header but remains reachable from game selections and the command palette.
- A specific game takes one click from Home or Schedule to its full Matchup analysis.
- No repeated game-summary modal interrupts that path.
- Home buttons with different labels perform different actions.
- Teams and Projections keep all current content, with nested labels that state their actual purpose.
- Specific home links always open the named week or projections subtab.
- The visual design and data contracts remain unchanged.
