# PACKET-2026-10-23-1: NBA scores page
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: freebuff. Plan diagram: diagrams/nba-plan.svg

## What we're building

A plain NBA scores site in the style of ESPN's or Sleeper's scores page: scores,
standings, team pages, box scores. Nothing else. No props, odds, betting lines,
news, or fantasy. It lives at `/nba/` next to the existing NFL page (`/`), which
it does not touch beyond one nav link.

Data comes straight from ESPN's public NBA API in the browser. It is keyless and
sends `access-control-allow-origin: *` (checked 2026-10-23). No Supabase, no
cron, no build step. Base URL:
`https://site.api.espn.com/apis/site/v2/sports/basketball/nba`

| Endpoint | Fixture already saved in nba/fixtures/ |
|---|---|
| `/scoreboard?dates=YYYYMMDD` | scoreboard-20261022.json |
| `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings` (note: /apis/v2, not /apis/site/v2) | standings.json |
| `/teams` | teams.json |
| `/summary?event=<id>` | summary-401909093.json |
| `/teams/<id>/schedule` | team-20-schedule.json |
| `/teams/<id>/roster` | team-20-roster.json |

Do not fetch new fixtures. Tests run only against these files.

## Tasks

T1. `nba/nba.js` (new, ES module, no dependencies). Pure functions only, no DOM:
- `etDate(dateOrIso)` returns `YYYYMMDD` in America/New_York. ESPN's `?dates=`
  is the Eastern date, so a 10:30pm ET tipoff is the next UTC day. Copy the
  approach of `etDate` in `sync_scores.js`.
- `parseScoreboard(json)` returns games:
  `{ id, state: 'pre'|'in'|'post', statusText, startISO, broadcast, away, home }`,
  each side `{ id, abbr, name, logo, score|null, record, winner: bool }`.
  `statusText` is ESPN's `status.type.shortDetail` (e.g. "Final", "Q3 4:12", "7:30 PM ET").
- `parseStandings(json)` returns `{ East: rows, West: rows }`, rows
  `{ teamId, abbr, name, logo, wins, losses, pct, gb, streak, last10, seed }`,
  sorted by seed (fall back to win pct). Read values by stat `name`/`type`, never by array index.
- `parseBoxScore(json)` returns `{ teams: [{ abbr, name, logo, starters: [], bench: [], totals }] }`,
  player `{ id, name, pos, stats: { MIN, PTS, FG, '3PT', FT, REB, AST, TO, STL, BLK, PF, '+/-' } }`.
  Map stats by the `labels` array, not fixed positions. Skip DNP players into a `dnp` list with their reason.
- `parseTeamSchedule(json)` returns `{ team, games: [{ id, startISO, opponent, homeAway, result|null, score|null }] }`.
- `parseRoster(json)` returns `[{ id, name, jersey, pos, height, age }]`.
- Every parser returns an empty result (not a throw) for `{}` or missing keys.
- Done: `node -e "import('./nba/nba.js').then(m=>console.log(Object.keys(m).sort().join(',')))"` prints
  `etDate,parseBoxScore,parseRoster,parseScoreboard,parseStandings,parseTeamSchedule`.

T2. `nba/nba.test.mjs` (new, `node:test` + `node:assert`). Load each fixture with `fs`.
- scoreboard-20261022: 2 games, both `post`, first is `CLE @ PHI` (away CLE, home PHI), both scores are numbers, exactly one winner per game.
- standings: 15 rows each in East and West, 30 distinct teamIds, seeds 1-15 in each conference.
- summary-401909093: 2 teams, each has at least 5 starters, `PTS` of the starters plus the bench equals the team's total points.
- team-20 schedule: team name is "Philadelphia 76ers", 80 or more games.
- team-20 roster: 17 players, each has a name.
- etDate: `etDate('2026-10-23T02:30:00Z')` is `20261022`, and `etDate('2026-10-22T16:00:00Z')` is `20261022`.
- Each parser on `{}` returns an empty result without throwing.
- Done: `node --test nba/nba.test.mjs` passes, 0 failures.

