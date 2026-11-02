# PACKET-2026-11-02-1: /nfl/ week 9 cleanup
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Plan diagram: /Users/shyampatel/Desktop/second-brain/projects/matchup-board/diagrams/week9-cleanup-plan.svg

It's week 9 of the 2026 season. `/nfl/` still carries a preseason primer: Mike Clay 2026 projections, offseason moves, draft capital, and a Matchup Center graded on 2025 data. Shyam's call: cut the primer, and make the Matchup Center use 2026 season-to-date data. Home, Schedule, Teams overview and League stay as they are. Read AGENTS.md first: the project's data is the source of truth, never fix rosters from memory.

## Tasks

T1. New `scripts/build_team_efficiency.py` (Python stdlib only: urllib, gzip, csv, json).
- Downloads `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv.gz`.
- Mirrors `/Users/shyampatel/Desktop/NFL_Main/research/nfl-stickiness/01_build_dataset.R` exactly. Keep plays where season_type == "REG", posteam and epa are present, play_type is pass or run, and two_point_attempt is empty or 0. Build per-team rows twice: side "off" grouped by posteam, side "def" grouped by defteam. Fields: season, team, plays, epa_per_play, success_rate, yds_per_play, turnover_rate (fumble_lost==1 or interception==1, over plays), pass_att, pass_epa_per_att (mean epa where pass_attempt==1 and play_type=="pass"), run_epa_per_att (mean epa where play_type=="run"), sack_rate (sack==1 over pass_attempt==1 or sack==1 or qb_scramble==1), side. Round floats the way the existing rows are rounded (look at a 2025 row).
- Drop any existing season-2026 rows, append the new 64, and write both `data/shared/team_season_efficiency.json` and the root `team_season_efficiency.json`. Same list format and key order as today, written atomically (write a temp file, then rename).
- End the script with an assert self-check: 64 rows for 2026, 32 teams per side, every metric a finite number.
- Add one line to `scripts/data-assets.json` for the team_efficiency asset: producer now also names this script, label "(2012-2026, 2026 season to date)".
- Done: `python3 scripts/build_team_efficiency.py` exits 0, and `python3 -c "import json;d=json.load(open('team_season_efficiency.json'));print(sum(r['season']==2026 for r in d))"` prints 64.

T2. `nfl/index.html`: the Matchup Center / Pro Matchup Center / compare views use the latest season in the efficiency data, not a hardcoded 2025.
- Wherever the code filters efficiency rows to 2025 (see around lines 5084-5200, 5400, 5529, 5576), use `Math.max(...rows.map(r => r.season))`.
- Replace hardcoded "2025" UI strings in those views with that season, labelled as season to date (e.g. "2026 season to date"). Do the same for the explainer text near lines 2029 and 2052-2058.
- Remove Clay unit grades from the Matchup Center (the function near line 4992 that reads `CLAY_DATA.unit_grades`, and every caller). Grades come from the efficiency ranks alone.
- Done: `grep -n "2025" nfl/index.html` shows no hit in Matchup Center or compare code (Madden or tendencies hits elsewhere can stay; list any that remain in the walkthrough with a reason).

T3. `nfl/index.html`: remove the Projections tab.
- Delete the nav button (line ~1923), `#tab-projections`, the projections render and sub-tab code (`switchProjSubTab` and what only it uses), and `loadClayProjections()` with its boot calls (~2326, ~3763). Delete `CLAY_DATA` and everything that only exists to read it.
- Remove the home widgets that read `CLAY_DATA` (the spotlight near ~2838 and the power index near ~3472): delete them, don't invent a replacement.
- Remove the "Mike Clay Projections" entry from `HOME_FEATURES`, and any command-palette or search entries that point at the projections tab.
- Done: `grep -n -i "clay" nfl/index.html` returns nothing.

