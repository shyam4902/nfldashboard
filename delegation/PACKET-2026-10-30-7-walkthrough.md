# PACKET-2026-10-30-7 walkthrough — NBA finish pass

executor: freebuff. Date: 2026-10-30. Packet: [PACKET-2026-10-30-7-nba-finish.md](./PACKET-2026-10-30-7-nba-finish.md).
Change diagram: [PACKET-2026-10-30-7-changes.svg](./PACKET-2026-10-30-7-changes.svg)

Scope held to the hard rule: `index.html`, `nfl/`, `sitemap.xml` and the packet-6 test files were not touched. `git status --short` for tracked files shows only `STATE.md`, `nba/index.html`, `nba/nba.js`, `nba/nba.test.mjs`; `404.html` is the one new file.

```
 STATE.md         |   1 +
 nba/index.html   | 242 ++++++++++++++++++++++++++++++++++++++++++++++---------
 nba/nba.js       |  37 ++++++++-
 nba/nba.test.mjs |  32 ++++++++
 4 files changed, 274 insertions(+), 38 deletions(-)
```

## T1 — Smaller images

**`nba/nba.js:16-28` — `smallImg(url, w, h)`.** Rewrites `https://a.espncdn.com/<path>` to `https://a.espncdn.com/combiner/i?img=<path>&w=<w>&h=<h>`, which is the resizer the packet measured (207KB headshot → ~8KB, 37KB logo → ~2KB). Returns the URL unchanged when it is empty, when it is not an `a.espncdn.com` URL, when `w`/`h` are missing, or when the URL already goes through `/combiner`. `w`/`h` are the 2x sizes of the rendered box.

Every `<img>` in the page now goes through it, with explicit `width`/`height` and `decoding="async"`:

| `nba/index.html` line | Image | Displayed | Requested |
|---|---|---|---|
| 957 | score-card logo | 22 | 44 |
| 1054 | standings logo | 18 | 36 |
| 1249 | compare head logo | 34 | 68 |
| 1377 | leader / player-compare avatar | 26 | 52 |
| 1444 | search result headshot | 24 | 48 |
| 1675 | player page headshot | 64 | 128 |
| 1902 | box-score title logo | 22 | 44 |
| 2057 | game header logo | 34 | 68 |
| 2073 | team schedule opponent logo | 18 | 36 |
| 2133 | team page logo | 52 | 104 |

`loading="lazy"` on nine of the ten. The one exception is the score-card logo (957): those cards are the first screen of the scores view, which the packet excludes.

`nba.test.mjs:109` — `smallImg` test: rewards a real headshot URL to the exact combiner string, keeps `https://example.com/logo.png`, returns `''` for `''`, and does not double-wrap an existing `/combiner` URL.

## T2 — Date bar at 375px

`nba/index.html:702-721` replaces the old `@media (max-width: 480px) { .date-bar { flex-wrap: wrap; … } }`, which is what pushed the next arrow onto a second line.

- `flex-wrap: nowrap`, tighter gap and padding, so prev / date / next / Today are one row.
- The date input becomes a 36px calendar button: fixed `width`/`min-width`/`max-width`, `padding: 7px 0`, `overflow: hidden`, `::-webkit-datetime-edit { display: none }` and a centred `::-webkit-calendar-picker-indicator`. Tapping it still opens the native picker, so choosing any date is unchanged.
- The day label takes the free space (`flex: 1 1 auto; min-width: 0`) and ellipsizes; the raw `YYYYMMDD` sub-line is hidden at this width.
- Nothing overflows sideways: `body { overflow-x: hidden }` was already there, and the row can no longer wrap.

## T3 — Packet 5 gaps

**(a) Pickers keep the chosen names.** `nba/index.html:1706` — `playerPickerHTML(nameA, nameB)` writes a `value="…"` (through `esc`) onto each field. `nba/index.html:1863` re-renders with `playerPickerHTML(left.athlete.name, right.athlete.name)` once both players are loaded, so the post-fetch paint no longer blanks the inputs. The one-player-picked state still renders empty fields — there is no fetched name to restore there.

**(b) Picker debounce cleared on hash change.** `nba/index.html:850` adds `pickerClosers`; `881-884` runs every closer from `stopPolling()`, which is the first statement of every view and therefore runs on every hash change; `1810` registers each `bindPlayerSearch` field's own `close` (which clears its timer and aborts its request). A pending callback can no longer paint into a node a re-render already replaced.

## T4 — Per-view titles