T3. `nba/index.html` (new, one file, imports `./nba.js` with `<script type="module">`).
- Reuse the NFL page's look: copy the `tailwind.config` block, the Google Fonts
  `@import`, and the `:root` CSS variables from the top of `index.html` (lines 1-140 area).
  Same Tailwind CDN tag. No other libraries.
- Header: site name, then a sport switch with two links, `NFL` → `/` and `NBA` → `/nba/` (NBA active).
- Hash routes: `#scores` (default), `#scores/YYYYMMDD`, `#standings`, `#team/<id>`, `#game/<id>`.
- Scores: date bar with previous / today / next and the date shown as "Thu, Oct 22". One card per game:
  logos, abbrs, records, scores, status text, broadcast. Live games sort first, then upcoming, then final.
  Winner's score bold, loser's muted. Tap a card → `#game/<id>`. While any game is `in`, refetch every 30s;
  otherwise don't poll. Empty day shows "No games".
- Standings: East and West tables, columns Seed, Team, W, L, PCT, GB, L10, STRK. A thin divider after seed 6 and after seed 10 (play-in line). Team name links to `#team/<id>`.
- Game: line score header (team, score, status), then a box score table per team, starters then bench,
  DNP list under it. Table scrolls sideways on phones with the player column sticky.
- Team: name, logo, record, then schedule (results and upcoming) and roster tabs.
- Loading state on every view. If a fetch fails, show "Couldn't reach ESPN. Retry" with a retry button. Never a blank page.
- Must not render anything from `odds`, `pickcenter`, `againstTheSpread`, `news`, or `article`.
- Phone first: works at 375px with no sideways page scroll.
- `<title>NBA Scores</title>` and a meta description.
- Done:
  - `grep -cE "pickcenter|againstTheSpread|odds" nba/index.html nba/nba.js` prints 0 for both files.
  - `grep -c 'href="/nba/"' nba/index.html` ≥ 1 and `grep -c 'href="/"' nba/index.html` ≥ 1.
  - `node -e "const h=require('fs').readFileSync('nba/index.html','utf8');for(const m of h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)){try{new Function(m[1].replace(/^\s*import[^;]+;/gm,''))}catch(e){console.error(e.message);process.exit(1)}}console.log('ok')"` prints ok.

T4. `index.html` (NFL page). Add an `NBA` link to `/nba/` in the header nav (the `<nav>` inside
`<header class="app-header ...">`, around line 1943). Match the existing nav link classes. Change nothing else
in this file. It already has uncommitted changes from someone else; leave those alone.
- Done: `grep -c 'href="/nba/"' index.html` ≥ 1, and `node check_html_scripts.mjs` exits 0,
  and `git diff --stat index.html` shows no more than 3 more changed lines than before you started
  (run it once before editing and note the number in the walkthrough).

## Hard rules
- Do NOT run any git commands except the read-only `git diff --stat` in T4. No commit, push, or branch.
- Do NOT add dependencies. Do NOT edit any file not named above. Do NOT edit `_redirects`.
- Do NOT touch roster, schedule, standings, or props JSON.
- BUDGET: static edits only. No dev server, no browser, no builds.

## Required output
Write `delegation/PACKET-2026-10-23-1-walkthrough.md`. For each task ID: files touched
(file:line), what changed, the exact done-criteria command and its output. Mark anything
not done as SKIPPED with a one-line reason.
Because more than two files change, also draw what changed with reladraw
(`reladraw --help`) as `delegation/PACKET-2026-10-23-1-changes.reladraw`, render it to `.svg`
next to it, and link the `.svg` at the top of the walkthrough.

## Excluded (orchestrator-side, do not attempt)
- Opening the page in a browser, checking it at 375px, live ESPN fetches.
- Visual polish beyond the NFL palette (PACKET-2026-10-23-2, Gemini).
- Domain purchase and Cloudflare custom-domain setup.
- Commit and push.
