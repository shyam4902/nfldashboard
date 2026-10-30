# PACKET-2026-10-30-3 walkthrough — Matchup Board rebrand + NBA matchups

Executor: freebuff. Date: 2026-10-30. Packet: [PACKET-2026-10-30-3-matchup-board.md](./PACKET-2026-10-30-3-matchup-board.md).
Change diagram: [PACKET-2026-10-30-3-changes.svg](./PACKET-2026-10-30-3-changes.svg)
(source: [.reladraw](./PACKET-2026-10-30-3-changes.reladraw), rendered with
`reladraw delegation/PACKET-2026-10-30-3-changes.reladraw -o delegation/PACKET-2026-10-30-3-changes.svg --theme dark`).

Status: T1–T8 implemented, T9 self-review below. Nothing skipped. No git command was run
except the read-only `git diff --stat` the packet allows and one read-only `git status --short`
to confirm the changed-file set (no commit, push, branch, or anything that writes). No dev
server, browser, build, live fetch, or package install.

Files touched:

| File | Task | Change |
|---|---|---|
| `index.html` | T1, T3 | head tags + header brand and sport switch; one nav link removed |
| `nba/index.html` | T2, T3, T6–T8 | brand, Compare tab, three new views, styles |
| `nba/nba.js` | T4 | five parsers + standings `ppg` / `oppPpg` |
| `nba/nba.test.mjs` | T5 | seven tests added (14 total) |
| `favicon.svg`, `og-image.svg`, `robots.txt`, `sitemap.xml` | T3 | new at repo root |
| `STATE.md` | T9 | dated 2026-10-30 section at the top |
| `delegation/PACKET-2026-10-30-3-walkthrough.md` (this file), `-changes.reladraw`, `-changes.svg` | output | done |

No fixtures, `_redirects`, `_headers`, JSON data, or `data/` files were touched.

---

## T1 — NFL page brand and head tags (`index.html`)

Only the head and the header brand block changed. `index.html:6` title,
`:7` meta description, a small `<style>` at `:1878-1883`, the social/icon tags at
`:1884-1893`, and the brand block at `:1899-1910`.

- Title: `Matchup Board · NFL scores, matchups and stats`; the description names Matchup
  Board too.
- Brand: `NFL` / `2026` / `Pro Hub` replaced by `<span class="hdr-brand-mark">Matchup</span>`
  (gold, existing class) + `<span class="hdr-brand-year">Board</span>` (white, existing
  class) — no new wordmark CSS.
- One sport switch, placed in the brand row: `NFL` → `/` with `aria-current="page"`, `NBA`
  → `/nba/`. The old `<a href="/nba/" class="tab-btn">NBA</a>` was removed from the nav.
- The switch reuses `.tab-btn` for shape and gets a 2-rule `.hdr-sport` block
  (`index.html:1881`) for layout and the `aria-current='page'` fill. It is driven by
  `aria-current`, not `.active`, because `showTab()` sweeps `.active` off every `.tab-btn`
  on each tab click (`index.html:6831`-ish area) and would otherwise unpaint the switch.
- `hdr-season` text kept, now after the switch.

```
$ grep -c "Matchup Board" index.html
3
$ grep -c 'href="/nba/"' index.html
1
$ node check_html_scripts.mjs
HTML script syntax OK (2 inline blocks)
$ echo $?
0
$ git diff --stat index.html
 index.html | 25 +++++++++++++++++++++----
 1 file changed, 21 insertions(+), 4 deletions(-)
```

25 changed lines, under the 40-line cap. The tree had no uncommitted changes in
`index.html` before this packet, so this diff is exactly the packet's edit (at
PACKET-2026-10-23-1 time the same check reported 470 pre-existing lines).

## T2 — NBA page brand, title, Compare tab (`nba/index.html`)

- `nba/index.html:6` title `Matchup Board · NBA scores, matchups and stats` and a new
  description (the old one named a generic scores site).
- Brand at `:552-554`: `Matchup` gold + `Board` white using `.brand-mark` / `.brand-name`.
  `.brand-name` moved from `700 15px` to `800 19px` so the two words read as one wordmark;
  the existing NBA | NFL switch below it is unchanged and still marks NBA current.
- Tabs at `:562-564`: Scores, Standings, **Compare** (`href="#compare"`,
  `data-nav="compare"` so `markNav` highlights it).

```
$ grep -c "Matchup Board" nba/index.html
3
$ grep -c 'href="#compare' nba/index.html
3
```

