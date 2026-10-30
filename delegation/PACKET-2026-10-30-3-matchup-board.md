# PACKET-2026-10-30-3: Matchup Board rebrand + NBA matchups
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: freebuff. Plan diagram: diagrams/packet-3-plan.svg
Size: this is a full one-hour packet. Do every task in order, then the self-review (T9).
Don't stop early to suggest follow-ups. If you finish with time left, spend it on T9.

## What this is

The site is now live at https://matchupboard.com. NFL is at `/` (`index.html`, 500KB single
file) and NBA is at `/nba/` (`nba/index.html` + `nba/nba.js`, built in PACKET-2026-10-23-1,
read that packet and its walkthrough first). The product is **Matchup Board**: scores plus the
data you'd use to size up a matchup, in a clean layout you'd otherwise pay for. No props, odds,
betting lines, predictions, news or fantasy, anywhere, ever.

This packet does three things:
1. Rebrand both pages as Matchup Board with one NFL | NBA switch (T1-T2).
2. Add the files a real domain needs: favicon, share-card tags, robots, sitemap (T3).
3. Add the matchup features on NBA: team vs team compare, a pre-game matchup page, and
   player pages (T4-T8).

## Data (all keyless, all send `access-control-allow-origin: *`, checked 2026-10-30)

Base `S = https://site.api.espn.com/apis/site/v2/sports/basketball/nba`
Base `W = https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba`

| Endpoint | New fixture in nba/fixtures/ |
|---|---|
| `S/teams/<id>/statistics` | team-20-statistics.json (PHI), team-5-statistics.json (CLE) |
| `S/summary?event=<id>` for a game not yet started | summary-401909903-pre.json (BOS @ ORL, state `pre`) |
| `W/athletes/<id>` | athlete-4431678.json (Tyrese Maxey) |
| `W/athletes/<id>/overview` | athlete-4431678-overview.json |
| `W/athletes/<id>/gamelog` | athlete-4431678-gamelog.json |
| `S/scoreboard?dates=20261101` | scoreboard-20261101.json (upcoming games) |

Shape notes so you don't have to dig:
- Team statistics: `results.stats.categories[]` (`general`, `offensive`, `defensive`), each with
  `stats[]` of `{ name, displayValue, value }`. Read by `name`, e.g. `avgPoints`,
  `fieldGoalPct`, `threePointPct`, `freeThrowPct`, `avgRebounds`, `avgAssists`, `avgTurnovers`,
  `avgSteals`, `avgBlocks`, `assistTurnoverRatio`, `gamesPlayed`. If a name is missing, return null.
  Points allowed is not here: take `avgPointsFor` / `avgPointsAgainst` from the standings fixture
  (already parsed by `parseStandings`, extend it to return them as `ppg` / `oppPpg`).
- Pre-game summary: use only `header`, `boxscore.teams` (team info), `lastFiveGames`,
  `seasonseries`, `injuries`, `leaders`, `gameInfo`. Never read `odds`, `pickcenter`,
  `againstTheSpread`, `predictor`, `winprobability`, `news`, `videos`, `ticketsInfo`.
- Athlete overview: `statistics.labels` (GP, MIN, FG%, 3P%, FT%, REB, AST, BLK, STL, PF, TO, PTS)
  and `statistics.splits[]` (`Regular Season`, `Career`, each `stats[]` aligned to labels).
  Never read `news`, `rotowire`, `fantasy`.
- Gamelog: `labels[]`; `events` is an object keyed by event id with `gameDate`, `atVs`,
  `opponent`, `gameResult`, `score`; per-game stats sit in
  `seasonTypes[].categories[].events[] = { eventId, stats[] }`, aligned to `labels`.

Do not fetch new fixtures. Tests run only against the files above and the existing ones.

## Tasks

T1. Brand on the NFL page, `index.html`. Touch only the `<head>` and the brand block inside
`<header class="app-header ...">` (around line 1883-1892) and the NBA link you added last time
(around line 1949). Change nothing else in this file.
- `<title>Matchup Board · NFL scores, matchups and stats</title>` and a matching meta description.
- Replace the "NFL 2026 Pro Hub" brand with `Matchup Board` (same `hdr-brand` styling, gold
  "Matchup", white "Board"), followed by a two-option sport switch: `NFL` (current, `aria-current="page"`,
  `href="/"`) and `NBA` (`href="/nba/"`). Remove the old `NBA` tab-btn link from the nav so there's
  one way to switch, not two. Keep the `hdr-season` text.
