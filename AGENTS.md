# nfldashboard

This repo is the static NFL dashboard. It displays the board produced by `fantasyfootball` and other NFL data. For the cross-project map, read `../docs/agents/repo-map.md`.

The Edge app link uses the live custom domain `https://edge.shyamsapps.qzz.io`. `https://edgeplay-analytics.pages.dev` serves the same deployment and stays valid as the fallback. Lovable is historical and is not the current host or source of truth.

## Data source of truth

**The project's data is the source of truth — never "correct" it from model knowledge.** Live teams, players, and transactions come from Supabase through `loadAllData()`; the committed `nfl_rosters_2026.json` is the deploy artifact of that same data. AI training data is always outdated, so roster assignments that differ from what you "know" (e.g. Quinnen Williams on the Cowboys, Justin Fields on the Chiefs) are correct in this project's 2026 data — not scrambling to fix. If data looks wrong, check the transaction feed, sync scripts, or `STATE.md`, or ask the user. Do not silently change roster data from memory.

## Local facts

- The app is primarily `index.html` and deploys to Cloudflare Pages.
- **Deploy path (confirmed):** `nfldashboard.pages.dev` is git-connected to
  this GitHub repo (branch `main`) and auto-deploys on `git push origin main`
  (~1-2 min). Pushing is the only step that ships the public site.
- `~/Library/Application Support/nfldashboard-props/nfldashboard/` is a
  **local dev-preview copy** maintained by `install-launchd.sh` (launchd
  runtime) — NOT the public deployment. Editing it ships nothing.
- `props-board.json` comes from `fantasyfootball/scripts/export-board.js`. Do not hand-edit it as normal UI work.
- Live teams, players, and transactions come from Supabase through `loadAllData()`.
- `schedule.json` feeds schedules and matchup selection.
- Madden ratings are only for the Matchup Lab. Do not restore them to main pages without an explicit request.
- `STATE.md` records recent dashboard decisions and known limits.

## Commands

```bash
node scripts/validate-data.js        # data-layer gate (JSON shape, copy identity, freshness)
node props-smoke.mjs                 # browser smoke — hermetic fixtures by default
python3 test_all_extensions.py       # hermetic fixtures by default
python3 test_projections.py          # hermetic fixtures by default
node --test validate_data.test.js
node --test concurrent_publish.test.js
```

Browser tests intercept Supabase/nflverse with committed-data fixtures by default; real-network runs are explicit opt-ins (`DASH_LIVE_NETWORK=1`, `LIVE_SMOKE=1`). The validator never treats file mtimes as provenance (Git discards them on checkout) — run it before deploying data changes.

Use `node sync_supabase_rosters.js` only when the task requires a roster refresh. It contacts a live service and changes local data.

## Before editing

Read `CLAUDE.md`, `STATE.md`, and the relevant README or test. For changes involving board data, schedules, rosters, or shared files, read `../docs/agents/repo-map.md` and the applicable data README first. Follow existing single-file UI patterns unless the task explicitly requests a restructure.

## After editing

Run `node props-smoke.mjs` for UI or board-reader changes. Run the relevant Python suite when its area changes. Update `STATE.md` for meaningful behavior or workflow changes. Keep credentials, local runtime files, and unrelated generated screenshots out of commits.