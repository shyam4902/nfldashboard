# NBA polish variants

Four takes on `nba/index.html`, all on the same frozen ESPN data. Start at
`design/polish/index.html`, which links each variant's scores, game, leaders and
compare views.

To view locally, serve the repo root (the pages load `/nba/teams.json` by
absolute path):

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/design/polish/.

## Frozen data

- Date: Thu Oct 22, 2026. Featured game: CLE 106 at PHI 114 (`401909093`).
  Philadelphia trailed by 29 and won. It is the selected card on scores, the
  `#game/401909093` page and `#compare/5/20`.
- `fixtures/` holds raw ESPN responses copied from `nba/fixtures/` (captured
  Oct 22-23). The session that built these could not reach ESPN, so the set is
  partial: the DEN at OKC summary, five of the six leaders boards and
  Cleveland's schedule and roster were never captured. Those parts show the
  page's normal "not loaded" state. The points board was captured later than
  the date (players have 4-5 games).
- `shim.js` (variant pages only) freezes the clock at 23:59 ET on the frozen
  date and answers ESPN requests from `fixtures/`. A request with no saved file
  gets a 404. Nothing is filled in.
- `freeze.mjs` saves a complete set for any date from a machine that can reach
  ESPN: `node design/polish/freeze.mjs 20261101 [eventId]`. It rewrites
  `fixtures/manifest.js`; the variants and the picker follow it.

## Variants

| | Direction | Google Font |
|---|---|---|
| v1 | Editorial: one 1.25 type scale (12-76px), serif numerals, a recap written from the play-by-play, full stat line on each leader | Source Serif 4 |
| v2 | Stat sheet: shot charts and zone splits, quarter sheet with scorers, game flow, injuries, officials and crowd, 25-deep leaders table and a PPG vs FG% plot | Barlow Condensed |
| v3 | Depth: three elevation levels, team-colour light behind the hero, spotlight card, margin / win-probability toggle, leaders podium, entrance motion (off under reduced motion) | Space Grotesk |
| v4 | Timeline: the game as four quarter chapters with score, scorers, swing and a slice of the margin chart; the slate by tip-off; leader bars from zero | Unbounded |

All four keep the dark chrome, gold only on active tabs and controls, team
colours on the blocks, and the scores-card hover and click-to-inspect.
Text on team colours uses `textOn`, and chart and label colours use
`readableOn` at 4.5:1 (3:1 for lines). Nothing scrolls sideways at 390px.

## Shared code

- New pure helpers in `nba/nba.js`, tested in `nba/nba.test.mjs`:
  `parseGameFlow` (margin series, lead changes, ties, biggest leads, best runs,
  time ahead, win probability), `parseShots` + `shotZones`,
  `parsePeriodScoring` (points and scorers by quarter), `parseLeaderLines`
  (leaders with each player's full line), `periodStart`. The tests check them
  against ESPN's own numbers: lead changes, largest lead, lead percentage,
  FG and 3PT totals, line score, and player points.
- Each variant is a copy of `nba/index.html` with its own CSS, a shared block of
  `px-*` renderers (charts, facts, slate leaders), and its own `gmPageHTML`,
  `showLeaders`, `pxCanvasExtra` and `pxFillInspector`.

## Porting a winner

1. Remove the two `<script>` tags for `manifest.js` and `shim.js` and the
   `noindex` meta tag, and change the import back to `./nba.js`.
2. Keep the `.catch(() => ({}))` on the team schedule fetch: one missing
   schedule then costs only that team's last five, not the whole compare view.
3. `.wrap { box-sizing: border-box; }` applies at every width in the variants.
   The live scores page is 24px wider than a 1440px window because the rule is
   only set below 720px.
4. The variants turn off the live page's 72% opacity on card labels and
   records. That opacity drops white text on blue and red cards below 4.5:1.

Screenshots of each variant (scores, game and leaders at 1440x900 and 390x844)
are in `shots/`. ESPN's image CDN was also blocked when they were taken, so
logos and headshots show their fallbacks.
