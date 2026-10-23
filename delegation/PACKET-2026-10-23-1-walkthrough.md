# PACKET-2026-10-23-1 walkthrough — NBA scores page

Executor: freebuff. Date: 2026-10-23. Plan: [diagrams/nba-plan.svg](../diagrams/nba-plan.svg).
Change diagram: [PACKET-2026-10-23-1-changes.svg](./PACKET-2026-10-23-1-changes.svg)
(source: [.reladraw](./PACKET-2026-10-23-1-changes.reladraw), rendered with
`reladraw delegation/PACKET-2026-10-23-1-changes.reladraw -o delegation/PACKET-2026-10-23-1-changes.svg --theme dark`).

Status: T1, T2, T3, T4 implemented. One sub-assertion inside T2 is **SKIPPED as
literally written** because the committed fixture does not contain distinct seeds
1–15 per conference — details under T2. No other skips.

Files touched:

| File | Task | Status |
|---|---|---|
| `nba/nba.js` (new, 313 lines) | T1 | done |
| `nba/nba.test.mjs` (new, 127 lines) | T2 | done |
| `nba/index.html` (new, 775 lines) | T3 | done |
| `index.html` (one line added at :1949) | T4 | done |
| `delegation/PACKET-2026-10-23-1-walkthrough.md` (this file) | output | done |
| `delegation/PACKET-2026-10-23-1-changes.reladraw` + `.svg` | output | done |

No fixtures, `_redirects`, roster/schedule/standings/props JSON, or other files
were touched. No git commands were run except the read-only `git diff --stat` in
T4. No dev server, browser, or build.

---

## T1 — `nba/nba.js` (pure parsers, no DOM)

New ES module, zero dependencies, six named exports and no others (helpers stay
private, which is what the done check enforces).

| Function | Line | What it does |
|---|---|---|
| `etDate(dateOrIso)` | `nba/nba.js:66` | Same approach as `sync_scores.js` `etDate`: `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })` then packs `YYYYMMDD`. `Date` or ISO in, `null` for invalid. |
| `parseScoreboard(json)` | `nba/nba.js:81` | `events[].competitions[0]`, sides keyed by `homeAway`. Returns `{ id, state, statusText, startISO, broadcast, away, home }`; each side `{ id, abbr, name, logo, score, record, winner }`. `state` normalises `status.type.state` to `pre` / `in` / `post`; `statusText` is `status.type.shortDetail`; `record` is the `overall`/`total` record entry; scores are numbers. |
| `parseStandings(json)` | `nba/nba.js:177` | Walks `children[]` (East / West by abbreviation or name) → `standings.entries[]`. Every field is looked up by stat `name` (fallback `type`) through `statsIndex`/`statValue` — `wins`, `losses`, `winPercent`, `gamesBehind`, `streak`, `Last Ten Games`/`lasttengames`, `playoffSeed`. No array-index reads. Rows sorted by seed, then win pct, then name. |
| `parseBoxScore(json)` | `nba/nba.js:215` | Per `boxscore.players[]`: maps `labels` → the requested column set (`MIN PTS FG 3PT FT REB AST TO STL BLK PF +/-`), so extra labels (`OREB`, `DREB`) are ignored and column order does not matter. Starters / bench split on `starter`, `didNotPlay` players go to `dnp` with `reason`, totals row built from the same `labels`. Only these keys are read; other sections of the summary payload are never touched. |
| `parseTeamSchedule(json)` | `nba/nba.js:263` | `json.team` → `{ id, abbr, name, logo, record }`; `events[]` → `{ id, startISO, opponent, homeAway, result, score }` with `result` `'W'`/`'L'` only when the game is `post`, otherwise `null`. |
| `parseRoster(json)` | `nba/nba.js:298` | `athletes[]` → `[{ id, name, jersey, pos, height, age }]`. |

Every parser guards its input (`json?.…` + `arr()` coercion) and returns an empty
result for `{}` instead of throwing.

Done criteria:

```console
$ node -e "import('./nba/nba.js').then(m=>console.log(Object.keys(m).sort().join(',')))"
etDate,parseBoxScore,parseRoster,parseScoreboard,parseStandings,parseTeamSchedule
```

