# PACKET-2026-10-30-4: NBA depth (leaders, search, live box, gap fixes)
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: freebuff, same session as PACKET-2026-10-30-3. Fill the remaining time: do every task
in order, then T10. Don't stop to suggest follow-ups.

Claude is reviewing packet 3 in parallel and will NOT edit `nba/` while you work. Only touch the
files named below.

## Data (keyless, `access-control-allow-origin: *`, checked 2026-10-30)

| Endpoint | Fixture in nba/fixtures/ |
|---|---|
| `https://site.web.api.espn.com/apis/common/v3/search?query=<q>&limit=10&type=player` | search-maxey.json |
| `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?limit=50&category=<cat>&sort=<cat>.<stat>:desc` | leaders-points.json (`category=offensive&sort=offensive.avgPoints:desc`) |

Shape notes:
- Search: `items[]` with `id`, `displayName`, `league`, `sport`, and team/headshot fields. It returns
  every sport (college football, NFL...). Keep only `league === 'nba'`.
- Leaders: top-level `categories[]` (`general`, `offensive`, `defensive`) each with `names[]` /
  `displayNames[]`; every `athletes[i].categories[j].totals[]` is aligned to the top-level
  category with the same `name`. Read values by stat name, never by fixed index.
  `athletes[i].athlete` has `id`, `displayName`, `teamShortName` / team info, `headshot`.

## Tasks

T1. Leaders view `#leaders` in `nba/index.html`, with parser `parseLeaders(json, category, stat)`
in `nba/nba.js` → `[{ rank, id, name, teamAbbr, headshot, value, gp }]`.
- Board of top 10 for: Points (`offensive.avgPoints`), Rebounds (`general.avgRebounds`),
  Assists (`offensive.avgAssists`), Steals (`defensive.avgSteals`), Blocks (`defensive.avgBlocks`),
  3PM (`offensive.avgThreePointFieldGoalsMade`). Check each stat name exists in the fixture's
  `names` first; if one doesn't, pick the closest real name and say so in the walkthrough.
- One fetch per board, in parallel; each board renders on its own as it arrives. Cache results
  in memory for the page session.
- Names link to `#player/<id>`. Add a `Leaders` tab to the NBA nav.

T2. Player search. A search box in the NBA header (icon button that expands on phones).
`parseSearch(json)` in `nba/nba.js` → NBA players only `[{ id, name, teamAbbr, headshot }]`.
- Debounce 250ms, min 2 characters, abort the previous request (`AbortController`), show up to 8
  results in a dropdown; Enter or click goes to `#player/<id>`; Escape closes it.
- Keyboard: arrow keys move through results. The dropdown has `role="listbox"` and options
  `role="option"` with `aria-selected`.

T3. Live game page. In `showGame`, when the game state is `in`, refetch the summary every 30s and
re-render in place (no loading flash), the same way the scores view polls. Stop when the game
goes final or the hash changes. Show a small "Live · updates every 30s" note under the header.

T4. Game log by season type. `parseGameLog` currently mixes preseason into regular season.
Return `{ labels, seasons: [{ name, games: [...] }] }` keyed by the `seasonTypes[].displayName`,
newest first, and keep a top-level `games` that is the Regular Season list (so existing callers
still work). The player page shows Regular Season by default with a small toggle for the other types.

T5. Team data cache. Cache each team's statistics and schedule in memory for 5 minutes, keyed by
team id, shared by compare, pre-game and team views. One helper, not three.

T6. Season series rows: bold the winner's abbreviation and score, mute the loser's, same as
the score cards.

T7. Standings: add PPG, OPP and DIFF columns (already parsed as `ppg` / `oppPpg`). DIFF shows a
sign (`+4.2`, `-1.0`), positive green-free (use the gold accent for positive, muted for negative;
no new colors).

T8. Scores date picker: add a native `<input type="date">` to the date bar (between prev and next)
that jumps to `#scores/YYYYMMDD`. Keep Today.

T9. Tests in `nba/nba.test.mjs` (add, don't rewrite):
- search-maxey: only NBA results, first is Tyrese Maxey with id `4431678`.
- leaders-points: Points board has 10 rows, ranks 1-10, values are numbers sorted descending.
- gamelog: `seasons` has at least one entry, Regular Season games carry `stats.PTS`, top-level
  `games` equals the Regular Season list.
- `parseLeaders({})` and `parseSearch({})` return `[]`.
- Done: `node --test nba/nba.test.mjs` passes, 0 failures, at least 18 tests.

T10. Self-review and docs.
- Re-run every done command from packet 3's T9 plus this packet's T9, paste outputs.
- Banned-content grep from packet 3 T9 still prints 0 for both files.
- Every new `innerHTML` value goes through `esc()`.
- Timers: list every `setTimeout` / `setInterval` in `nba/index.html` and say what clears each one.
- Inline-script syntax check and `node check_html_scripts.mjs` still pass.
- Append to the 2026-10-30 section of `STATE.md`.

## Hard rules
- Do NOT run git commands except read-only `git diff --stat` / `git status --short`.
- Do NOT add dependencies or external scripts.
- Only edit `nba/index.html`, `nba/nba.js`, `nba/nba.test.mjs`, `STATE.md`, and your walkthrough files.
- BUDGET: static edits only. No dev server, no browser, no builds, no live fetches.

## Required output
`delegation/PACKET-2026-10-30-4-walkthrough.md`: per task, file:line, what changed, done-command
outputs, SKIPPED with a reason where needed, and a "Known gaps" section. No suggested follow-ups
list. Draw what changed with reladraw as `delegation/PACKET-2026-10-30-4-changes.reladraw` + `.svg`.

## Excluded (orchestrator-side)
- Browser checks, live ESPN data, og-image.png, commit and push.
