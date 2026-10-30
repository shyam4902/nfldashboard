# PACKET-2026-10-30-6: Move NFL to /nfl/, make / a sport picker
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: freebuff, same session, after PACKET-2026-10-30-5. Tasks in priority order; if time
runs out, stop at a task boundary and mark the rest SKIPPED. T1-T3 must land together (a
half-moved page breaks the live site), so do those first and finish them before anything else.

## Rule this implements (Shyam, 2026-10-30)

Every league lives on its own sub-page (`/nfl/`, `/nba/`, later others). `/` is only a sport
picker. See the "Site layout rule" line in AGENTS.md.

## What stays where

Only the NFL page's HTML moves. Every data file (`schedule.json`, `data/shared/*`, root JSON
fallbacks, `scripts/load_team_tendencies.js`) stays exactly where it is, because the hourly
score-sync bot and the daily publish job write them at those paths. The moved page must
therefore load them with root-absolute URLs.

## Tasks

T1. Move the page. `mv index.html nfl/index.html` (create `nfl/`). Then in `nfl/index.html`
change every relative data URL to root-absolute. The full list found on 2026-10-30:
`./data/shared/{schedule,props-board,pipeline-status,nfl_stats_2026,nfl_standings_2026,freshness,clay_projections_2026,team_season_efficiency}.json`,
`./schedule.json`, `./props-board.json`, `./nfl_stats_2026.json`, `./nfl_standings_2026.json`,
`./clay_projections_2026.json`, `./team_season_efficiency.json`, `draft-capital.json`,
`nfl_rosters_2026.csv`, and the dynamic `import('./scripts/load_team_tendencies.js')`.
Each becomes `/data/shared/...`, `/schedule.json`, `/scripts/load_team_tendencies.js`, and so on.
Also change the two relative paths inside `scripts/load_team_tendencies.js`
(`./data/shared/team_tendencies_2025.json`, `./team_tendencies_2025.json`) to root-absolute,
since a module's `fetch` resolves against the page, not the module. Re-grep afterwards for any
path you missed: `grep -nE "[\"'\`]\./|[\"'\`](data/|scripts/)" nfl/index.html scripts/load_team_tendencies.js`
must print nothing that loads a file.
- In `nfl/index.html`: canonical and `og:url` become `https://matchupboard.com/nfl/`; the sport
  switch NFL link becomes `href="/nfl/"` (still `aria-current="page"`).
- Done: `ls nfl/index.html`, the re-grep above, and `node -e` syntax check of its inline scripts
  (adapt `check_html_scripts.mjs` in T3, then run it).

T2. New `index.html` at the root: the sport picker.
- Same head setup as the NBA page (Tailwind CDN, the palette config, fonts, `:root` variables,
  favicon, canonical `https://matchupboard.com/`, og/twitter tags with the existing og-image.png,
  `<title>Matchup Board · NFL and NBA scores, matchups and stats</title>`).
- Header: the Matchup Board wordmark only.
- Two large cards, NFL (`/nfl/`) and NBA (`/nba/`), each with the league name, a one-line
  description, and one live line: NFL shows "Week N" from `/schedule.json` (`week` field) and
  how many of that week's games are final; NBA shows "N games today" from ESPN's scoreboard
  (`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=<ET date>`;
  reuse the `etDate` approach). If a fetch fails, the card still shows and links, just without the line.
- Old links: if the URL has a hash when `/` loads, it is an old NFL deep link (`/#matchup/...`,
  `/#schedule`, ...). Run `location.replace('/nfl/' + location.hash)` as the first inline script
  in `<head>`, before anything renders.
- No external libraries beyond what the NBA page already uses. Phone first, no sideways scroll at 375px.
- Done: `grep -c 'href="/nfl/"' index.html` ≥ 1, `grep -c 'href="/nba/"' index.html` ≥ 1,
  `grep -c "location.replace('/nfl/'" index.html` is 1.

T3. Point everything else at the new paths.
- `nba/index.html`: the sport switch NFL link becomes `/nfl/`.
- `sitemap.xml`: list `/`, `/nfl/`, `/nba/`.
- `check_html_scripts.mjs`: check `nfl/index.html`, `nba/index.html` and the new `index.html` (all three must pass).
- `moves_filtering.test.js`, `scripts/production-health-check.mjs`, `props-smoke.mjs`: read
  `nfl/index.html` instead of `index.html`. In `props-smoke.mjs` the local server's `/` mapping
  should serve `/nfl/index.html` for the NFL checks.
- `test_all_extensions.py`, `test_projections.py`, `checkpoint5_rehearsal.py`, `audit_mobile.py`:
  `page.goto(... /index.html)` becomes `/nfl/`.
- `scripts/publish-daily.js` line ~318: require `nfl/index.html` instead of `index.html`.
- `_redirects`: add nothing for `/nfl/`; confirm no rule masks `/nfl/*` or `/scripts/load_team_tendencies.js`.
- AGENTS.md and CLAUDE.md: update "The app is primarily `index.html`" and the Site layout rule line to
  say NFL now lives at `nfl/index.html` and `/` is the picker.
- Done: `node check_html_scripts.mjs` (3 files OK), `node --test moves_filtering.test.js validate_data.test.js concurrent_publish.test.js sync_scores.test.js`,
  `node --test nba/nba.test.mjs`, `node scripts/validate-data.js`, and
  `grep -rn "/index.html\|'index.html'\|\"index.html\"" *.py *.mjs *.js scripts/*.js scripts/*.mjs | grep -v "nfl/index.html\|nba/index.html"` printing nothing that still means the NFL page.

T4. Self-review. Re-run every done command above and paste the outputs. List each file you
changed with one line on why. Add a dated line to STATE.md's 2026-10-30 section.

## Hard rules
- No git commands except read-only `git diff --stat` / `git status --short`. Use plain `mv`, not `git mv`.
- No dependencies, no external scripts beyond the NBA page's, no browser, no builds, no live fetches.
- Do not touch any JSON data file, `data/`, `.github/`, or `nba/nba.js`.
- Do not change NFL page behavior beyond the URL paths and the four head/link lines named in T1.

## Required output
`delegation/PACKET-2026-10-30-6-walkthrough.md`: per task, file:line, what changed, done-command
output, SKIPPED with reason where needed, and "Known gaps".

## Excluded (orchestrator-side)
- `fantasyfootball/scripts/install-launchd.sh` copies `index.html` into the local preview
  runtime; Claude updates it (different repo).
- Browser check of `/`, `/nfl/`, old `/#matchup/...` links and `/nba/`; commit, push, live check.
