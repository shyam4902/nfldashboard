# PACKET-2026-10-30-4 walkthrough — NBA depth (leaders, search, live box, gap fixes)

Executor: freebuff. Date: 2026-10-30. Packet: [PACKET-2026-10-30-4-nba-depth.md](./PACKET-2026-10-30-4-nba-depth.md).
Change diagram: [PACKET-2026-10-30-4-changes.svg](./PACKET-2026-10-30-4-changes.svg)
(source: [.reladraw](./PACKET-2026-10-30-4-changes.reladraw), rendered with
`reladraw delegation/PACKET-2026-10-30-4-changes.reladraw -o delegation/PACKET-2026-10-30-4-changes.svg --theme dark`).

Status: T1–T9 implemented, T10 below. Nothing skipped. Only `nba/index.html`, `nba/nba.js`,
`nba/nba.test.mjs`, `STATE.md` and the two walkthrough files were touched. No git command
beyond read-only `git diff --stat` / `git status --short`. No dev server, browser, build or
live fetch.

| File | Task | Change |
|---|---|---|
| `nba/nba.js` | T1, T2, T4 | `parseLeaders`, `parseSearch`, `parseGameLog` split by season type |
| `nba/index.html` | T1–T8 | Leaders view, header search, live polling, season tabs, team cache, series/standings/date fixes |
| `nba/nba.test.mjs` | T9 | four tests (18 total) plus one shape assertion updated by T4 |
| `STATE.md` | T10 | appended to the 2026-10-30 section |
| `delegation/PACKET-2026-10-30-4-*` | output | walkthrough + diagram |

---

## T1 — Leaders (`#leaders`)

**Parser** `nba/nba.js:536` — `parseLeaders(json, category, stat)` → `[{ rank, id, name, teamAbbr, headshot, value, gp }]`.

- Finds the top-level category whose `name` matches, takes `names[]`, and resolves the
  requested stat's **index by name**. Missing stat → `[]` (never a fixed-index read).
- Per athlete, reads `categories[j].totals[]` from the block whose `name` matches, pulls the
  value at that index, sorts descending, slices to 10 and renumbers `rank` 1..10.
- `gp` comes from the athlete's `general` block (`gamesPlayed`), so every board can show it.

**Stat-name check.** All six requested names exist in the committed fixture's
`categories[].names`, so no substitution was needed:

```
general     : gamesPlayed … avgRebounds
offensive   : avgPoints, avgThreePointFieldGoalsMade, avgAssists …
defensive   : avgSteals, avgBlocks …
```

**View** `nba/index.html:1163-1215`, tab at `:682`.

- Six boards: Points (`offensive.avgPoints`), Rebounds (`general.avgRebounds`), Assists
  (`offensive.avgAssists`), Steals (`defensive.avgSteals`), Blocks (`defensive.avgBlocks`),
  3PM (`offensive.avgThreePointFieldGoalsMade`).
- One fetch per board, in parallel (`Promise.all` over `LEADER_BOARDS`), each URL
  `…/statistics/byathlete?limit=50&category=<cat>&sort=<cat>.<stat>:desc`. Each board's
  `.board-body` is filled as its own response lands (`body.innerHTML = leaderBoardHTML(rows)`),
  so a slow board never blocks the others.
- `leadersCache` (module map) holds each board for the page session; a cached board renders
  immediately and its fetch is skipped.
- Every player name links to `#player/<id>`; rows show rank, headshot, name, team, value and GP.
- A failed board paints "Couldn't load this board." while the rest still render.

## T2 — Player search

**Parser** `nba/nba.js:569` — `parseSearch(json)` → NBA only. Keeps `league === 'nba'`
(case-insensitive), reads `teamRelationships[type=team].core.abbreviation` for the team.

**UI** header markup `nba/index.html:668-674`, styles from `:547`, logic `:1217-1340`.

- Input with `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`;
  results `<ul role="listbox">` with `<li role="option" id="search-opt-<id>"
  aria-selected>`.
- 250 ms debounce, minimum 2 characters. Every new request aborts the previous one
  (`AbortController`); an `AbortError` is ignored rather than painted.
- Up to 8 results. Arrow keys move (`aria-selected` follows, wraps at both ends), Enter opens
  the active result, click opens the clicked one, Escape closes and clears the dropdown.
- On phones (≤560 px) the field collapses to a `⌕` toggle; opening it expands the input across
  the header row (brand and sport switch hide) and the dropdown hangs below. On desktop the
  input is always visible.
