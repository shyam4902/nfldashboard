# NFL Dashboard — State

- updated: 2026-09-02
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages, **git-connected: auto-deploys on `git push origin main`**)
- repo: https://github.com/shyam4902/nfldashboard · single-file app in `index.html` + Supabase + static JSON
- deploy: commit → push → Pages builds (~1-2 min). The only step that ships the public site is the push.
- NOTE: `~/Library/Application Support/nfldashboard-props/nfldashboard/` is the launchd/local dev-preview copy, NOT the public deployment.

## Shipped 2026-09-02 — friend-feedback audit: 4 root causes fixed, trimmed, deployed
- Full-surface audit (all 5 tabs, 8 matchup + 19 projection subtabs, modals, themes, mobile 390px): zero page/console errors everywhere; the reported issues were data-trust failures, not crashes.
- **P1 — deploys never carried the data layer.** `data/shared/` is outside every git repo, so live `./data/shared/*.json` fetches got the SPA-fallback index.html back (HTTP 200, text/html); `freshness.json` had no fallback, so trust badges were dead in prod. Fix: root `scripts/sync_shared_data.sh` now also publishes the layer into `nfldashboard/data/shared/` (git-tracked → ships with every deploy) and `isJsonResponse()` rejects 200-with-HTML responses so fetches fall through to repo-local copies. **Deploys must commit `data/`.**
- **P2 — Clay name-variant join** ("Chris D. Jones" vs "Chris Jones"): 7 starters (incl. Chris Jones 96, Byron Young 82) opened projection-less modals. Fix: shared `normName()` + unambiguous first+last fallback via `CLAY_INDEX` built once on load.
- **P3 — ~1,725 of 2,523 players** (everyone Clay doesn't project, incl. every OL) opened mystery-empty modals. Fix: honest "No Mike Clay projection is published for this player…" note.
- **P4 — roster modal rows were dead ends.** Every row now deep-links to `openPlayerModal(name, team)`.
- Trim: dead `if (false && …)` projected-starters branch removed; 9 name-normalizer copies → one `normName()`; ~16 lines dead CSS cut; 6 stale scripts deleted (`build_complete_app.py`, `fix_starters.py`, `extract_remaining.py`, `check_csv.js`, `spot_check.js`, `verify_schedule.py`).
- Shipped as `02df20d` (+ `f66cd85` docs), pushed, live ~30s later, verified on production: freshness 200 application/json, "data <1h ago" badge, Chris Jones modal with Clay data, empty-state note, roster click-through, zero console errors.
- Earlier: 2026-09-01 compare-search fix (`ba40e27`), fabricated-numbers audit, dashboard consolidation (5 tabs), freshness badges, unified data layer.

## In flight
- Nothing — working tree clean at `f66cd85`. All checks green (node --check, `props-smoke.mjs`, `test_all_extensions.py`, mobile 390px).

## Next
- **Module split (proposed; user interested):** extract `styles.css` + `app.js` (+ per-domain chunks) from the 7.3k-line `index.html` using plain `<script src>` tags — no build step, deploys stay static, smoke/guard scripts unchanged.
- Lock the 2026-09-02 fixes into `props-smoke.mjs` as permanent regression checks (Chris Jones join, empty-state note, roster click-through).
- Repoint the 06:00 roster-sync crontab at `~/Desktop/NFL_Main/nfldashboard` (dead since the 08-31 repo move; editing cron is the user's call).
- Producer-to-Edge publishing automation (shared with the Edge thread); retire the old Lovable deployment.

## Blockers
- None.