The three `#compare` references are the tab, the team-page header link and the pre-game
"Full comparison" link.

## T3 — Domain files and head tags

New at the repo root:

- `favicon.svg` — 64×64 viewBox, rounded charcoal `#101215` square, gold `#d9a441` `MB`
  monogram plus a thin gold rule. System fonts only.
- `og-image.svg` — 1200×630 charcoal card, two-tone `Matchup Board` wordmark,
  "NFL and NBA scores, matchups and stats", `matchupboard.com`. Helvetica/Arial only, no
  external references.
- `robots.txt` — allow all, `Sitemap: https://matchupboard.com/sitemap.xml`.
- `sitemap.xml` — the two URLs.

Both pages got `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, canonical
(`https://matchupboard.com/` and `https://matchupboard.com/nba/`), `og:title`,
`og:description`, `og:url`, `og:type=website`, `og:image` (the `.png`, not the `.svg`),
`og:image:width=1200`, `og:image:height=630`, `twitter:card=summary_large_image`.

`_redirects` needed no change: the new files are assets that should stay public, and
nothing there matches `*.svg`, `robots.txt` or `sitemap.xml`.

```
$ grep -c 'og:image' index.html nba/index.html
index.html:3
nba/index.html:3
$ grep -c 'rel="icon"' index.html nba/index.html
index.html:1
nba/index.html:1
$ xmllint --noout sitemap.xml og-image.svg favicon.svg
$ echo $?
0
$ cat robots.txt
User-agent: *
Allow: /

Sitemap: https://matchupboard.com/sitemap.xml
```

Three `og:image` lines each = `og:image`, `og:image:width`, `og:image:height`.

## T4 — Parsers (`nba/nba.js`)

Pure, no DOM, same style as the existing parsers. Every read goes by stat `name` through
a flat category index; `{}` yields the empty shape.

| Export | Line | Notes |
|---|---|---|
| `parseTeamStats` | `nba/nba.js:317` | `flatStats()` over `results.stats.categories[]`; reads `gamesPlayed`, `fieldGoalPct`, `threePointPct`, `freeThrowPct`, `avgRebounds`, `avgAssists`, `avgTurnovers`, `avgSteals`, `avgBlocks`, `assistTurnoverRatio`. `ppg` stays `null` for the caller to fill from standings. |
| `parsePreGame` | `:386` | Away/home from `header.competitions[0].competitors` by `homeAway`; `seasonseries[].events[]` → season series; `lastFiveGames[*]`, `injuries[*]`, `leaders[]` keyed by team abbr. Reads only `header`, `gameInfo`, `lastFiveGames`, `seasonseries`, `injuries`, `leaders`. |
| `parseAthlete` | `:455` | id, name, jersey, pos, height, weight, age, headshot href, team `{id, abbr, name}`. |
| `parsePlayerOverview` | `:475` | `statistics.labels` plus `Regular Season` / `Career` splits mapped label → value. |
| `parseGameLog` | `:488` | `labels`, then `events` joined to `seasonTypes[].categories[].events[]` by `eventId`, sorted newest first. |
| `parseStandings` rows | `:176` | added `ppg` / `oppPpg` from `avgPointsFor` / `avgPointsAgainst`; nothing existing changed. |

Shared helpers added: `labelMap` (`:338`, numeric when numeric, string for composite
values like `8-18`), `seriesRow` (`:354`), `preGameSide`, `flatStats`.

Additive fields beyond the packet's listed shapes, all needed by the views and documented
here because they are not in the packet:

- `parsePreGame` also returns `broadcast` (from `header.competitions[0].broadcasts[].media.shortName`)
  and each season-series row carries `state` so the page can say "Upcoming" vs a final score.
- Each `lastFive` entry carries `atVs` so the row can render `vs MIA` / `@ BOS`.

```
$ node -e "import('./nba/nba.js').then(m=>console.log(Object.keys(m).sort().join(',')))"
etDate,parseAthlete,parseBoxScore,parseGameLog,parsePlayerOverview,parsePreGame,parseRoster,parseScoreboard,parseStandings,parseTeamSchedule,parseTeamStats
```

## T5 — Tests (`nba/nba.test.mjs`)

Seven tests added after the existing seven (`:134`, `:145`, `:156`, `:185`, `:196`, `:207`,
`:224`):

- `team-20-statistics.json`: `gamesPlayed` is a number > 0; `fgPct`, `threePct`, `reb`,
  `ast` are numbers; `ppg` is `null` until the caller fills it.
