# PACKET-2026-10-30-6 walkthrough — NFL moves to `/nfl/`, `/` becomes the sport picker

executor: freebuff. Date: 2026-10-30. Packet: [PACKET-2026-10-30-6-nfl-subpage.md](./PACKET-2026-10-30-6-nfl-subpage.md)

Rule implemented: every league lives on its own sub-page, `/` is only a picker. The old single-page NFL dashboard kept every byte of its behavior; only its HTML location, its data URLs, and four head/link lines changed.

## Summary

| Task | Outcome |
|---|---|
| T1 | `index.html` → `nfl/index.html` (9,909 lines, unedited except paths), all 13 load sites root-absolute, canonical/og:url `/nfl/`, sport switch `/nfl/`, tendency loader absolute |
| T2 | New root `index.html`: sport picker, three inline blocks (redirect, palette, live lines) |
| T3 | 12 tooling/doc files repointed; `check_html_scripts.mjs` now checks all three pages |
| T4 | Self-review + `STATE.md` line |

`git diff --stat` (read-only) shows 15 tracked files, `201 insertions(+), 9851 deletions(-)`. The large deletion count is `index.html` shrinking from the NFL page to the picker; the NFL page now lives in the untracked `nfl/` directory.

## T1 — Move the page

`mv index.html nfl/index.html` (plain `mv`, no `git mv`; `mkdir -p nfl` first).

### Data URLs, all changed to root-absolute

| `nfl/index.html` line | Before | After |
|---|---|---|
| 6544 | `./data/shared/nfl_standings_2026.json`, `./nfl_standings_2026.json` | `/data/shared/…`, `/nfl_standings_2026.json` |
| 6548 | `./data/shared/nfl_stats_2026.json`, `./nfl_stats_2026.json` | `/data/shared/…`, `/nfl_stats_2026.json` |
| 7025 | `./data/shared/clay_projections_2026.json`, `./clay_projections_2026.json` | `/data/shared/…`, `/clay_projections_2026.json` |
| 7463 | `./data/shared/team_season_efficiency.json`, `./team_season_efficiency.json` | `/data/shared/…`, `/team_season_efficiency.json` |
| 7538 | `./data/shared/schedule.json`, `./schedule.json` | `/data/shared/…`, `/schedule.json` |
| 8188 | `./data/shared/props-board.json`, `./props-board.json` | `/data/shared/…`, `/props-board.json` |
| 8206 | `fetch('./data/shared/freshness.json')` | `fetch('/data/shared/freshness.json')` |
| 8224 | `fetch('./data/shared/pipeline-status.json')` | `fetch('/data/shared/pipeline-status.json')` |
| 2329 | `fetch('draft-capital.json')` | `fetch('/draft-capital.json')` |
| 6161 | `import('./scripts/load_team_tendencies.js')` | `import('/scripts/load_team_tendencies.js')` |

`scripts/load_team_tendencies.js:23-24` — the module's own two candidates are now `/data/shared/team_tendencies_2025.json` and `/team_tendencies_2025.json`. Worth stating why: a module's `fetch` resolves against the *page* URL, so with the page at `/nfl/` the old relative paths would have asked for `/nfl/data/shared/…`.

### Head and links

| `nfl/index.html` line | Change |
|---|---|
| 1884 | `<link rel="canonical" href="https://matchupboard.com/nfl/">` |
| 1887 | `<meta property="og:url" content="https://matchupboard.com/nfl/">` |
| 1905 | sport switch `href="/nfl/" class="tab-btn shrink-0" aria-current="page"` |

Left alone on purpose: 1883 `rel="icon"` and 1889 `og:image` were already root-absolute from packet 3, so they survive the move.

### Done commands

```text
$ grep -nE "[\"'\`]\./|[\"'\`](data/|scripts/)" nfl/index.html scripts/load_team_tendencies.js
(no output, exit 1 — grep's "no match")
```

```text
$ grep -n "rel=\"canonical\"\|og:url\|href=\"/\"" nfl/index.html
1883:<link rel="icon" href="/favicon.svg" type="image/svg+xml">
1884:<link rel="canonical" href="https://matchupboard.com/nfl/">
1887:<meta property="og:url" content="https://matchupboard.com/nfl/">
1905:        <a href="/nfl/" class="tab-btn shrink-0" aria-current="page">NFL</a>
```

```text
$ node check_html_scripts.mjs
index.html: HTML script syntax OK (3 inline blocks)
nfl/index.html: HTML script syntax OK (2 inline blocks)
nba/index.html: HTML script syntax OK (2 inline blocks)
```

`ls nfl/index.html` exists, and its two inline blocks are the same two the old root page had, so the move itself introduced no syntax change.

## T2 — New root `index.html` (sport picker)

327 lines, no build step, no library beyond the Tailwind CDN the league pages already use.