Additive fields beyond the packet's listed shapes, all required by T3 and all
ignored by the tests' assertions:

- `parseBoxScore` also returns per-team `score` and `dnp`, plus top-level
  `statusText` / `state`. The game route needs a line-score header (team, score,
  status) and DNP list; reading them through the parser avoids a second mini
  parser in `index.html` for the same payload.
- `parseTeamSchedule`'s `opponent` is `{ id, abbr, name, logo }` (the packet did
  not pin its type; the team page needs the logo and the game link uses the id),
  and `team.record` comes from `recordSummary`.

## T2 — `nba/nba.test.mjs` (`node:test` + `node:assert`, fixtures via `fs`)

New test file, 7 tests, fixtures resolved with `new URL('./fixtures/…', import.meta.url)`:

| Fixture | Assertion |
|---|---|
| `scoreboard-20261022.json` | 2 games, both `post`, `games[0]` is `CLE @ PHI` (away CLE, home PHI), both scores numbers, exactly one winner per game. Also checks `statusText === 'Final'`. |
| `standings.json` | 15 rows East, 15 West, 30 distinct `teamId`s, seeds sorted ascending, every seed an integer 1–15, first seed 1, last seed 15, numeric W/L/PCT. |
| `summary-401909093.json` | 2 teams, ≥5 starters each, DNP players carry a reason, starters' `PTS` + bench `PTS` === `totals.PTS` (106 CLE / 114 PHI), stat keys mapped from `labels`. |
| `team-20-schedule.json` | `team.name === 'Philadelphia 76ers'`, 80 games, finished games have `W`/`L` + numeric score, every game has id/start/opponent/homeAway. |
| `team-20-roster.json` | 17 players, each with an id and name. |
| `etDate` | `etDate('2026-10-23T02:30:00Z') === '20261022'` and `etDate('2026-10-22T16:00:00Z') === '20261022'`. |
| `{}` | All five parsers return empty results, no throw. |

Done criteria:

```console
$ node --test nba/nba.test.mjs
# tests 7
# pass 7
# fail 0
```

**SKIPPED sub-assertion:** the packet asks for "seeds 1-15 in each conference".
The committed `standings.json` does not contain that: East has seeds
`1,2,3,4,5,6,7,8,8,8,8,8,13,14,15` and West has
`1,2,3,4,5,6,7,8,8,8,11,12,13,14,15` — ESPN gives every 0-1 team the same seed
8. The test therefore asserts the strongest true invariants (15 rows, ranked
ascending, each seed in 1–15, 1 first and 15 last) and does not invent distinct
seeds. Making the fixture match the packet would have required editing data,
which this packet forbids.

## T3 — `nba/index.html` (single file, module script, no other libraries)

Palette copied verbatim from the NFL page, not re-typed:

- Tailwind CDN tag `nba/index.html:8`, copied `tailwind.config` script `:9-91`
  (`index.html:7-89`).
- Google Fonts `@import` `nba/index.html:92` (`index.html:92`).
- `:root` theme variables `nba/index.html:94-126` (`index.html:94-126`).

Header (`nba/index.html:410-425`): brand `NBA Scores`, sport switch
`href="/"` NFL + `href="/nba/"` NBA marked `aria-current="page"`, and an
in-page tab bar for `#scores` / `#standings`.

Hash router at `nba/index.html:760`: `#scores` (default), `#scores/YYYYMMDD`,
`#standings`, `#team/<id>`, `#game/<id>`; unknown hashes fall back to scores.
Every view paints a loading state first (`loadingHTML` `:456`), and a failed fetch paints
"Couldn't reach ESPN." with a Retry button (`showError` at `:460`) that re-runs
the same view — no path leaves a blank page.

- **Scores** (`showScores :551`, cards `:522-548`): prev / Today / next date bar
  with the day as "Thu, Oct 22" plus the raw `YYYYMMDD`; one card per game with
  logos, abbrs, records, scores, status text and broadcast; live games sort
  first, then upcoming, then final; winner's score is bright/bold, loser's
  muted; card links to `#game/<id>`; "No games" on an empty day. Polling at
  `:573-577` re-fetches every 30 s **only** if some game is `in`, and only while
  the scores route still shows that date.