- `standings.json`: all 30 rows carry numeric `ppg` and `oppPpg`.
- `summary-401909903-pre.json`: away `BOS`, home `ORL`, id `401909903`, venue present,
  a non-empty series, `lastFive` for both abbrs with `W`/`L` results, and a recursive walk
  asserting no key named `odds`, `pickcenter`, `predictor` or `winprobability` anywhere in
  the parsed result.
- `athlete-4431678.json`: `Tyrese Maxey`, team `PHI` / `20`, headshot, numeric age.
- overview: `labels` includes `PTS`, `season.PTS` and `career.PTS` are numbers, and the
  season map has one entry per label.
- gamelog: at least 5 games, newest first, every game has numeric `stats.PTS` and an
  opponent abbr.
- all five new parsers return their empty result for `{}` (exact shapes asserted).

```
$ node --test nba/nba.test.mjs
# tests 14
# pass 14
# fail 0
```

## T6 — `#compare` (`nba/index.html`)

- Route: `#compare`, `#compare/<idA>`, `#compare/<idA>/<idB>` (`parseHash` now returns the
  full `args` list; router branch at `:1304`).
- Bare `#compare`: two `<select>`s with all 30 teams from standings plus a `⇄` swap button
  and a hint. Changing either select writes the hash; a partial hash keeps that team
  selected and paints the pickers again.
- Header (`compareHeadHTML` `:876` region): both logos, abbr, full name and record; names
  ellipsize, both sides link to `#team/<id>`.
- Table (`compareTableHTML`, `:876`; rows `:850`): Record, PPG, Opp PPG, Diff, FG%, 3P%,
  FT%, REB, AST, TOV, STL, BLK, AST/TO — team A value | label | team B value. The better
  value per row is gold and bold; `Opp PPG` and `TOV` are lower-is-better; equal values
  highlight neither.
- Below: a `Last 5` block per team from its parsed schedule, then `This season · head to
  head` — games present in both schedules, chronologically, each row linking to
  `#game/<id>`.
- Data: standings fetched once per page load and cached in module memory
  (`getStandings()` `:791`); then `teamBundle()` pulls both teams' statistics and
  schedules in parallel with `Promise.all`.

Entry points: the Compare tab, the `Compare` link in the team page header
(`:1271`, prefills team A), and the pre-game page's `Full comparison` link.

Verified with a stubbed DOM (see T9): bare picker has 2 selects and 62 options (30 + 30 +
2 placeholders), `#compare/20/19` paints 13 stat rows, at least one gold `better` cell,
two last-five blocks, a head-to-head block, and exactly one standings fetch.

## T7 — Pre-game matchup page

`showGame` now fetches the summary once, runs `parseBoxScore`, and branches
(`nba/index.html:1187`):

- box score teams present → `renderBoxScore(box)` — the live/final path is byte-for-byte
  the same markup as before.
- `state === 'pre'` and away/home parsed → `showPreGame` (`:1158`).
- otherwise the old "No box score for this game" state, unchanged.

The pre-game view renders: a header with both teams, records, tip-off in ET
(`formatWhen`), venue and broadcast; the **same** `compareTableHTML` used by T6 (no copy);
season series with dates, matchups and either a final score or "Upcoming"; each team's
last five from the payload; key injuries (name, position, status, detail); team leaders
(points / assists / rebounds); and `Full comparison →` to
`#compare/<awayId>/<homeId>`.

## T8 — `#player/<id>` (`nba/index.html`)

`showPlayer` (`:1032`) fetches the three athlete endpoints in parallel
(`W/athletes/<id>`, `/overview`, `/gamelog`).

- Header: headshot, name, `#jersey · pos · height · weight · age`, and a team link to
  `#team/<id>` (all through `esc`).
- Averages table: `Season` and `Career` rows with columns straight from `labels`.
- Game log: sticky first column (date), then opponent with `@`/`vs`, result + score, then
  every stat label; the table sits in the standard `overflow-x` wrapper and is 520px wide,
  so it scrolls sideways on phones like the box score.
- Loading and error states are the shared `loadingHTML()` / `showError()` with a retry that
  re-runs the same route.
- Entry points: `playerNameHTML` (`:1078`) wraps box-score starters/bench and DNP names in
  `#player/<id>` links, and roster rows (`:1239`) link names the same way.

## T9 — Self-review

Every done command from T1–T8 was re-run after the last edit; outputs are the ones inlined
above and below.