- Closing (Escape, toggle, or picking a result) clears the debounce timer and aborts the
  in-flight request, so a late response cannot reopen the list.

## T3 — Live game page

`showGame(id, isRefresh)` at `nba/index.html:1577`, `armGamePoll` at `:1570`,
`renderBoxScore(box, live)` at `:1609`.

- When a summary parses to a box score **and** `state === 'in'`, the page renders and then arms
  a 30 s timer. The timer re-runs `showGame(id, true)` only if the hash still points at that
  game; `isRefresh` skips the loading state, so the page updates in place with no flash.
- The header grows a `Live · updates every 30s` line only while live (`gh-live`).
- Final/pre games never arm the timer; a refresh that errors re-arms instead of showing the
  error state, matching the scores view.

## T4 — Game log by season type

`nba/nba.js:495` — `parseGameLog` now returns `{ labels, seasons: [{ name, games }], games }`.

- One season block per `seasonTypes[].displayName`; each block's games come from
  `seasonTypes[].categories[].events[]` joined to `events` by `eventId`, newest first.
- Season blocks are ordered by their newest game (so Regular Season precedes Preseason here).
- Top-level `games` is the Regular Season list (fallback: the newest season), so packet-3
  callers keep working.

Player page `nba/index.html:1370-1405`: the game log is a tab row (`Season`, `Preseason`)
with one panel per season; Regular Season is selected by default, and switching is client-side
with no refetch (`wireSeasonTabs`, `:1394`).

One packet-3 test assertion was updated, not weakened: `parseGameLog({})` must now equal
`{ labels: [], seasons: [], games: [] }` because T4 added the `seasons` key. The other
packet-3 gamelog assertions (≥5 games, newest first, `stats.PTS`) still pass unchanged.

## T5 — Team data cache

`nba/index.html:954-980` — one helper, `teamData(id)`, caches `{ stats, schedule }` per team id
for 5 minutes (`TEAM_TTL`). Failures are not cached. Consumers:

- `teamBundle(id)` (`:983`) — compare and pre-game: `Promise.all([getStandings(), teamData(key)])`.
- `showTeam(id)` (`:1424`) — team page: `teamData(id).then(data => data.schedule)` alongside the
  roster fetch, still in parallel.

The roster is intentionally not cached (it is not in the packet's cache list and is only used
by the team page).

## T6 — Season series rows

`nba/index.html:1489-1512`. Finished series games render both teams with their scores:
`seriesTeamHTML(abbr, score, winnerAbbr)` gives the winner `.winner` (bright, 700) and the
loser `.loser` (faint, 500), with `@` between them and `Final` on the right. Upcoming games
keep the `BOS @ ORL` + `Upcoming` treatment. All values pass through `esc`.

## T7 — Standings PPG / OPP / DIFF

`nba/index.html:889-930` plus the `diff-pos` / `diff-neg` rules in the stylesheet.

- Three columns after GB: `PPG`, `OPP`, `DIFF`, read from the already-parsed `ppg` /
  `oppPpg`.
- `DIFF` is signed (`+7.0`, `-3.5`); positive uses the existing gold accent, negative is muted,
  zero/unknown is neither. No new colours.
- `.standings` min-width raised 460 → 580 so 11 columns stay readable; the table still scrolls
  inside `.table-wrap`, never the page.

## T8 — Scores date picker

`dateBarHTML` at `nba/index.html:828` and `wireDatePicker` at `:839`.

- A native `<input type="date" id="datePick">` sits between the day label and Today, with the
  current day pre-filled (`YYYY-MM-DD`).
- `change` validates the value and sets `#scores/YYYYMMDD`. Today and prev/next are unchanged.
- At ≤480 px the date bar wraps (`flex-wrap: wrap; row-gap: 6px`) so five controls never force
  sideways page scroll.

## T9 — Tests

Four tests added at `nba/nba.test.mjs:226`, `:236`, `:251`, `:262`:

- `search-maxey.json` → exactly one NBA result (the fixture's other four items are college
  football and NFL), first is `4431678` / Tyrese Maxey / PHI with a headshot.
- `leaders-points.json` + `('offensive', 'avgPoints')` → 10 rows, ranks `1..10`, numeric
  values, non-empty id/name/team, values sorted descending.
- gamelog → `seasons` has at least one entry, the Regular Season block carries numeric
  `stats.PTS` per game, and top-level `games` deep-equals that block's games.
- `parseLeaders({})` and `parseSearch({})` → `[]`.

```
$ node --test nba/nba.test.mjs
# tests 18
# pass 18
# fail 0
```

## T10 — Self-review