`nba/index.html:858-863` — `setTitle(text)` appends ` · Matchup Board`, skips no-op writes, and leaves the default title in place until a view's data is ready. `nba/index.html:865` — `lastName()`, which drops a trailing `Jr.`/`Sr.`/`II`–`V` suffix so the player-compare title reads like the packet's `Maxey vs Tatum`.

| View | Title | Set at |
|---|---|---|
| Scores | `NBA Scores · Thu, Oct 22 · Matchup Board` | `showScores`, before the cards paint |
| Game (box or live) | `CLE vs PHI · Matchup Board` | `renderBoxScore` |
| Game (pre-tip) | `BOS vs ORL · Matchup Board` | `showPreGame` |
| Player | `Tyrese Maxey · Matchup Board` | `showPlayer` |
| Team compare | `PHI vs CLE · Compare · Matchup Board` | `showCompare` |
| Player compare | `Maxey vs Tatum · Matchup Board` | `showPlayers` |
| Standings | `NBA Standings · Matchup Board` | `showStandings` |
| Leaders | `NBA Leaders · Matchup Board` | `showLeaders` |
| Team | `Philadelphia 76ers · Matchup Board` | `showTeam` |

## T5 — Final-game team stats

- `nba/nba.js:30-38` — `shotPct("39-87")` → `44.83…`, `null` for an empty or `0-0` line.
- `nba/nba.js:306-310` — `parseBoxScore` now gives each team `shooting: { fg, three, ft }`, computed from `totals.FG` / `totals['3PT']` / `totals.FT`, because the payload's totals carry no percentage field.
- `nba/index.html:2034-2046` — `BOX_ROWS`: FG, FG%, 3PT, 3P%, FT, FT%, REB, AST, TOV (`lower: true`), STL, BLK. The made-attempted line is the visible value; the percentage drives the gold highlight.
- `nba/index.html:2048` — `boxCompareHTML(box)` renders it through the packet-3 `compareTableHTML` with the caption `CLE vs PHI · game stats`.
- `nba/index.html:2055+` — `renderBoxScore` puts it between the line score (`.game-head`) and the two box tables. It therefore appears for `post` and `in` games and never on a pre-tip page.

Test `nba.test.mjs:121` reads `summary-401909093.json`, and for both teams compares `shooting.fg` against `made / attempted` from the team's own `totals.FG`, rounded to one decimal; it also pins CLE at 44.8 and checks `shotPct` on `''`, `0-0` and `1-2`.

## T6 — Accessibility

| `nba/index.html` | Change |
|---|---|
| 152-162 | `.sr-only` helper |
| 163-175 | `.skip-link`, hidden until focused |
| 176-179 | one gold `:focus-visible` ring on `a`/`button`/`select`/`input` |
| 786 | `<a class="skip-link" href="#app">Skip to content</a>` as the first thing in `<body>` |
| 814 | `<div id="app" tabindex="-1">` so the skip link actually moves focus |
| 1263 | `aria-label="Swap teams"` on the ⇄ icon button (it had only `title`) |
| 1073, 1243, 1600, 1615, 1904 | `<caption class="sr-only">` on all five table kinds: standings, compare, averages, game log, box score |

Also in this pass: the `.search-input:focus { outline: none }` rule was dropped (it would have defeated the gold ring for keyboard users; the border change stays), headshots now carry the player's name as `alt` (avatar 1377, search result 1444, player page 1675) while team logos stay `alt=""` because the abbreviation or name is already adjacent, the sport switch keeps `aria-current="page"`, and the tab strip is marked by the existing `markNav()` `aria-current` writer. The new standings Conference/League switch marks its own current item.

## T7 — Standings: Conference / League

- `nba/index.html:1184` — `pointDiff(row)`; `1189` — `byLeague(a, b)`: win percentage descending, then point differential descending, then name.
- `nba/index.html:1050-1077` — `standingsTableHTML(title, rows, options)` grew a `league` mode: no play-in cut lines, and the `#` column runs 1..30 instead of repeating the conference seed.
- `nba/index.html:1079+` — `showStandings(mode)` paints `<nav class="standings-switch">` with `Conference` → `#standings` and `League` → `#standings/league`, `aria-current` on the active one, then either the two conference tables or one `League · all 30 teams` table.
- `nba/index.html:2169+` — the router passes `route.args[0]`, so `#standings/league` deep-links and survives reload.

## T8 — `404.html`

New file at the repo root: Matchup Board wordmark, “That page doesn't exist”, one-line explanation, and two cards linking `/nfl/` and `/nba/`. Same palette tokens, Geist/Archivo fonts and `/favicon.svg` as `nba/index.html`, `noindex`, the existing `og-image.png` for share cards, phone-first grid (one column, two at ≥480px). No `<script>` at all — the tokens and the small style block are the whole head setup, so nothing can fail to load.