- **Old deep links, `index.html:9-12`** — first inline block in `<head>`, before the CDN, before any markup:
  `if (location.hash && location.hash.length > 1) { location.replace('/nfl/' + location.hash); }`
  This also catches a saved `/index.html#matchup/…`, since the script ships on that URL too.
- **Palette, `index.html:15-60`** — the same `:root` colour tokens as `nfl/index.html` / `nba/index.html` (body `#0b0d10`, card `#14161a`, brand gold `#d9a441`), plus Archivo for the wordmark and Geist/Geist Mono for text. Copying the tokens rather than linking a shared CSS file keeps the three pages independently deployable, which is how the repo already works.
- **Head** — title `Matchup Board · NFL and NBA scores, matchups and stats`, description, `rel="icon"` `/favicon.svg`, canonical `https://matchupboard.com/`, `og:title` / `og:description` / `og:url` / `og:type` / `og:image` (the existing `/og-image.png`, 1200×630), `twitter:card`.
- **Header** — wordmark only (`Matchup` in gold, `Board` in white), no switch, because from here both leagues are one click away.
- **Cards, `index.html:175-184`** — two `<a class="pick-card">`: NFL → `/nfl/` ("Scores, schedules, matchups and team stats."), NBA → `/nba/` ("Scores, standings, matchups and player stats."). One column on phones, two at ≥640px. Every card is a link even when both live lines fail.
- **NFL live line, `index.html:210-226`** — `fetch('/schedule.json')`, takes `schedule.week`, filters `games` to that week, counts `status === 'final'`. Copy uses `textContent` and reveals a `hidden` span only on success, so a failure leaves the card exactly as designed.
- **NBA live line, `index.html:228-243`** — `etDate()` (same `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })` + `formatToParts` approach as `nba/nba.js`) builds `YYYYMMDD`, then `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=<day>` and prints `events.length`. Singular/plural handled.
- **Phone-first** — `* { box-sizing: border-box }`, `body { overflow-x: hidden }`, cards are grid items with `minmax(0, 1fr)`, no fixed widths, so nothing overflows at 375px.

### Done commands

```text
$ grep -c 'href="/nfl/"' index.html
1
$ grep -c 'href="/nba/"' index.html
1
$ grep -c "location.replace('/nfl/'" index.html
1
```

Live-line arithmetic checked against the committed schedule (read-only, no network):

```text
$ node -e "...schedule.json week/final count..."
week field: 8 | games this week: 14 | finals: 1
picker line: Week 8 · 1 of 14 games final
etDate sample: 20261030
```

## T3 — Point everything at the new paths

| File | Line(s) | Change |
|---|---|---|
| `nba/index.html` | 738 | sport switch NFL link `href="/"` → `href="/nfl/"` |
| `sitemap.xml` | 8-11 | `/nfl/` entry (hourly, 0.9) between `/` and `/nba/` |
| `check_html_scripts.mjs` | 6-7 | loops over `['index.html', 'nfl/index.html', 'nba/index.html']`; each file's blocks checked, output prefixed per file, error message names the page |
| `moves_filtering.test.js` | 9 | reads `path.join(__dirname, 'nfl', 'index.html')` |
| `scripts/production-health-check.mjs` | 80, 98 | reads `nfl/index.html`; Madden-isolation comment updated |
| `props-smoke.mjs` | 26-27, 46 | `access`/`readFile` `nfl/index.html`; local server maps `/` → `/nfl/index.html` so the existing `goto('http://localhost:8123/')` exercises the NFL page unchanged |
| `scripts/publish-daily.js` | 318 | required-file precondition `'nfl/index.html'` |
| `test_all_extensions.py` | 58, 476, 495, 516 | every `goto(…/index.html)` → `…/nfl/` |
| `test_projections.py` | 54 | `goto("http://127.0.0.1:8766/nfl/")` |
| `checkpoint5_rehearsal.py` | 81 | `goto(…/nfl/)` |
| `audit_mobile.py` | 128 | `goto(…/nfl/)` |
| `AGENTS.md` / `CLAUDE.md` | 6, 9 | Site layout rule now says NFL lives at `nfl/index.html`; "app is primarily `index.html`" → "root `index.html` is only the picker; the NFL page is `nfl/index.html`" |

`_redirects`: no rule mentions `/nfl/` and none masks it. The three existing splats that *could* have caught it are `/docs/*`, `/nba/fixtures/*`, `/delegation/*`/`/diagrams/*`; none applies. `/scripts/load_team_tendencies.js` has no deny rule (it is intentionally enumerated-out in the comment there), so the moved page's absolute import still resolves. Nothing was added to the file.

### Done commands