- Done: `grep -c "Matchup Board" index.html` ≥ 2, `grep -c 'href="/nba/"' index.html` is 1,
  `node check_html_scripts.mjs` exits 0, and `git diff --stat index.html` stays under 40 changed lines.

T2. Brand on the NBA page, `nba/index.html`. Same brand and the same switch (NBA current).
`<title>Matchup Board · NBA scores, matchups and stats</title>` + meta description. Add a
`Compare` tab next to Scores and Standings (goes to `#compare`).
- Done: `grep -c "Matchup Board" nba/index.html` ≥ 2, `grep -c 'href="#compare' nba/index.html` ≥ 1.

T3. Domain files (new files at repo root) and head tags on both pages.
- `favicon.svg`: a simple "MB" monogram, gold `#d9a441` on charcoal `#101215`, rounded square, 64x64 viewBox.
- `og-image.svg`: 1200x630 share card, charcoal background, "Matchup Board" large, a line
  "NFL and NBA scores, matchups and stats", and `matchupboard.com`. System fonts only
  (`font-family="Helvetica, Arial, sans-serif"`), no external references. Claude renders it to
  `og-image.png` afterwards; reference the `.png` in the tags.
- On both pages: `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
  `<link rel="canonical">` (`https://matchupboard.com/` and `https://matchupboard.com/nba/`),
  `og:title`, `og:description`, `og:url`, `og:type=website`, `og:image=https://matchupboard.com/og-image.png`,
  `og:image:width=1200`, `og:image:height=630`, `twitter:card=summary_large_image`.
- `robots.txt`: allow all, `Sitemap: https://matchupboard.com/sitemap.xml`.
- `sitemap.xml`: the two URLs.
- Done: `grep -c 'og:image' index.html nba/index.html` ≥ 3 each; `grep -c 'rel="icon"' index.html nba/index.html` is 1 each;
  `xmllint --noout sitemap.xml og-image.svg favicon.svg` exits 0; `cat robots.txt`.

T4. New parsers in `nba/nba.js` (pure, no DOM, same style as the existing ones, empty result on `{}`):
- `parseTeamStats(json)` → `{ gamesPlayed, ppg: null, fgPct, threePct, ftPct, reb, ast, tov, stl, blk, astTo }` (ppg filled from standings by the caller).
- `parsePreGame(json)` → `{ id, startISO, venue, status, away, home, seasonSeries: [{ id, date, away, home, awayScore, homeScore, winnerAbbr }], lastFive: { [abbr]: [{ id, date, opponentAbbr, result, score }] }, injuries: { [abbr]: [{ name, pos, status, detail }] }, leaders: { [abbr]: [{ category, name, value }] } }`. Away/home come from `header.competitions[0].competitors` by `homeAway`.
- `parseAthlete(json)` → `{ id, name, jersey, pos, height, weight, age, headshot, team: { id, abbr, name } }`.
- `parsePlayerOverview(json)` → `{ labels, season: { [label]: value }, career: { [label]: value } }`.
- `parseGameLog(json)` → `{ labels, games: [{ id, date, atVs, opponentAbbr, result, score, stats: { [label]: value } }] }`, newest first, joining per-game stats to `events` by `eventId`.
- Extend `parseStandings` rows with `ppg` and `oppPpg` (from `avgPointsFor` / `avgPointsAgainst`) without changing anything existing.
- Done: the export check prints all eleven names
  `node -e "import('./nba/nba.js').then(m=>console.log(Object.keys(m).sort().join(',')))"` →
  `etDate,parseAthlete,parseBoxScore,parseGameLog,parsePlayerOverview,parsePreGame,parseRoster,parseScoreboard,parseStandings,parseTeamSchedule,parseTeamStats`.