## T9 — Self-review

**Tests** — `node --test nba/nba.test.mjs`:

```
1..21
# tests 21
# pass 21
# fail 0
exit=0
```

**Inline scripts** — `node check_html_scripts.mjs`:

```
index.html: HTML script syntax OK (3 inline blocks)
nfl/index.html: HTML script syntax OK (2 inline blocks)
nba/index.html: HTML script syntax OK (2 inline blocks)
exit=0
```

The page's own module block, extracted and checked on its own (`node --check` on the extracted source, because `new Function` cannot parse an `import`): `module script: syntax ok`.

**Banned content** (packet-3 T9 grep: `pickcenter|againstTheSpread|odds|predictor|winprobability|rotowire|fantasy`):

```
nba/index.html:0
nba/nba.js:0
```

**404 markup** — `xmllint --html --noout 404.html` exits 0. It prints two notices (`Tag header invalid`, `Tag main invalid`) because libxml2 parses HTML4 and does not know HTML5 sectioning elements; it would say the same about `nba/index.html`.

**`esc()` on every new interpolation.** All 27 `innerHTML =` sites interpolate through `esc()` (or through a builder that does), and the new code adds no exception: `setTitle` writes `document.title` as a plain string, the picker `value="…"` uses `esc`, both `aria-label`s are literals, the box compare reads `team.totals[…]` through `esc(row.text(...))` inside `compareTableHTML`, and captions go through `esc(caption)`. A grep for `innerHTML = … + <variable>.` patterns returns nothing.

**Timers, and what clears each:**

| Timer | Where | Cleared by |
|---|---|---|
| `pollTimer` (scores error re-arm) | 1021 | `stopPolling()` on the next view/hash change |
| `pollTimer` (live scores poll) | 1042 | `stopPolling()` on the next view/hash change |
| `searchTimer` (header search debounce) | 1541 | `closeSearch()` — pick, Escape, outside tap, toggle; and the next keystroke |
| picker `timer` (compare pickers) | 1768 | its own `close()` (1737/1758), now also reached from `stopPolling()` via `pickerClosers` |
| `gameTimer` (live game poll) | 1994 | `stopPolling()`; not re-armed once the game is final |

No `setInterval` anywhere in the page.

**Structure harness.** The page's real module script was run against a stubbed DOM and the committed fixtures: **55/55 assertions pass**, including the dated scores title, `combiner` logo URLs with fixed sizes, the Conference switch, `#standings/league` producing one 30-row table sorted by win percentage with ranks 1..30, the final-game comparison sitting between the line score and the boxes with 11 rows and `44.8` / `45.7` shooting percentages, the `TOV` row, filtered table captions, `CLE vs PHI · Matchup Board`, `Maxey vs Maxey · Matchup Board` with both picker fields holding `value="Tyrese Maxey"`, and `Philadelphia 76ers · Matchup Board`.

**STATE.md** — one line, `STATE.md:26`, in the 2026-10-30 section.

## SKIPPED

None.

## Known gaps

- **No browser run**, per the packet's hard rule. The 375px date row and the focus ring are verified structurally (CSS rules at 702-721 and 176-179), not visually.
- **`::-webkit-datetime-edit` / `::-webkit-calendar-picker-indicator` are WebKit-only.** Firefox at ≤480px shows a 36px-wide date field that clips its own text; it is still tappable, its value is still readable by the picker, and `overflow: hidden` keeps it from widening the row. A cross-browser icon button would need a `<label>`-wrapped input or a button that calls `showPicker()`.
- **The player-compare prefill only appears once both players are chosen.** With one pick, nothing has been fetched for that id, so the field stays empty rather than showing a guessed name.
- **The header search debounce is still cleared by `closeSearch()`, not `stopPolling()`.** The packet asked only for the compare pickers; moving the header one would mean sharing its `close` with the router.
- **`smallImg` is verified as a URL rewrite, not as a served image.** No live fetches were allowed in this run, so the 8KB/2KB sizes are the packet's measurement, not a re-measure.
- **`404.html` was not exercised.** Cloudflare Pages serves it for unknown paths; locally nothing routes to it, and `_redirects` has no rule that would mask the file itself.
- **5 tables got captions; the caption text is `sr-only`**, so the visual layout is unchanged and there is no visible per-table heading in the compare cards.
- **Box compare shows both the shot line and its percentage** (FG and FG%, 3PT and 3P%, FT and FT%) — 11 rows rather than 8 — so a reader who wants only percentages sees more rows than the packet's list strictly implies.
- **`og-image.png` still does not exist at the origin**; `404.html` and the league pages all reference it.
