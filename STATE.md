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
- ESPN transaction ingestion hardening is underway. The parser now has isolated Node fixtures for signings, releases, waiver claims, trades, unsupported descriptions, and normalized dashboard records. `--dry-run` validates and writes a timestamped `espn_transactions_2026.json` inspection artifact without changing roster files or a database. No live sync or database write was run.
- The commented browser-side summer override was deleted from `index.html`; source checks now reject all legacy override identifiers rather than allowing dead code to remain searchable.
- Dashboard verification is aligned with the current source/UI contract: Moves tests use a rendered source-backed transaction rather than requiring Myles Garrett, projections tests no longer target the retired Clay Starters control, test paths are repository-relative, and the smoke test now fails when Home content is genuinely unavailable.

## Session wrap 2026-09-02
- Matchup Insights now selects roster players deterministically by depth-chart order, then OVR, then name. Narrative claims such as "top WR," "leads the edge rush," and player-specific coverage assignments were removed when the snapshot cannot prove them.
- Missing matchup metadata no longer falls back to hardcoded Seattle/kickoff/broadcast values. The panel discloses that player assignments, injuries, and weekly projections are unavailable.
- Regression coverage was added to `props-smoke.mjs`; `node props-smoke.mjs` and `python3 test_all_extensions.py` pass with zero console errors.

## Next
- Continue the prototype-to-production audit one issue at a time. The stale global “Top WR” walkthrough claim was relabeled as a source-scoped Clay example, missing cap space/win probability now render unavailable instead of fabricated numeric values, and freshness badges surface non-fresh manifest status.
- Consider the proposed module split only after trust cleanup settles: extract `styles.css` + `app.js` from the 7.3k-line `index.html` without adding a build step.
- The checked-in launchd plist now uses a portable placeholder path and `/usr/bin/env node`; install it with the actual checkout path when configuring a machine. No live launchd job was edited.
- Producer-to-Edge publishing automation (shared with the Edge thread) remains separate; no deploy or live sync was run in this session.
- HTML validation uses `check_html_scripts.mjs`, which extracts inline scripts and runs Node syntax checks; `node --check index.html` is not a valid command.

## Blockers
- None.