Every done command from packet 3's T9 and this packet's T9, re-run after the last edit:

```
$ node --test nba/nba.test.mjs
# tests 18
# pass 18
# fail 0

$ grep -cE "pickcenter|againstTheSpread|odds|predictor|winprobability|rotowire|fantasy" nba/index.html nba/nba.js
nba/index.html:0
nba/nba.js:0

$ grep -c "Matchup Board" nba/index.html
3
$ grep -c 'href="#compare' nba/index.html
3
$ grep -c 'og:image' nba/index.html
3
$ grep -c 'rel="icon"' nba/index.html
1

$ xmllint --noout sitemap.xml og-image.svg favicon.svg
$ echo $?
0

$ node -e "const h=require('fs').readFileSync('nba/index.html','utf8');for(const m of h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)){try{new Function(m[1].replace(/^\s*import[^;]+;/gm,''))}catch(e){console.error(e.message);process.exit(1)}}console.log('ok')"
ok

$ node check_html_scripts.mjs
HTML script syntax OK (2 inline blocks)
$ echo $?
0
```

Escaping: every new `innerHTML` value goes through `esc()` — leader rank/name/team/value/GP/
headshot/id/board label, search id/name/team/headshot, series abbrs and scores, standings
PPG/OPP/DIFF, season-tab names, game-log labels/values, live note (static), and the date
input's pre-filled value. The only unescaped interpolations are numbers this file computes
(`esc(oneDecimal(...))` is still applied) and constant markup. **No unescaped API string was
found, so nothing needed fixing.**

Timers — every `setTimeout` / `setInterval` in `nba/index.html`, with what clears it:

| Timer | Set at | What clears it |
|---|---|---|
| `pollTimer` | `:862` (refresh-error path), `:881` (a scores day with a live game) | `stopPolling()` at `:727`, which every view calls first and `router()` calls on every hash change |
| `gameTimer` | `:1571` (`armGamePoll`, live box after render or failed refresh) | `stopPolling()` at `:731`, i.e. every view change; not re-armed once the game is no longer `in` |
| `searchTimer` | `:1314` (250 ms debounce) | `closeSearch()` at `:1253` (Escape, toggle, picking a result) and the next keystroke at `:1307` |

There is no `setInterval`. Only the scores view and a live game page re-arm; compare, leaders,
pre-game, team and player pages leave nothing running.

Phone-width reasoning (structural, no browser per the budget): the header collapses to a `⌕`
toggle that expands the field across the row, so brand + switch never overflow; leader rows use
`minmax(0,1fr)` with the GP column hidden ≤560 px; standings scroll inside `.table-wrap`; the
date bar wraps ≤480 px; series rows reuse the shipped `.sched-row` grid; season tabs reuse
`.tabs-row`, which already scrolls as a row of small buttons.

Extra verification beyond the packet list (no browser, committed fixtures, harness in `/tmp`,
not committed): the real page module script run against a stubbed DOM passed 24 assertions —
scores cards and the native date input, standings with PPG/OPP/DIFF and signed diffs
(`+7.0 +3.0 +43.0 …`), six leader boards with 60 ranked rows and 60 player links all painted
from six parallel fetches, the compare pickers/table, the pre-game page with "Upcoming" series
rows, a final box score with no live note, the player page with ≥2 season tabs and one visible
panel, the team page compare link, and scores still working after navigation.

`STATE.md` — the 2026-10-30 section gained a "### NBA depth, same day" block covering the
leaders board, search, live polling, season split, team cache, series/standings/date changes
and the 18-test suite.

---

## Known gaps

- No live-game fixture exists, so the 30 s refetch is verified structurally (timer armed only
  for `state === 'in'`, cleared by every view, re-armed on error) and by checking that finals
  show no live note. An actual in-progress refresh was not observed.
- No browser or 375 px visual run; the phone notes are reasoning, not screenshots.
- The 3PM board shows `avgThreePointFieldGoalsMade` — a **per-game average**, not a season
  total. The label says 3PM; if a season total is wanted the query needs the non-average stat.
- The search dropdown has no loading affordance between a keystroke and the response; it simply
  appears.
- Search does not filter by position or team, and it only searches ESPN's player type — team
  or venue queries return nothing.
- Opening the phone search hides the brand/switch while open (visibility), so they are
  present but unclickable until the search closes.
- `teamData` cache entries are never pruned; with 30 teams that is bounded, and a stale entry
  simply expires on next read.
- Leaders boards are all averages rounded to one decimal, so a tie in value shows identically
  but still takes the next rank.
