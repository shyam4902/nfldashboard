# PACKET-2026-10-30-5 walkthrough — NBA polish

Executor: freebuff. Date: 2026-10-30. Packet: [PACKET-2026-10-30-5-nba-polish.md](./PACKET-2026-10-30-5-nba-polish.md).
Change diagram: [PACKET-2026-10-30-5-changes.svg](./PACKET-2026-10-30-5-changes.svg)
(source: [.reladraw](./PACKET-2026-10-30-5-changes.reladraw), rendered with
`reladraw delegation/PACKET-2026-10-30-5-changes.reladraw -o delegation/PACKET-2026-10-30-5-changes.svg --theme dark`).

Status: T1–T6 implemented. Nothing skipped. Only `nba/index.html`, `nba/nba.js`,
`nba/nba.test.mjs`, `STATE.md` and the walkthrough files were touched. No git command beyond
read-only `git diff --stat` / `git status --short`. No browser, build, live fetch or install.

| File | Tasks | Change |
|---|---|---|
| `nba/nba.js` | T1 | `pointsLeader` + `leaders` on scoreboard games |
| `nba/index.html` | T1–T5 | card leader lines, phone search fixes, leader avatars + 3PM label, team stats card, player-vs-player |
| `nba/nba.test.mjs` | T1/T6 | one test (19 total) |
| `STATE.md` | T6 | one line appended to the 2026-10-30 section |
| `delegation/PACKET-2026-10-30-5-*` | output | walkthrough + diagram |

---

## T1 — Top performer on score cards

**Parser** `nba/nba.js:81` `pointsLeader(competitor)`, used by `parseScoreboard` at `:90`
(assignment at `:129`).

- The fixture carries leaders on **`competitions[0].competitors[].leaders`**, not on the
  competition: each competitor has a `leaders[]` of categories (`points`, `rebounds`, …),
  each with `leaders[0].athlete` and `displayValue`. The parser takes the `points` category
  and returns `{ name, line }` with `line` = `"32 PTS"`.
- Games gain `leaders: { away, home } | null` — `null` only when neither side has a points
  leader, so the card can skip the line entirely.
- `homeCardHTML` side: `leaderLineHTML(game, side)` at `nba/index.html:876`, called from
  `gameCardHTML` at `:883` right under each team row. It returns nothing for `pre` games, so
  upcoming cards are unchanged. One small muted line per team, abbr-aligned (32 px inset),
  ellipsized.

Test (`nba/nba.test.mjs:43`): both games in `scoreboard-20261022.json` have `leaders.away`
and `leaders.home` with non-empty names and a line ending in `PTS`.

```
$ node --test nba/nba.test.mjs
# tests 19
# pass 19
# fail 0
```

## T2 — Phone search fixes

`nba/index.html:1454-1462` (outside tap), `runSearch` `:1388`, `paintSearchMessage` `:1333`.

- **Switch stays reachable.** The phone overlay no longer sits over the header bar: at
  ≤560 px `.nba-search.open` is `top: 100%`, full width, with its own padding and bottom
  border, so the brand and the `NFL | NBA` switch above it stay visible and clickable. The
  old `visibility: hidden` rule and the `search-open` class are gone.
- **Outside tap closes.** `initSearch` registers a document click listener that calls
  `closeSearch()` unless the tap is inside `#nbaSearch`. The toggle's own click is inside, so
  it still toggles.
- **Searching… / no results.** `runSearch` paints `Searching…` via `paintSearchMessage`
  before the request; an empty parse still paints `No NBA players found`. The player-picker
  search (T5) paints `Searching…` immediately on input for the same reason.
- The header phone rules are now scoped to `.nba-header .search-input`, so the T5 picker
  inputs are not hidden on phones (the media query previously hid every `.search-input`).

## T3 — Leaders polish

`nba/index.html:1242` (label), `:1246` `initialsOf`, `:1253` `avatarHTML`, rows use it in
`leaderRowHTML`.

- 3PM board is labelled `3PM per game` — it reads `avgThreePointFieldGoalsMade`, a per-game
  average, so the label now matches the data.
- Headshots are fixed-size (`width="26" height="26"`), `loading="lazy"` and
  `decoding="async"`. The image is absolutely positioned over a neutral circle holding the
  player's initials, and `onerror="this.remove()"` drops a broken image to that circle. The
  26 px box exists either way, so nothing reflows.