T4. `nfl/index.html`: Teams loses its Moves and Power Index sub-tabs.
- Delete `#teamsMovesPanel`, `#teamsPowerPanel`, the moves newswire code (`renderMovesView`, `renderMovesNewswire`, `renderMovesFilters`, `setMoves*`, `showMovesTab`, the `tx*` filter state, the move detail drawer) and the power heatmap code (`renderMacroRow`, `renderHeatmap`). With only Overview left, drop the `#teamsSubTabs` bar too.
- Remove the "Transactions" entry from `HOME_FEATURES` (the "Every offseason move since Super Bowl LX" card) and any palette, search or `showTab('feed')` links to moves.
- KEEP the transactions data load in `loadAllData()` if anything still reads `DATA.transactions` (for example roster gains and losses). Grep before deleting.
- Done: `grep -n -i "movesContainer\|teamsMovesPanel\|teamsPowerPanel\|offseason\|Super Bowl LX" nfl/index.html` returns nothing.

T5. `nfl/index.html`: in the roster modal, remove the Projections and Draft Capital sides.
- Delete `#rosterTabProj`, `#rosterTabDc` and their render branches in `showRosterSide`. Change every default side `'projections'` (`openRosterFromAbbr`, `openRoster` callers such as the team quick chips near ~2603) to the depth chart side the modal already has, whichever is first in the tab row.
- Remove the `draft-capital.json` load if nothing else reads it.
- Done: `grep -n "draftcap\|rosterTabProj\|rosterTabDc\|'projections'" nfl/index.html` returns nothing.

T6. Tests and inventory.
- Delete `moves_filtering.test.js` (it asserts on the removed Moves code) and `test_projections.py` (Projections tab UI test).
- In `test_all_extensions.py`, delete the `#tab-projections` and Draft Capital blocks (~lines 100-140) and nothing else.
- In `scripts/data-assets.json`, set `clay_projections` and `draft_capital` to `"required": false` and add to their notes "no longer read by /nfl/ (2026-11-02)". Do NOT delete the data files, the extractor, or the sync scripts.
- Done: all of these exit 0:
  - `node check_html_scripts.mjs`
  - `node scripts/validate-data.js`
  - `node --test validate_data.test.js sync_scores.test.js persist_espn_transactions.test.js update_rosters_from_espn.test.js concurrent_publish.test.js scripts/league_data.test.js scripts/team_tendencies.test.js nba/nba.test.mjs`
  - `python3 -m pytest -q test_schedule_data.py test_schedule_refresh.py` (run it if pytest is installed; otherwise mark SKIPPED)

T7. Self-review. Reread every hunk of your diff in `nfl/index.html`. Look for orphaned functions (defined, never called), calls to functions you deleted, empty containers, dangling `onclick`s, and CSS blocks only the removed UI used (`.moves-*` and the like, including the `body.theme-analyst .moves-*` variants). Delete orphans. List each one you removed in the walkthrough.

## Hard rules
- Do NOT run any git commands (no commit, push, branch, pull). Leave changes in the working tree. A bot commits score syncs to main; the orchestrator handles git.
- Do NOT add dependencies (no npm, no pip install).
- Do NOT touch `nba/`, `index.html` at the root, roster data, Supabase, or the sync and publish scripts.
- Do NOT redesign anything. This packet only removes things and swaps a data season. No new UI beyond relabelling.
- BUDGET: static edits plus the commands listed above. No dev server, no browser.

## Required output
Write `delegation/PACKET-2026-11-02-1-walkthrough.md`. For each task ID: files touched (file:line), what changed, and the command output that verifies it. Mark anything not done as SKIPPED with a one-line reason. End with the `git diff --stat`-style list of files changed (from `ls -l`/your own record, not git) and the line count of `nfl/index.html` before and after.
More than two files change, so also draw what changed with reladraw (`reladraw --help`) as
`delegation/PACKET-2026-11-02-1-changes.reladraw`, render it to .svg next to it,
and link the .svg at the top of the walkthrough.

## Excluded (orchestrator-side, do not attempt)
- Browser check of /nfl/ at phone and desktop width after the change.
- Scheduling `build_team_efficiency.py` in the daily publisher so 2026 stays current week to week.
- Committing and deploying.