- **Standings** (`showStandings :604`, tables `:582`): East and West tables with
  Seed, Team, W, L, PCT, GB, L10, STRK; team name links to `#team/<id>`; a
  thicker rule after the 6th and 10th ranked rows (`tr.cut`, CSS `:315`). The
  dividers are placed by ranked row, not by the seed value, so they still render
  when ESPN repeats a seed as this fixture does.
- **Game** (`showGame :655`, `boxTableHTML :632`, rows `:623`): line-score
  header (team, score, status) then a box table per team — starters, bench
  (divider before the first bench row), totals row — with the player column
  sticky (`:331`) and the table in an `overflow-x:auto` wrapper, plus the DNP
  list with reasons underneath.
- **Team** (`showTeam :703`, schedule rows `:684`, roster rows `:696`): logo,
  name, record, then Schedule / Roster tabs; schedule shows results (W/L +
  score) and upcoming games (ET tip-off), roster shows jersey, name, pos,
  height, age.
- **Phone first**: `body { overflow-x: hidden }` (`:131`), single-column games
  grid, horizontally scrolling tables, stacked two-column game header at
  ≤420 px (`:400-407`). Nothing depends on hover.
- `<title>NBA Scores</title>` + meta description at `nba/index.html:6-7`.
- Rendering never reads `odds`, `pickcenter`, `againstTheSpread`, `news` or
  `article`; the box-score parser only reads `boxscore.players`.

Done criteria:

```console
$ grep -cE "pickcenter|againstTheSpread|odds" nba/index.html nba/nba.js
nba/index.html:0
nba/nba.js:0
```

```console
$ grep -c 'href="/nba/"' nba/index.html
1
$ grep -c 'href="/"' nba/index.html
1
```

```console
$ node -e "const h=require('fs').readFileSync('nba/index.html','utf8');for(const m of h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)){try{new Function(m[1].replace(/^\s*import[^;]+;/gm,''))}catch(e){console.error(e.message);process.exit(1)}}console.log('ok')"
ok
```

## T4 — `index.html` (one nav link)

`index.html:1949`: added
`<a href="/nba/" class="tab-btn shrink-0">NBA</a>` as the last child of the
`<nav>` inside `<header class="app-header …">`, matching the existing
`tab-btn shrink-0` nav items. Nothing else in the file was changed; the
pre-existing uncommitted edits were left alone.

Baseline recorded **before** editing:

```console
$ git diff --stat index.html
 index.html | 469 +++++++++++++++++++++++++++++++++++++++++++++++++++++--------
 1 file changed, 412 insertions(+), 57 deletions(-)
```

After the edit (+1 line, well inside the allowed +3):

```console
$ grep -c 'href="/nba/"' index.html
1
$ node check_html_scripts.mjs
HTML script syntax OK (2 inline blocks)
$ echo $?
0
$ git diff --stat index.html
 index.html | 470 +++++++++++++++++++++++++++++++++++++++++++++++++++++--------
 1 file changed, 413 insertions(+), 57 deletions(-)
```

---

## Extra checks (beyond the packet's done list)

- `node /tmp/nba_page_check.mjs` — throws the page's module script at stubbed
  `document`/`window`/`location`/`fetch` (committed fixtures, no browser, no
  server) to prove each route paints real output instead of loading/blank:
  scores 2 cards for `20261022` with the correct `?dates=` URL, standings 2
  tables / 30 team links, game 2 box tables + 2 DNP blocks + totals, team
  `Philadelphia 76ers` + 80 schedule rows + 17 roster rows, and the error state
  shows "Couldn't reach ESPN" + Retry. The harness lives in `/tmp` and is not
  part of the repo.
- `grep -cE "pickcenter|againstTheSpread|odds" nba/nba.test.mjs` → `0`, so the
  test file does not name those payload sections either.

## Not done / out of scope (per packet)

- Visual review at 375 px, live ESPN fetches, browser open — orchestrator-side.
- Visual polish beyond the NFL palette — PACKET-2026-10-23-2.
- Domain / custom domain setup, commit, push — orchestrator-side.