Banned content:

```
$ grep -cE "pickcenter|againstTheSpread|odds|predictor|winprobability|rotowire|fantasy" nba/index.html nba/nba.js
nba/index.html:0
nba/nba.js:0
```

The first draft of `parsePreGame` fell back to `details.fantasyStatus.description` for the
injury detail and that check caught it; the fallback was removed, so the detail now comes
from `details.type.description` / `details.detail` only.

Escaping: every API-derived string is interpolated through `esc()` in the new code — team
names/abbrs/logos, opponent abbrs, result and score strings, injury names/status/detail,
leader names/values, athlete name/headshot/team name, game-log values, stat labels and
formatted dates. `esc` is also applied to the composed strings (`esc(formatWhen(...))`,
`esc(game.away + ' @ ' + game.home)`, `esc((game.atVs ? game.atVs + ' ' : '') + game.opponentAbbr)`).
**No unescaped API string was found, so nothing needed fixing.**

Timers: `stopPolling()` is the first statement of every view, `markNav`/router do not
schedule anything, and only `showScores` re-arms `pollTimer` (30 s, and only while a game
is live on the scores route). Compare, pre-game and player leave no timer behind after a
hash change.

Inline-script syntax:

```
$ node -e "const h=require('fs').readFileSync('nba/index.html','utf8');for(const m of h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)){try{new Function(m[1].replace(/^\s*import[^;]+;/gm,''))}catch(e){console.error(e.message);process.exit(1)}}console.log('ok')"
ok
```

Phone width, 375px, reasoned per view (no browser, per the packet's budget):

- **Compare** — the picker grid is `minmax(0,1fr) auto minmax(0,1fr)` with
  `width:100%; min-width:0` selects, so it compresses instead of overflowing. Head and
  table use the same `minmax(0,1fr)` columns; names ellipsize, values are 2–4 characters.
  Last-five and head-to-head rows reuse the existing `.sched-row` that already ships at
  phone width on the team page.
- **Pre-game** — the flat compare head is the same grid; the tip-off line wraps
  (`mu-when`). Series/last-five rows reuse `.sched-row`. **Change made here:** upcoming
  series games render the word `Upcoming` rather than a second full
  `Sun, Nov 1, 3:30 PM ET` timestamp, because the date column already carries the date and
  two long timestamps in one 3-column row is what squeezes at 375px.
- **Player** — header is 64px image + wrapping meta (`overflow-wrap:anywhere`); the
  averages and game-log tables are 520px inside `.table-wrap { overflow-x:auto }` with a
  sticky first column, so the page itself does not scroll sideways.

`STATE.md` has a new dated section at the top, in the style of the 2026-10-23 entry.

Extra verification beyond the packet's list (no browser, committed fixtures, harness in
`/tmp`, not committed): the real `nba/index.html` module script was executed against a
stubbed `document` / `window` / `location` / `fetch`, with fixtures served per URL. All 23
assertions passed — scores still paint cards, bare compare paints 2 pickers / 62 options,
`#compare/20/19` paints 13 rows with gold winners, 2 last-five blocks, head-to-head and a
single standings fetch; `#game/401909903` renders the pre-game matchup with venue,
broadcast, the shared compare table, series, last five, injuries, leaders and
`href="#compare/2/19"`; `#game/401909093` still renders the box score with
`#player/` links; `#player/4431678` renders header, averages, game log and made exactly
three athlete fetches; `#team/20` shows the Compare link and player-linked roster;
`#standings` still works.

---

## Known gaps

- `og-image.png` is not rendered here (orchestrator-side, by design); the tags already point
  at it, so the card is broken until that file exists at the root.
- No browser or 375px visual run in this packet, so the phone reasoning above is structural,
  not observed.
- Head-to-head finds only games that appear in *both* schedule payloads. If ESPN's team
  schedule omits a game on one side, that matchup will not be listed.
- Team bundles are not cached; moving between `#compare` and a pre-game page refetches both
  teams' statistics and schedules (only standings are cached).
- `#compare/<id>` with a single team shows the pickers and a hint rather than a partial
  one-team comparison.
- The player game log joins every `seasonTypes` category by event id, so preseason games sit
  in the same table as regular-season games with no filter.
- Game-log dates are formatted in UTC deliberately: ESPN sends `gameDate` at `00:00Z`, and
  ET formatting would show the previous day for every game.
- Series rows show the final score as `away-home` without a winner marker; the result is
  readable but not colour-coded like a team schedule row.
