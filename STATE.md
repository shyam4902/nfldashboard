# NFL Dashboard — State

- updated: 2026-08-26
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages, auto-deploys on push to main)
- repo: https://github.com/shyam4902/nfldashboard · single-file app in `index.html` + Supabase + static JSON

## Shipped recently
- Draft tab removed (2026 draft has passed); roster modal gained a **Draft Capital** tab with
  2027/2028 pick holdings (`draft-capital.json`, regenerate via `scripts/build_draft_capital.py`).
- Transactions relocated to **Teams → Moves** dense date-grouped newswire with detail drawer;
  legacy `feed` routes redirect. Commit `d60840c`.
- Home page overhauled into a feature showcase (hero, feature grid, spotlights, tools).
- Schedule tab (Week 1 cards with model win probs vs market lines from nflverse) + game-lines
  drawer polish; team defense projections rebuilt from clean positional data.
- Obsolete mockup artifacts removed (`32bf9fd`).

## In flight
- Nothing — working tree clean, all suites green (`test_all_extensions.py`,
  `test_schedule_data.py`, `test_projections.py`).

## Next
- Known data caveat: draft capital excludes compensatory picks and any trades not itemized
  in transaction details; extend `scripts/build_draft_capital.py` ledger as new trades land.
- Candidate work: schedule tab for weeks 2+ (data pipeline exists), draft-capital chips on
  team tiles, in-season weekly actuals vs Clay projections.

## Blockers
- None.