```text
$ node check_html_scripts.mjs
index.html: HTML script syntax OK (3 inline blocks)
nfl/index.html: HTML script syntax OK (2 inline blocks)
nba/index.html: HTML script syntax OK (2 inline blocks)
exit=0
```

```text
$ node --test moves_filtering.test.js validate_data.test.js concurrent_publish.test.js sync_scores.test.js
# tests 27
# pass 27
# fail 0
exit=0
```

```text
$ node --test nba/nba.test.mjs
# tests 19
# pass 19
# fail 0
exit=0
```

```text
$ node scripts/validate-data.js
…
validate-data: all 18 assets pass
exit=0
```

```text
$ grep -rn "/index.html\|'index.html'\|\"index.html\"" *.py *.mjs *.js scripts/*.js scripts/*.mjs | grep -v "nfl/index.html\|nba/index.html"
props-smoke.mjs:26:await access(join(root, 'nfl', 'index.html'));
props-smoke.mjs:27:const sourceHtml = await readFile(join(root, 'nfl', 'index.html'), 'utf8');
moves_filtering.test.js:9:const indexHtml = fs.readFileSync(path.join(__dirname, 'nfl', 'index.html'), 'utf8');
```

Those three are the corrected `path.join('nfl', 'index.html')` forms — the filter only removes the literal `nfl/index.html` spelling, not the joined one. No remaining reference means the old NFL page.

## T4 — Self-review

Re-ran every done command above (outputs pasted in place). Checked by hand:

- Every changed load site is inside a list literal or `fetch`/`import` call that already had a fallback, so the absolute path is a drop-in; no control flow changed.
- The picker writes only `textContent`; nothing renders remote HTML. No `<script>` in the picker uses `import`/`await`, so `check_html_scripts.mjs`'s `node --check` pass is meaningful for it.
- Head tags on all three pages are root-absolute or full URLs — no path depends on the page's directory depth.
- `xmllint --noout sitemap.xml` → clean.

Files changed, one line each:

- `nfl/index.html` — the NFL page, moved; 13 data URLs + canonical/og:url/switch made absolute for life at `/nfl/`.
- `index.html` — new sport picker (redirect, two cards, two live lines).
- `nba/index.html` — NFL switch points at `/nfl/`.
- `scripts/load_team_tendencies.js` — its two data candidates root-absolute.
- `scripts/production-health-check.mjs` — reads the moved page.
- `scripts/publish-daily.js` — requires the moved page.
- `props-smoke.mjs` — reads and serves the moved page for `/`.
- `moves_filtering.test.js` — reads the moved page.
- `check_html_scripts.mjs` — checks all three pages.
- `sitemap.xml` — lists `/`, `/nfl/`, `/nba/`.
- `test_all_extensions.py`, `test_projections.py`, `checkpoint5_rehearsal.py`, `audit_mobile.py` — navigate to `/nfl/`.
- `AGENTS.md`, `CLAUDE.md` — layout rule and "what is the app" line updated.
- `STATE.md` — one dated line in the 2026-10-30 section.

## SKIPPED

None. T1–T4 all landed. Nothing from the packet's task list was dropped.

## Known gaps

- **`nfl_rosters_2026.csv` needed no change.** The packet lists it among the URLs to rebase, but `nfl/index.html:2442-2455` builds the CSV in memory with `Blob` + `URL.createObjectURL` and only *names* the download (`link.setAttribute('download', 'nfl_rosters_2026.csv')`). There is no path to rebase; changing the string would only rename the downloaded file.
- **`_redirects` comment is now slightly stale.** It explains the `/scripts/*` exception as "index.html dynamically imports ./scripts/load_team_tendencies.js". The rule is still correct (the file stays public) and the packet said to add nothing to `_redirects`, so the wording was left alone.
- **No browser pass.** The redirect (`/#matchup/…`, `/index.html#schedule`), the `/nfl/` page rendering from root-absolute data, and the 375px layout are verified structurally only — the packet forbids a browser.
- **`/nfl/` → `nfl/index.html` relies on Cloudflare Pages' directory-index behavior**, the same behavior `/nba/` already exercises in production. No `_redirects` entry was added, per the packet.
- **The Playwright suites and `props-smoke.mjs` were not executed** — both need a browser and a local server, which the packet excludes from this run. Their path edits compile and are consistent, but the runs are the orchestrator's job.
- **The local launchd preview copy** (`~/Library/Application Support/nfldashboard-props/nfldashboard/`) still contains the old root page; the packet marks that copy out of scope (`install-launchd.sh` lives in `fantasyfootball/`).
- **`og-image.png` still does not exist at the origin.** All three pages reference it; the picker's share card stays broken until it is rendered, which packet 3 already recorded as out of band.
- **The NBA count on the picker is today's games only** and is hidden if the ESPN fetch fails, so a cold/blocked network shows two cards with no line — intentional, but it means the picker has no offline-ish fallback text.