## T4 — Team page stats card

`nba/index.html:1924` `teamStatsHTML(bundle)`, rendered above the Schedule/Roster tabs from
`showTeam` at `:1942`.

- `showTeam` now loads `teamBundle(id)` (standings row + `teamData` cache) in parallel with
  the roster, so PPG / Opp PPG / Diff / FG% / 3P% / REB / AST / TOV come from the same 5-minute
  cache and `parseTeamStats` — no new endpoints, no extra fetches.
- Eight compact cells in a 4-column grid (2 rows on phones), positive Diff gold like the
  standings column, everything else neutral.

## T5 — Player vs player `#players/<idA>/<idB>`

`nba/index.html:1564` rows, `:1577` pickers, `:1586` head, `:1596` search binding,
`:1695` `showPlayers`, compare entry at `:1555`, router at `:2011`.

- Reuses the packet-3 renderer: `compareTableHTML(left, right, rowSet)` now takes an optional
  row set, and the player table passes `PLAYER_COMPARE_ROWS` — PTS, REB, AST, STL, BLK, TO
  (lower wins), FG%, 3P%, FT%, MIN, read from `parsePlayerOverview(...).season`. Gold marks
  the better value, ties highlight neither.
- Two picker fields use the **same** search component: `searchPlayers()` (one request path),
  `searchOptionHTML()` (one result markup with an id prefix), and `bindPlayerSearch()` (the
  same 250 ms debounce, `AbortController`, arrow keys, Enter, Escape, `Searching…` and
  `No NBA players found` states).
- Header shows both players' avatars (initials fallback), names, teams, and links to their
  player pages.
- Entry point: a `Compare` link on the player page header, `#players/<id>` (prefills player A;
  the second field completes the comparison). Picking either field rewrites the hash, so
  partial selections survive a re-render.
- No new automated test was required. Checked with the stubbed-DOM run below: bare `#players`
  paints two fields and two listboxes; `#players/4431678/1966` paints the compare head with
  both names and a 10-row table.

## T6 — Self-review

```
$ node --test nba/nba.test.mjs
# tests 19
# pass 19
# fail 0

$ node check_html_scripts.mjs
HTML script syntax OK (2 inline blocks)
$ echo $?
0

$ grep -cE "pickcenter|againstTheSpread|odds|predictor|winprobability|rotowire|fantasy" nba/index.html nba/nba.js
nba/index.html:0
nba/nba.js:0

$ node -e "…inline-script syntax check (packet 3 T9 command)…"
ok
```

Escaping: every new `innerHTML` value goes through `esc()` — leader `name`/`line`, avatar
src/initials, search option id/name/team/headshot, `Searching…` / `No NBA players found`
(constants, escaped anyway), team-stats labels and values, player-compare names, team abbrs,
stat labels and values. `parseScoreboard` writes `line` from `displayValue` as a string, and
the card escapes it. **No unescaped API string found.**

`STATE.md`: one line added at the end of the 2026-10-30 section ("Polish pass … 19 tests").

Extra verification (no browser, committed fixtures, harness in `/tmp`, not committed): the
real page module script against a stubbed DOM passed **35 assertions**, including the new
score-card leader line (`<b>32 PTS</b>`), the `3PM per game` heading, 60 initials avatars with
fixed sizes and `decoding="async"`, the team season-stats card with 8 cells, the player page
`#players/` link, and the `#players/<a>/<b>` compare head plus 10-row table.

---

## Known gaps

- Score cards show only the points leader (one line, as specified); rebounds or assists would
  need another parser field.
- `parseScoreboard.leaders` bakes the `PTS` suffix into `line`, so the parser is points-specific.
- Player pickers do not prefill the chosen player's name — the hash holds the id and the
  comparison below shows who was picked, but the input text is empty after a re-render.
- The player-picker debounce timer is cleared on the next keystroke or Escape, not on a hash
  change; a pending 250 ms callback can still fire after navigation and write into detached
  nodes. `stopPolling` does not know about it.
- The phone search overlay opens below the whole header, so its dropdown can sit under the
  on-screen keyboard; not measured without a browser.
- No 375 px or desktop visual pass, and no live ESPN data, per the packet budget.