T5. Tests in `nba/nba.test.mjs` (add, don't rewrite the existing 7):
- team-20-statistics: `gamesPlayed` is a number > 0, `fgPct`, `threePct`, `reb`, `ast` are numbers.
- standings rows now carry numeric `ppg` and `oppPpg` for all 30 teams.
- summary-401909903-pre: away BOS, home ORL, `lastFive` has entries for both abbrs, the result object
  has no key named `odds`, `pickcenter`, `predictor` or `winprobability` anywhere (walk it recursively).
- athlete-4431678: name "Tyrese Maxey", team abbr "PHI".
- overview: `labels` includes PTS, `season.PTS` and `career.PTS` are present.
- gamelog: at least 5 games, sorted newest first by date, each game has `stats.PTS`.
- All new parsers return empty results for `{}`.
- Done: `node --test nba/nba.test.mjs` passes, 0 failures, at least 14 tests.

T6. `#compare/<idA>/<idB>` view in `nba/index.html` (and bare `#compare` = two empty pickers).
- Two `<select>`s listing all 30 teams (from standings), a swap button. Changing either updates the hash.
- Header: both logos, names, records.
- Table: one row per stat (Record, PPG, Opp PPG, Diff, FG%, 3P%, FT%, REB, AST, TOV, STL, BLK, AST/TO),
  team A value | label | team B value. Bold and gold the better value per row; for Opp PPG and TOV
  lower is better. Ties: neither highlighted.
- Below: each team's last 5 results (from the team schedule you already parse), and "This season"
  head-to-head games (games present in both schedules), with links to `#game/<id>`.
- Fetches: standings once per page load (cache it in memory), both teams' statistics and schedules in parallel.
- Entry points: the Compare tab, a "Compare" link on the team page header (prefills team A), and
  the pre-game page (T7).

T7. Pre-game matchup page. In `showGame`, when the game's state is `pre` (summary has no
`boxscore.players`), render the matchup instead of "No box score":
- Header with both teams, records, tip-off time in ET, venue, broadcast.
- The same compare table as T6 for the two teams (reuse the T6 render function, don't copy it).
- Season series so far, each team's last five, key injuries, and team leaders.
- A link "Full comparison" to `#compare/<awayId>/<homeId>`.
- Live and final games keep the box score exactly as now.

T8. `#player/<id>` view.
- Header: headshot, name, jersey, position, height/weight/age, team link (`#team/<id>`).
- Averages table: Season and Career rows, columns from `labels`.
- Game log table: date, opponent (with @/vs), result + score, then the stat columns. Sticky first column, sideways scroll on phones, like the box score.
- Entry points: every player name in the box score and the roster links to `#player/<id>`
  (`parseBoxScore` and `parseRoster` already return ids).
- Loading and error states like the other views. Fetch the three athlete endpoints in parallel.

T9. Self-review, then update docs.
- Run every done command above again and paste the output.
- Banned-content check: `grep -cE "pickcenter|againstTheSpread|odds|predictor|winprobability|rotowire|fantasy" nba/index.html nba/nba.js` prints 0 for both.
- Escaping check: every API string placed into `innerHTML` goes through `esc()`. List any you fixed.
- Timers: only the scores view polls; no view leaves a timer running after the hash changes.
- `node -e` inline-script syntax check from PACKET-2026-10-23-1 T3 still prints ok.
- Phone width: reason through 375px for compare, pre-game and player views (no sideways page
  scroll; tables scroll inside their wrapper) and note anything you changed.
- Add a short dated section at the top of `STATE.md` (below the header lines) describing what shipped,
  in the same style as the 2026-10-23 entry.

## Hard rules
- Do NOT run any git commands except read-only `git diff --stat`. No commit, push, or branch.
- Do NOT add dependencies or external scripts. Tailwind CDN and Google Fonts only, as now.
- Do NOT edit files not named in this packet. In `index.html`, only the head and header-brand lines from T1/T3.
- Do NOT edit `_redirects`, any JSON data file, or anything under `data/`.
- BUDGET: static edits only. No dev server, no browser, no builds.

## Required output
Write `delegation/PACKET-2026-10-30-3-walkthrough.md`: per task ID, files touched (file:line),
what changed, each done command with its output. Mark anything not done as SKIPPED with a
one-line reason. Draw what changed with reladraw as
`delegation/PACKET-2026-10-30-3-changes.reladraw`, render it to `.svg`, and link it at the top.
Don't end with a list of suggested follow-ups; put real open issues in a "Known gaps" section instead.

## Excluded (orchestrator-side, do not attempt)
- Rendering `og-image.svg` to `og-image.png`.
- Browser checks at 375px and desktop, live ESPN data.
- Commit, push, and checking the live site.
