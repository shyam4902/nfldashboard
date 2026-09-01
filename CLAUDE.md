# nfldashboard

This repo is the static NFL dashboard. It displays the board produced by `fantasyfootball` and other NFL data. For the cross-project map, read `../docs/agents/repo-map.md`.

The Edge app link must use `https://edgeplay-analytics.pages.dev`. The custom domain `https://edge.shyamsapps.qzz.io` is not verified for active use. Lovable is historical and is not the current host or source of truth.

## Local facts

- The app is primarily `index.html` and deploys to Cloudflare Pages.
- `props-board.json` comes from `fantasyfootball/scripts/export-board.js`. Do not hand-edit it as normal UI work.
- Live teams, players, and transactions come from Supabase through `loadAllData()`.
- `schedule.json` feeds schedules and matchup selection.
- Madden ratings are only for the Matchup Lab. Do not restore them to main pages without an explicit request.
- `STATE.md` records recent dashboard decisions and known limits.

## Commands

```bash
node props-smoke.mjs
python3 test_all_extensions.py
python3 test_projections.py
```

Use `node sync_supabase_rosters.js` only when the task requires a roster refresh. It contacts a live service and changes local data.

## Before editing

Read `AGENTS.md`, `STATE.md`, and the relevant README or test. For changes involving board data, schedules, rosters, or shared files, read `../docs/agents/repo-map.md` and the applicable data README first. Follow existing single-file UI patterns unless the task explicitly requests a restructure.

## After editing

Run `node props-smoke.mjs` for UI or board-reader changes. Run the relevant Python suite when its area changes. Update `STATE.md` for meaningful behavior or workflow changes. Keep credentials, local runtime files, and unrelated generated screenshots out of commits.